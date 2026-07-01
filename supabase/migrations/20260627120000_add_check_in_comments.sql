create table if not exists public.check_in_comments (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.check_in_comments enable row level security;

grant select, insert, delete on public.check_in_comments to authenticated;

create index if not exists check_in_comments_check_in_id_created_at_idx
on public.check_in_comments(check_in_id, created_at);

create index if not exists check_in_comments_user_id_idx
on public.check_in_comments(user_id);

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
