create or replace function public.find_group_by_invite_code(invite_code_input text)
returns table (
  id uuid,
  name text,
  description text,
  image text,
  backdrop_url text,
  backdrop_storage_path text,
  privacy text,
  goal integer,
  founder_id uuid,
  invite_code text,
  created_at timestamptz,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.description,
    g.image,
    g.backdrop_url,
    g.backdrop_storage_path,
    g.privacy,
    g.goal,
    g.founder_id,
    g.invite_code,
    g.created_at,
    count(gm.user_id)::bigint as member_count
  from public.groups g
  left join public.group_memberships gm on gm.group_id = g.id
  where upper(g.invite_code) = upper(invite_code_input)
  group by g.id;
$$;

revoke all on function public.find_group_by_invite_code(text) from public;
grant execute on function public.find_group_by_invite_code(text) to authenticated;
