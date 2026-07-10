create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pintly User',
  username text,
  favorite_beer text,
  avatar text not null default 'HU',
  avatar_url text,
  avatar_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_storage_path text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists favorite_beer text;
alter table public.profiles alter column display_name set default 'Pintly User';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,20}$');
  end if;
end
$$;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;

create or replace function public.prevent_profile_username_change()
returns trigger
language plpgsql
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'Username cannot be changed once set.';
  end if;

  if new.username is not null then
    new.username := lower(new.username);
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_username_change on public.profiles;
create trigger prevent_profile_username_change
before update on public.profiles
for each row execute function public.prevent_profile_username_change();

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
  notifications_enabled boolean not null default true,
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
  venue_id uuid,
  venue_provider text,
  venue_provider_place_id text,
  venue_name text,
  venue_category text,
  venue_latitude double precision,
  venue_longitude double precision,
  venue_address text,
  venue_distance_meters integer,
  venue_confirmed boolean not null default false,
  venue_confirmation_status text not null default 'skipped',
  venue_selection_status text not null default 'skipped',
  note text,
  photo_url text,
  photo_storage_path text,
  photo_thumbnail_url text,
  photo_thumbnail_storage_path text,
  scanned_beer_count integer check (scanned_beer_count is null or scanned_beer_count between 0 and 24),
  scan_confidence numeric check (scan_confidence is null or (scan_confidence >= 0 and scan_confidence <= 1)),
  scan_status text check (scan_status is null or scan_status in ('confirmed', 'mismatch', 'uncertain', 'unavailable')),
  scan_boxes jsonb,
  count_source text not null default 'manual' check (count_source in ('scanner', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.check_ins add column if not exists country text;
alter table public.check_ins add column if not exists photo_thumbnail_url text;
alter table public.check_ins add column if not exists photo_thumbnail_storage_path text;
alter table public.check_ins add column if not exists scanned_beer_count integer;
alter table public.check_ins add column if not exists scan_confidence numeric;
alter table public.check_ins add column if not exists scan_status text;
alter table public.check_ins add column if not exists scan_boxes jsonb;
alter table public.check_ins add column if not exists count_source text not null default 'manual';
alter table public.check_ins add column if not exists venue_id uuid;
alter table public.check_ins add column if not exists venue_provider text;
alter table public.check_ins add column if not exists venue_provider_place_id text;
alter table public.check_ins add column if not exists venue_name text;
alter table public.check_ins add column if not exists venue_category text;
alter table public.check_ins add column if not exists venue_latitude double precision;
alter table public.check_ins add column if not exists venue_longitude double precision;
alter table public.check_ins add column if not exists venue_address text;
alter table public.check_ins add column if not exists venue_distance_meters integer;
alter table public.check_ins add column if not exists venue_confirmed boolean not null default false;
alter table public.check_ins add column if not exists venue_confirmation_status text not null default 'skipped';
alter table public.check_ins add column if not exists venue_selection_status text not null default 'skipped';
alter table public.check_ins alter column beer_name set default 'Beer log';
alter table public.check_ins alter column brewery set default 'Pintly log';
alter table public.check_ins alter column count_source set default 'manual';
alter table public.check_ins alter column venue_confirmed set default false;
alter table public.check_ins alter column venue_confirmation_status set default 'skipped';
alter table public.check_ins alter column venue_selection_status set default 'skipped';

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

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_venue_confirmation_status_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_venue_confirmation_status_values check (venue_confirmation_status in ('confirmed', 'skipped', 'unavailable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_venue_selection_status_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_venue_selection_status_values check (venue_selection_status in ('confirmed', 'changed', 'skipped', 'unavailable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_confirmed_venue_identity'
  ) then
    alter table public.check_ins
      add constraint check_ins_confirmed_venue_identity check (
        venue_confirmation_status <> 'confirmed'
        or (venue_provider is not null and venue_provider_place_id is not null and venue_name is not null)
      );
  end if;
end
$$;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_place_id text not null,
  name text not null,
  category text,
  latitude double precision,
  longitude double precision,
  address text,
  city text,
  state text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_place_id)
);

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

create table if not exists public.check_in_comments (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_groups enable row level security;
alter table public.check_in_reactions enable row level security;
alter table public.check_in_comments enable row level security;
alter table public.venues enable row level security;
alter table public.push_tokens enable row level security;

grant select, insert, update on public.venues to authenticated;
grant select, insert on public.group_memberships to authenticated;
grant update (notifications_enabled) on public.group_memberships to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, delete on public.check_in_reactions to authenticated;
grant select, insert, delete on public.check_in_comments to authenticated;

create index if not exists check_in_comments_check_in_id_created_at_idx
on public.check_in_comments(check_in_id, created_at);

create index if not exists check_in_comments_user_id_idx
on public.check_in_comments(user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_venue_id_fkey'
  ) then
    alter table public.check_ins
      add constraint check_ins_venue_id_fkey foreign key (venue_id) references public.venues(id) on delete set null;
  end if;
end
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
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
set row_security = off
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
set row_security = off
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
        or exists (
          select 1
          from public.friendships f
          where f.user_id = auth.uid()
            and f.friend_id = c.user_id
        )
      )
  );
$$;

grant execute on function public.can_view_check_in(uuid) to authenticated;

create or replace function public.auto_link_check_in_to_member_groups()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.check_in_groups (check_in_id, group_id)
  select new.id, gm.group_id
  from public.group_memberships gm
  where gm.user_id = new.user_id
    and new.created_at >= gm.created_at - interval '5 minutes'
  on conflict (check_in_id, group_id) do nothing;

  return new;
end;
$$;

revoke all on function public.auto_link_check_in_to_member_groups() from public;

drop trigger if exists auto_link_check_in_to_member_groups_on_insert on public.check_ins;
create trigger auto_link_check_in_to_member_groups_on_insert
after insert on public.check_ins
for each row
execute function public.auto_link_check_in_to_member_groups();

create or replace function public.is_username_available(username_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', ''))) ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', '')))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.claim_username(username_input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', '')));

  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Invalid username.';
  end if;

  update public.profiles
  set username = normalized_username,
      updated_at = now()
  where id = auth.uid()
    and username is null;

  if not found then
    raise exception 'Username is already set.';
  end if;

  return normalized_username;
end;
$$;

revoke all on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  display_name text;
begin
  normalized_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '^@+', ''));
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  insert into public.profiles (id, display_name, username, avatar)
  values (
    new.id,
    coalesce(display_name, 'Pintly User'),
    nullif(normalized_username, ''),
    coalesce(nullif(upper(left(regexp_replace(coalesce(display_name, 'Pintly User'), '[^A-Za-z0-9]+', '', 'g'), 2)), ''), 'PU')
  )
  on conflict (id) do update
    set
      display_name = excluded.display_name,
      username = coalesce(public.profiles.username, excluded.username),
      avatar = case
        when public.profiles.avatar = 'HU' then excluded.avatar
        else public.profiles.avatar
      end,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

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

drop policy if exists "authenticated users can read venues" on public.venues;
create policy "authenticated users can read venues"
on public.venues for select
to authenticated
using (true);

drop policy if exists "authenticated users can upsert venues" on public.venues;
create policy "authenticated users can upsert venues"
on public.venues for insert
to authenticated
with check (true);

drop policy if exists "authenticated users can update venues" on public.venues;
create policy "authenticated users can update venues"
on public.venues for update
to authenticated
using (true)
with check (true);

drop policy if exists "users can read own push tokens" on public.push_tokens;
create policy "users can read own push tokens"
on public.push_tokens for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users can insert own push tokens" on public.push_tokens;
create policy "users can insert own push tokens"
on public.push_tokens for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "users can update own push tokens" on public.push_tokens;
create policy "users can update own push tokens"
on public.push_tokens for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "users can delete own push tokens" on public.push_tokens;
create policy "users can delete own push tokens"
on public.push_tokens for delete
to authenticated
using (user_id = (select auth.uid()));

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

drop policy if exists "members can update own notification preferences" on public.group_memberships;
create policy "members can update own notification preferences"
on public.group_memberships for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

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

drop policy if exists "requesters can cancel pending join requests" on public.group_join_requests;
create policy "requesters can cancel pending join requests"
on public.group_join_requests for update
to authenticated
using (
  user_id = (select auth.uid())
  and status = 'pending'
)
with check (
  user_id = (select auth.uid())
  and status = 'rejected'
);

drop policy if exists "members can see group check-ins" on public.check_ins;
create policy "members can see group check-ins"
on public.check_ins for select
to authenticated
using (public.can_view_check_in(id));

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
using (public.can_view_check_in(check_in_id));

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

drop policy if exists "members can see comments for visible check-ins" on public.check_in_comments;
create policy "members can see comments for visible check-ins"
on public.check_in_comments for select
to authenticated
using (public.can_view_check_in(check_in_comments.check_in_id));

drop policy if exists "members can comment on visible check-ins" on public.check_in_comments;
create policy "members can comment on visible check-ins"
on public.check_in_comments for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_view_check_in(check_in_comments.check_in_id)
);

drop policy if exists "users can delete own comments" on public.check_in_comments;
drop policy if exists "users can delete own comments and comments on own check-ins" on public.check_in_comments;
create policy "users can delete own comments and comments on own check-ins"
on public.check_in_comments for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_check_in_owner(check_in_comments.check_in_id)
);

create or replace function public.get_global_beer_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer from public.check_ins;
$$;

grant execute on function public.get_global_beer_count() to authenticated;

alter table public.profiles add column if not exists avatar_cloudflare_image_id text;
alter table public.profiles add column if not exists avatar_image_width integer;
alter table public.profiles add column if not exists avatar_image_height integer;
alter table public.profiles add column if not exists avatar_blurhash text;

create or replace function public.get_global_user_leaderboard(limit_count integer default 100)
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  avatar_url text,
  avatar_cloudflare_image_id text,
  total_beers integer,
  check_in_count integer,
  rank integer,
  top_percent integer
)
language sql
security definer
set search_path = public
as $$
  with user_totals as (
    select
      p.id as user_id,
      p.display_name,
      p.avatar,
      p.avatar_url,
      p.avatar_cloudflare_image_id,
      coalesce(sum(ci.quantity), 0)::integer as total_beers,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id, p.display_name, p.avatar, p.avatar_url, p.avatar_cloudflare_image_id
  ),
  ranked as (
    select
      user_totals.*,
      rank() over (order by total_beers desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select
    ranked.user_id,
    ranked.display_name,
    ranked.avatar,
    ranked.avatar_url,
    ranked.avatar_cloudflare_image_id,
    ranked.total_beers,
    ranked.check_in_count,
    ranked.rank,
    case
      when ranked.rank <= 1 or ranked.total_users <= 1 then 1
      else greatest(1, least(100, ceil((((ranked.rank - 1)::numeric / nullif(ranked.total_users - 1, 0)) * 99) + 1)::integer))
    end as top_percent
  from ranked
  order by ranked.rank asc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
$$;

revoke all on function public.get_global_user_leaderboard(integer) from public;
grant execute on function public.get_global_user_leaderboard(integer) to authenticated;

create or replace function public.get_current_user_global_rank()
returns table (
  user_id uuid,
  total_beers integer,
  check_in_count integer,
  rank integer,
  total_users integer,
  top_percent integer
)
language sql
security definer
set search_path = public
as $$
  with user_totals as (
    select
      p.id as user_id,
      coalesce(sum(ci.quantity), 0)::integer as total_beers,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id
  ),
  ranked as (
    select
      user_totals.*,
      rank() over (order by total_beers desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select
    ranked.user_id,
    ranked.total_beers,
    ranked.check_in_count,
    ranked.rank,
    ranked.total_users,
    case
      when ranked.rank <= 1 or ranked.total_users <= 1 then 1
      else greatest(1, least(100, ceil((((ranked.rank - 1)::numeric / nullif(ranked.total_users - 1, 0)) * 99) + 1)::integer))
    end as top_percent
  from ranked
  where ranked.user_id = (select auth.uid());
$$;

revoke all on function public.get_current_user_global_rank() from public;
grant execute on function public.get_current_user_global_rank() to authenticated;

create or replace function public.get_group_member_profile(group_id_input uuid, target_user_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
  target_profile public.profiles%rowtype;
  viewer_can_access boolean;
  target_is_member boolean;
  all_time_beers integer;
  beers_in_group integer;
  group_count integer;
  group_rank integer;
  total_users integer;
  target_global_rank integer;
  percentile integer;
  points integer;
  next_level_xp integer := 500;
  level_number integer;
  recent_activity jsonb;
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  select * into target_group
  from public.groups
  where id = group_id_input;

  if target_group.id is null then
    return null;
  end if;

  viewer_can_access := target_group.privacy = 'Public' or exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = group_id_input
      and gm.user_id = (select auth.uid())
  );

  if not viewer_can_access then
    return null;
  end if;

  target_is_member := exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = group_id_input
      and gm.user_id = target_user_id_input
  );

  if not target_is_member then
    return null;
  end if;

  select * into target_profile
  from public.profiles
  where id = target_user_id_input;

  if target_profile.id is null then
    return null;
  end if;

  select coalesce(sum(ci.quantity), 0)::integer
  into all_time_beers
  from public.check_ins ci
  where ci.user_id = target_user_id_input;

  select coalesce(sum(ci.quantity), 0)::integer
  into beers_in_group
  from public.check_ins ci
  join public.check_in_groups cig on cig.check_in_id = ci.id
  where ci.user_id = target_user_id_input
    and cig.group_id = group_id_input;

  select count(*)::integer
  into group_count
  from public.group_memberships gm
  where gm.user_id = target_user_id_input;

  with member_totals as (
    select
      gm.user_id,
      coalesce(sum(ci.quantity), 0)::integer as beer_total
    from public.group_memberships gm
    left join public.check_in_groups cig on cig.group_id = gm.group_id
    left join public.check_ins ci on ci.id = cig.check_in_id and ci.user_id = gm.user_id
    where gm.group_id = group_id_input
    group by gm.user_id
  ),
  ranked as (
    select
      user_id,
      rank() over (order by beer_total desc, user_id asc)::integer as rank
    from member_totals
  )
  select rank into group_rank
  from ranked
  where user_id = target_user_id_input;

  with user_totals as (
    select
      p.id as user_id,
      coalesce(sum(ci.quantity), 0)::integer as beer_total,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id
  ),
  ranked as (
    select
      user_id,
      rank() over (order by beer_total desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select ranked.rank, ranked.total_users
  into target_global_rank, total_users
  from ranked
  where ranked.user_id = target_user_id_input;

  percentile := case
    when coalesce(target_global_rank, 1) <= 1 or coalesce(total_users, 1) <= 1 then 1
    else greatest(1, least(100, ceil((((target_global_rank - 1)::numeric / nullif(total_users - 1, 0)) * 99) + 1)::integer))
  end;
  points := all_time_beers * 25;
  level_number := floor(points::numeric / next_level_xp)::integer + 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', activity.id,
        'type', 'beer_log',
        'title', 'Logged a beer',
        'subtitle', activity.beer_name,
        'imageUrl', coalesce(activity.photo_thumbnail_url, activity.photo_url),
        'createdAt', activity.created_at
      )
      order by activity.created_at desc
    ),
    '[]'::jsonb
  )
  into recent_activity
  from (
    select ci.id, ci.beer_name, ci.photo_thumbnail_url, ci.photo_url, ci.created_at
    from public.check_ins ci
    join public.check_in_groups cig on cig.check_in_id = ci.id
    where ci.user_id = target_user_id_input
      and cig.group_id = group_id_input
    order by ci.created_at desc
    limit 3
  ) activity;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', target_profile.id,
      'displayName', target_profile.display_name,
      'avatar', target_profile.avatar,
      'avatarUrl', target_profile.avatar_url,
      'avatarCloudflareImageId', target_profile.avatar_cloudflare_image_id,
      'createdAt', target_profile.created_at
    ),
    'group', jsonb_build_object(
      'id', target_group.id,
      'name', target_group.name
    ),
    'level', jsonb_build_object(
      'label', 'Level ' || level_number || ' Pintly Collector',
      'currentXp', points % next_level_xp,
      'nextLevelXp', next_level_xp,
      'points', points,
      'percentile', percentile
    ),
    'stats', jsonb_build_object(
      'allTimeBeers', all_time_beers,
      'beersInThisGroup', beers_in_group,
      'groupCount', group_count,
      'badgeCount', 0,
      'groupRank', group_rank
    ),
    'recentActivity', recent_activity
  );
end;
$$;

revoke all on function public.get_group_member_profile(uuid, uuid) from public;
grant execute on function public.get_group_member_profile(uuid, uuid) to authenticated;

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

alter table public.profiles add column if not exists avatar_cloudflare_image_id text;
alter table public.profiles add column if not exists avatar_image_width integer;
alter table public.profiles add column if not exists avatar_image_height integer;
alter table public.profiles add column if not exists avatar_blurhash text;

alter table public.groups add column if not exists backdrop_cloudflare_image_id text;
alter table public.groups add column if not exists backdrop_image_width integer;
alter table public.groups add column if not exists backdrop_image_height integer;
alter table public.groups add column if not exists backdrop_blurhash text;

alter table public.check_ins add column if not exists photo_cloudflare_image_id text;
alter table public.check_ins add column if not exists photo_image_width integer;
alter table public.check_ins add column if not exists photo_image_height integer;
alter table public.check_ins add column if not exists photo_blurhash text;

create table if not exists public.image_uploads (
  cloudflare_image_id text primary key,
  image_type text not null check (image_type in ('beer_photo', 'profile_avatar', 'group_image')),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_id uuid references public.check_ins(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  width integer,
  height integer,
  blurhash text,
  delivery_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.image_uploads enable row level security;

drop policy if exists "owners can insert image metadata" on public.image_uploads;
create policy "owners can insert image metadata"
on public.image_uploads for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "owners and viewers can read image metadata" on public.image_uploads;
create policy "owners and viewers can read image metadata"
on public.image_uploads for select
to authenticated
using (
  owner_user_id = auth.uid()
  or (check_in_id is not null and public.can_view_check_in(check_in_id))
  or (
    group_id is not null
    and exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = image_uploads.group_id
        and gm.user_id = auth.uid()
    )
  )
);

drop policy if exists "owners can update image metadata" on public.image_uploads;
create policy "owners can update image metadata"
on public.image_uploads for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create index if not exists image_uploads_owner_user_id_idx on public.image_uploads(owner_user_id);
create index if not exists image_uploads_check_in_id_idx on public.image_uploads(check_in_id);
create index if not exists image_uploads_group_id_idx on public.image_uploads(group_id);
create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
create index if not exists push_tokens_enabled_idx on public.push_tokens(enabled) where enabled;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_id uuid references public.check_ins(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  reason text not null check (reason in ('harassment', 'hate', 'sexual_content', 'violence', 'spam', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.account_deletion_requests enable row level security;

grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, update on public.user_reports to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security invoker
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "users can read own blocks" on public.user_blocks;
create policy "users can read own blocks"
on public.user_blocks for select
to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "users can block others" on public.user_blocks;
create policy "users can block others"
on public.user_blocks for insert
to authenticated
with check (blocker_id = (select auth.uid()));

drop policy if exists "users can unblock others" on public.user_blocks;
create policy "users can unblock others"
on public.user_blocks for delete
to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "users can read own reports" on public.user_reports;
create policy "users can read own reports"
on public.user_reports for select
to authenticated
using (reporter_id = (select auth.uid()) or public.current_user_is_admin());

drop policy if exists "users can create own reports" on public.user_reports;
create policy "users can create own reports"
on public.user_reports for insert
to authenticated
with check (reporter_id = (select auth.uid()) and reporter_id <> reported_user_id);

drop policy if exists "admins can update reports" on public.user_reports;
create policy "admins can update reports"
on public.user_reports for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "users can read own deletion requests" on public.account_deletion_requests;
create policy "users can read own deletion requests"
on public.account_deletion_requests for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "users can request own account deletion" on public.account_deletion_requests;
create policy "users can request own account deletion"
on public.account_deletion_requests for insert
to authenticated
with check (user_id = (select auth.uid()));

create or replace function public.current_user_is_admin()
returns boolean
language sql
security invoker
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);
create index if not exists user_reports_status_created_at_idx on public.user_reports(status, created_at desc);
create index if not exists user_reports_reported_user_id_idx on public.user_reports(reported_user_id);
create index if not exists account_deletion_requests_user_id_idx on public.account_deletion_requests(user_id);
