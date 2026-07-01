alter table public.group_memberships
add column if not exists notifications_enabled boolean not null default true;

grant select, insert on public.group_memberships to authenticated;
grant update (notifications_enabled) on public.group_memberships to authenticated;

drop policy if exists "members can update own notification preferences" on public.group_memberships;
create policy "members can update own notification preferences"
on public.group_memberships for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
