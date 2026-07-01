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

-- TODO: Backfill existing Supabase Storage photos into Cloudflare Images in a controlled job:
-- 1. Select rows with *_storage_path or legacy *_url and null *_cloudflare_image_id.
-- 2. Download each object using a short-lived signed Supabase URL from a trusted server.
-- 3. Upload to Cloudflare Images, insert public.image_uploads metadata, then update the owning row.
-- 4. Verify rendering before deleting any Supabase Storage objects.

drop function if exists public.search_profiles_for_friends(text);

create function public.search_profiles_for_friends(search_input text)
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  avatar_url text,
  avatar_cloudflare_image_id text,
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
    p.avatar_cloudflare_image_id,
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
