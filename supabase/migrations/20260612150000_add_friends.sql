create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (requester_id <> addressee_id),
  constraint friend_requests_unique_pair unique (requester_id, addressee_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_not_self check (user_id <> friend_id)
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'friend requests visible to participants') then
    create policy "friend requests visible to participants"
      on public.friend_requests for select
      using (auth.uid() = requester_id or auth.uid() = addressee_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'users can create own friend requests') then
    create policy "users can create own friend requests"
      on public.friend_requests for insert
      with check (auth.uid() = requester_id and requester_id <> addressee_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'addressees can update friend requests') then
    create policy "addressees can update friend requests"
      on public.friend_requests for update
      using (auth.uid() = addressee_id)
      with check (auth.uid() = addressee_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friendships' and policyname = 'users can see own friendships') then
    create policy "users can see own friendships"
      on public.friendships for select
      using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.approve_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.friend_requests%rowtype;
begin
  select *
  into request_row
  from public.friend_requests
  where id = request_id
    and status = 'pending'
    and addressee_id = auth.uid();

  if not found then
    raise exception 'Friend request not found or not allowed';
  end if;

  update public.friend_requests
  set status = 'approved', updated_at = now()
  where id = request_id;

  insert into public.friendships (user_id, friend_id)
  values
    (request_row.requester_id, request_row.addressee_id),
    (request_row.addressee_id, request_row.requester_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.approve_friend_request(uuid) from public;
grant execute on function public.approve_friend_request(uuid) to authenticated;

create or replace function public.search_profiles_for_friends(search_input text)
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  avatar_url text,
  relationship text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.display_name,
    p.avatar,
    p.avatar_url,
    case
      when p.id = auth.uid() then 'self'
      when exists (
        select 1 from public.friendships f
        where f.user_id = auth.uid() and f.friend_id = p.id
      ) then 'friend'
      when exists (
        select 1 from public.friend_requests fr
        where fr.requester_id = auth.uid() and fr.addressee_id = p.id and fr.status = 'pending'
      ) then 'outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.requester_id = p.id and fr.addressee_id = auth.uid() and fr.status = 'pending'
      ) then 'incoming'
      else 'none'
    end as relationship
  from public.profiles p
  where p.id <> auth.uid()
    and length(trim(search_input)) >= 2
    and p.display_name ilike '%' || trim(search_input) || '%'
  order by p.display_name asc
  limit 20;
$$;

revoke all on function public.search_profiles_for_friends(text) from public;
grant execute on function public.search_profiles_for_friends(text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'check_ins' and policyname = 'friends can see each other check ins') then
    create policy "friends can see each other check ins"
      on public.check_ins for select
      using (
        auth.uid() = user_id
        or exists (
          select 1 from public.friendships f
          where f.user_id = auth.uid()
            and f.friend_id = check_ins.user_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'check_in_groups' and policyname = 'friends can read check in group links') then
    create policy "friends can read check in group links"
      on public.check_in_groups for select
      using (
        exists (
          select 1
          from public.check_ins ci
          where ci.id = check_in_groups.check_in_id
            and (
              ci.user_id = auth.uid()
              or exists (
                select 1 from public.friendships f
                where f.user_id = auth.uid()
                  and f.friend_id = ci.user_id
              )
            )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'check_in_reactions' and policyname = 'friends can read reaction counts') then
    create policy "friends can read reaction counts"
      on public.check_in_reactions for select
      using (
        exists (
          select 1
          from public.check_ins ci
          where ci.id = check_in_reactions.check_in_id
            and (
              ci.user_id = auth.uid()
              or exists (
                select 1 from public.friendships f
                where f.user_id = auth.uid()
                  and f.friend_id = ci.user_id
              )
            )
        )
      );
  end if;
end $$;
