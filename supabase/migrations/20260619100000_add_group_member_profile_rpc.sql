create or replace function public.get_group_member_profile(group_id_input uuid, target_user_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
  target_profile public.profiles%rowtype;
  viewer_can_access boolean;
  target_is_member boolean;
  all_time_beers integer;
  beers_in_group integer;
  group_count integer;
  group_rank integer;
  total_users integer;
  target_global_rank integer;
  percentile integer;
  points integer;
  next_level_xp integer := 500;
  level_number integer;
  recent_activity jsonb;
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  select * into target_group
  from public.groups
  where id = group_id_input;

  if target_group.id is null then
    return null;
  end if;

  viewer_can_access := target_group.privacy = 'Public' or exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = group_id_input
      and gm.user_id = (select auth.uid())
  );

  if not viewer_can_access then
    return null;
  end if;

  target_is_member := exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = group_id_input
      and gm.user_id = target_user_id_input
  );

  if not target_is_member then
    return null;
  end if;

  select * into target_profile
  from public.profiles
  where id = target_user_id_input;

  if target_profile.id is null then
    return null;
  end if;

  select coalesce(sum(ci.quantity), 0)::integer
  into all_time_beers
  from public.check_ins ci
  where ci.user_id = target_user_id_input;

  select coalesce(sum(ci.quantity), 0)::integer
  into beers_in_group
  from public.check_ins ci
  join public.check_in_groups cig on cig.check_in_id = ci.id
  where ci.user_id = target_user_id_input
    and cig.group_id = group_id_input;

  select count(*)::integer
  into group_count
  from public.group_memberships gm
  where gm.user_id = target_user_id_input;

  with member_totals as (
    select
      gm.user_id,
      coalesce(sum(ci.quantity), 0)::integer as beer_total
    from public.group_memberships gm
    left join public.check_in_groups cig on cig.group_id = gm.group_id
    left join public.check_ins ci on ci.id = cig.check_in_id and ci.user_id = gm.user_id
    where gm.group_id = group_id_input
    group by gm.user_id
  ),
  ranked as (
    select
      user_id,
      rank() over (order by beer_total desc, user_id asc)::integer as rank
    from member_totals
  )
  select rank into group_rank
  from ranked
  where user_id = target_user_id_input;

  with user_totals as (
    select
      p.id as user_id,
      coalesce(sum(ci.quantity), 0)::integer as beer_total,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id
  ),
  ranked as (
    select
      user_id,
      rank() over (order by beer_total desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select ranked.rank, ranked.total_users
  into target_global_rank, total_users
  from ranked
  where ranked.user_id = target_user_id_input;

  percentile := case
    when coalesce(target_global_rank, 1) <= 1 or coalesce(total_users, 1) <= 1 then 1
    else greatest(1, least(100, ceil((((target_global_rank - 1)::numeric / nullif(total_users - 1, 0)) * 99) + 1)::integer))
  end;
  points := all_time_beers * 25;
  level_number := floor(points::numeric / next_level_xp)::integer + 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', activity.id,
        'type', 'beer_log',
        'title', 'Logged a beer',
        'subtitle', activity.beer_name,
        'imageUrl', coalesce(activity.photo_thumbnail_url, activity.photo_url),
        'createdAt', activity.created_at
      )
      order by activity.created_at desc
    ),
    '[]'::jsonb
  )
  into recent_activity
  from (
    select ci.id, ci.beer_name, ci.photo_thumbnail_url, ci.photo_url, ci.created_at
    from public.check_ins ci
    join public.check_in_groups cig on cig.check_in_id = ci.id
    where ci.user_id = target_user_id_input
      and cig.group_id = group_id_input
    order by ci.created_at desc
    limit 3
  ) activity;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', target_profile.id,
      'displayName', target_profile.display_name,
      'avatar', target_profile.avatar,
      'avatarUrl', target_profile.avatar_url,
      'avatarCloudflareImageId', target_profile.avatar_cloudflare_image_id,
      'createdAt', target_profile.created_at
    ),
    'group', jsonb_build_object(
      'id', target_group.id,
      'name', target_group.name
    ),
    'level', jsonb_build_object(
      'label', 'Level ' || level_number || ' Pintly Collector',
      'currentXp', points % next_level_xp,
      'nextLevelXp', next_level_xp,
      'points', points,
      'percentile', percentile
    ),
    'stats', jsonb_build_object(
      'allTimeBeers', all_time_beers,
      'beersInThisGroup', beers_in_group,
      'groupCount', group_count,
      'badgeCount', 0,
      'groupRank', group_rank
    ),
    'recentActivity', recent_activity
  );
end;
$$;

revoke all on function public.get_group_member_profile(uuid, uuid) from public;
grant execute on function public.get_group_member_profile(uuid, uuid) to authenticated;
