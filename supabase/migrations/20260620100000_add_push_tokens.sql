create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
grant select, insert, update, delete on public.push_tokens to authenticated;

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

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
create index if not exists push_tokens_enabled_idx on public.push_tokens(enabled) where enabled;
