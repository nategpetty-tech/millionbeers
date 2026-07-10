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

delete from public.check_in_groups cig
using public.check_ins ci,
      public.group_memberships gm
where cig.check_in_id = ci.id
  and cig.group_id = gm.group_id
  and gm.user_id = ci.user_id
  and ci.created_at < gm.created_at - interval '5 minutes';

insert into public.check_in_groups (check_in_id, group_id)
select ci.id, gm.group_id
from public.check_ins ci
join public.group_memberships gm on gm.user_id = ci.user_id
where ci.created_at >= gm.created_at - interval '5 minutes'
  and ci.created_at >= now() - interval '14 days'
on conflict (check_in_id, group_id) do nothing;
