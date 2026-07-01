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

alter table public.venues enable row level security;

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

alter table public.check_ins add column if not exists venue_id uuid references public.venues(id) on delete set null;
alter table public.check_ins add column if not exists venue_provider text;
alter table public.check_ins add column if not exists venue_provider_place_id text;
alter table public.check_ins add column if not exists venue_name text;
alter table public.check_ins add column if not exists venue_category text;
alter table public.check_ins add column if not exists venue_latitude double precision;
alter table public.check_ins add column if not exists venue_longitude double precision;
alter table public.check_ins add column if not exists venue_address text;
alter table public.check_ins add column if not exists venue_distance_meters integer;
alter table public.check_ins add column if not exists venue_confirmation_status text not null default 'skipped';

alter table public.check_ins alter column venue_confirmation_status set default 'skipped';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_venue_confirmation_status_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_venue_confirmation_status_values check (venue_confirmation_status in ('confirmed', 'skipped', 'unavailable'));
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

create index if not exists venues_provider_place_id_idx on public.venues(provider, provider_place_id);
create index if not exists check_ins_venue_id_idx on public.check_ins(venue_id);
create index if not exists check_ins_venue_provider_place_id_idx on public.check_ins(venue_provider, venue_provider_place_id);
