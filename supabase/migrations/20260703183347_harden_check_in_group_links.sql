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

insert into public.check_in_groups (check_in_id, group_id)
select ci.id, gm.group_id
from public.check_ins ci
join public.group_memberships gm on gm.user_id = ci.user_id
where ci.created_at >= now() - interval '14 days'
on conflict (check_in_id, group_id) do nothing;
