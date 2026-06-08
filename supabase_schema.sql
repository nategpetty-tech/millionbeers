create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pintly User',
  avatar text not null default 'HU',
  avatar_url text,
  avatar_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_storage_path text;
alter table public.profiles alter column display_name set default 'Pintly User';

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image text not null,
  backdrop_url text,
  backdrop_storage_path text,
  privacy text not null check (privacy in ('Private', 'Invite Only', 'Public')),
  goal integer not null default 1000 check (goal > 0),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.groups add column if not exists backdrop_url text;
alter table public.groups add column if not exists backdrop_storage_path text;

create table if not exists public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('founder', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('search', 'invite')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  beer_name text not null default 'Beer log',
  brewery text not null default 'Pintly log',
  style text not null default 'Other',
  quantity integer not null default 1 check (quantity between 1 and 24),
  abv numeric,
  rating numeric,
  city text not null default 'Unknown',
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  note text,
  photo_url text,
  photo_storage_path text,
  scanned_beer_count integer check (scanned_beer_count is null or scanned_beer_count between 0 and 24),
  scan_confidence numeric check (scan_confidence is null or (scan_confidence >= 0 and scan_confidence <= 1)),
  scan_status text check (scan_status is null or scan_status in ('confirmed', 'mismatch', 'uncertain', 'unavailable')),
  scan_boxes jsonb,
  count_source text not null default 'manual' check (count_source in ('scanner', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.check_ins add column if not exists country text;
alter table public.check_ins add column if not exists scanned_beer_count integer;
alter table public.check_ins add column if not exists scan_confidence numeric;
alter table public.check_ins add column if not exists scan_status text;
alter table public.check_ins add column if not exists scan_boxes jsonb;
alter table public.check_ins add column if not exists count_source text not null default 'manual';
alter table public.check_ins alter column beer_name set default 'Beer log';
alter table public.check_ins alter column brewery set default 'Pintly log';
alter table public.check_ins alter column count_source set default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_scanned_beer_count_range'
  ) then
    alter table public.check_ins
      add constraint check_ins_scanned_beer_count_range check (scanned_beer_count is null or scanned_beer_count between 0 and 24);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_scan_confidence_range'
  ) then
    alter table public.check_ins
      add constraint check_ins_scan_confidence_range check (scan_confidence is null or (scan_confidence >= 0 and scan_confidence <= 1));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_scan_status_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_scan_status_values check (scan_status is null or scan_status in ('confirmed', 'mismatch', 'uncertain', 'unavailable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_count_source_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_count_source_values check (count_source in ('scanner', 'manual'));
  end if;
end
$$;

create table if not exists public.check_in_groups (
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (check_in_id, group_id)
);

create table if not exists public.check_in_reactions (
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (check_in_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_groups enable row level security;
alter table public.check_in_reactions enable row level security;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;

create or replace function public.is_check_in_owner(target_check_in_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.check_ins
    where id = target_check_in_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_check_in_owner(uuid) to authenticated;

create or replace function public.can_view_check_in(target_check_in_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.check_ins c
    where c.id = target_check_in_id
      and (
        c.user_id = auth.uid()
        or exists (
          select 1
          from public.check_in_groups cig
          join public.group_memberships gm on gm.group_id = cig.group_id
          where cig.check_in_id = c.id
            and gm.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_view_check_in(uuid) to authenticated;

drop policy if exists "profiles are visible to authenticated users" on public.profiles;
create policy "profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users can upsert own profile" on public.profiles;
create policy "users can upsert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "authenticated users can discover groups" on public.groups;
create policy "authenticated users can discover groups"
on public.groups for select
to authenticated
using (true);

drop policy if exists "authenticated users can create groups" on public.groups;
create policy "authenticated users can create groups"
on public.groups for insert
to authenticated
with check (founder_id = auth.uid());

drop policy if exists "founders can update groups" on public.groups;
create policy "founders can update groups"
on public.groups for update
to authenticated
using (founder_id = auth.uid())
with check (founder_id = auth.uid());

drop policy if exists "members can see memberships for their groups" on public.group_memberships;
create policy "members can see memberships for their groups"
on public.group_memberships for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_group_member(group_memberships.group_id)
);

drop policy if exists "founders can add members" on public.group_memberships;
create policy "founders can add members"
on public.group_memberships for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.groups g
    where g.id = group_memberships.group_id
      and g.founder_id = auth.uid()
  )
);

drop policy if exists "requesters and founders can see join requests" on public.group_join_requests;
create policy "requesters and founders can see join requests"
on public.group_join_requests for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.groups g
    where g.id = group_join_requests.group_id
      and g.founder_id = auth.uid()
  )
);

drop policy if exists "authenticated users can request to join" on public.group_join_requests;
create policy "authenticated users can request to join"
on public.group_join_requests for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "founders can update join requests" on public.group_join_requests;
create policy "founders can update join requests"
on public.group_join_requests for update
to authenticated
using (
  exists (
    select 1 from public.groups g
    where g.id = group_join_requests.group_id
      and g.founder_id = auth.uid()
  )
);

drop policy if exists "members can see group check-ins" on public.check_ins;
create policy "members can see group check-ins"
on public.check_ins for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.check_in_groups cig
    join public.group_memberships gm on gm.group_id = cig.group_id
    where cig.check_in_id = check_ins.id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "users can create own check-ins" on public.check_ins;
create policy "users can create own check-ins"
on public.check_ins for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can delete own check-ins" on public.check_ins;
create policy "users can delete own check-ins"
on public.check_ins for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can update own check-ins" on public.check_ins;
create policy "users can update own check-ins"
on public.check_ins for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members can see check-in group links" on public.check_in_groups;
create policy "members can see check-in group links"
on public.check_in_groups for select
to authenticated
using (public.is_group_member(check_in_groups.group_id));

drop policy if exists "members can attach check-ins to their groups" on public.check_in_groups;
create policy "members can attach check-ins to their groups"
on public.check_in_groups for insert
to authenticated
with check (
  public.is_check_in_owner(check_in_groups.check_in_id)
  and public.is_group_member(check_in_groups.group_id)
);

drop policy if exists "members can see reactions for visible check-ins" on public.check_in_reactions;
create policy "members can see reactions for visible check-ins"
on public.check_in_reactions for select
to authenticated
using (public.can_view_check_in(check_in_reactions.check_in_id));

drop policy if exists "members can react to visible check-ins" on public.check_in_reactions;
create policy "members can react to visible check-ins"
on public.check_in_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_check_in(check_in_reactions.check_in_id)
);

drop policy if exists "users can remove own reactions" on public.check_in_reactions;
create policy "users can remove own reactions"
on public.check_in_reactions for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.get_global_beer_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer from public.check_ins;
$$;

grant execute on function public.get_global_beer_count() to authenticated;

create or replace function public.approve_join_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.group_join_requests%rowtype;
begin
  select * into req
  from public.group_join_requests
  where id = request_id;

  if req.id is null then
    raise exception 'join request not found';
  end if;

  if not exists (
    select 1 from public.groups
    where id = req.group_id
      and founder_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  insert into public.group_memberships (group_id, user_id, role)
  values (req.group_id, req.user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  update public.group_join_requests
  set status = 'approved'
  where id = request_id;
end;
$$;

grant execute on function public.approve_join_request(uuid) to authenticated;
