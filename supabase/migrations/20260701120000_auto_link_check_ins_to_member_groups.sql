create or replace function public.auto_link_check_in_to_member_groups()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists auto_link_check_in_to_member_groups_on_insert on public.check_ins;
create trigger auto_link_check_in_to_member_groups_on_insert
after insert on public.check_ins
for each row
execute function public.auto_link_check_in_to_member_groups();
