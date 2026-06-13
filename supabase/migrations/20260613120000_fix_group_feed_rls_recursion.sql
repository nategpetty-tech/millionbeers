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

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_check_in_owner(uuid) from public;
revoke all on function public.can_view_check_in(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_check_in_owner(uuid) to authenticated;
grant execute on function public.can_view_check_in(uuid) to authenticated;

drop policy if exists "members can see group check-ins" on public.check_ins;
create policy "members can see group check-ins"
on public.check_ins for select
using (public.can_view_check_in(id));

drop policy if exists "friends can see each other check ins" on public.check_ins;

drop policy if exists "members can see check-in group links" on public.check_in_groups;
create policy "members can see check-in group links"
on public.check_in_groups for select
using (public.can_view_check_in(check_in_id));

drop policy if exists "friends can read check in group links" on public.check_in_groups;

drop policy if exists "members can see reactions for visible check-ins" on public.check_in_reactions;
create policy "members can see reactions for visible check-ins"
on public.check_in_reactions for select
using (public.can_view_check_in(check_in_id));

drop policy if exists "friends can read reaction counts" on public.check_in_reactions;
