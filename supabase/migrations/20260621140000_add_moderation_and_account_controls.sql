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
