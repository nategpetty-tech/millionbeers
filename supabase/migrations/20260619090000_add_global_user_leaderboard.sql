create or replace function public.get_global_user_leaderboard(limit_count integer default 100)
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  avatar_url text,
  avatar_cloudflare_image_id text,
  total_beers integer,
  check_in_count integer,
  rank integer,
  top_percent integer
)
language sql
security definer
set search_path = public
as $$
  with user_totals as (
    select
      p.id as user_id,
      p.display_name,
      p.avatar,
      p.avatar_url,
      p.avatar_cloudflare_image_id,
      coalesce(sum(ci.quantity), 0)::integer as total_beers,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id, p.display_name, p.avatar, p.avatar_url, p.avatar_cloudflare_image_id
  ),
  ranked as (
    select
      user_totals.*,
      rank() over (order by total_beers desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select
    ranked.user_id,
    ranked.display_name,
    ranked.avatar,
    ranked.avatar_url,
    ranked.avatar_cloudflare_image_id,
    ranked.total_beers,
    ranked.check_in_count,
    ranked.rank,
    case
      when ranked.rank <= 1 or ranked.total_users <= 1 then 1
      else greatest(1, least(100, ceil((((ranked.rank - 1)::numeric / nullif(ranked.total_users - 1, 0)) * 99) + 1)::integer))
    end as top_percent
  from ranked
  order by ranked.rank asc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
$$;

revoke all on function public.get_global_user_leaderboard(integer) from public;
grant execute on function public.get_global_user_leaderboard(integer) to authenticated;

create or replace function public.get_current_user_global_rank()
returns table (
  user_id uuid,
  total_beers integer,
  check_in_count integer,
  rank integer,
  total_users integer,
  top_percent integer
)
language sql
security definer
set search_path = public
as $$
  with user_totals as (
    select
      p.id as user_id,
      coalesce(sum(ci.quantity), 0)::integer as total_beers,
      count(ci.id)::integer as check_in_count
    from public.profiles p
    left join public.check_ins ci on ci.user_id = p.id
    group by p.id
  ),
  ranked as (
    select
      user_totals.*,
      rank() over (order by total_beers desc, check_in_count desc, user_id asc)::integer as rank,
      count(*) over ()::integer as total_users
    from user_totals
  )
  select
    ranked.user_id,
    ranked.total_beers,
    ranked.check_in_count,
    ranked.rank,
    ranked.total_users,
    case
      when ranked.rank <= 1 or ranked.total_users <= 1 then 1
      else greatest(1, least(100, ceil((((ranked.rank - 1)::numeric / nullif(ranked.total_users - 1, 0)) * 99) + 1)::integer))
    end as top_percent
  from ranked
  where ranked.user_id = (select auth.uid());
$$;

revoke all on function public.get_current_user_global_rank() from public;
grant execute on function public.get_current_user_global_rank() to authenticated;
