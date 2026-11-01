-- Red Bull e segno Monster sono solo da mostrare: l'ordine resta deciso da giorni e serie.
drop function public.get_leaderboard(date);

create function public.get_leaderboard(week_start date)
returns table (user_id uuid, display_name text, avatar_path text, days_met int, streak int, redbulls int, monster_until timestamptz)
language sql stable security definer set search_path = '' as $$
  with days as (
    select (week_start + offs)::date as day from generate_series(0, 6) as offs
  ),
  daily as (
    select
      p.id,
      d.day,
      coalesce((
        select sum(dr.amount_ml) from public.drinks dr where dr.user_id = p.id and dr.local_date = d.day
      ), 0) as total_ml,
      coalesce((
        select g.goal_ml from public.goal_changes g
        where g.user_id = p.id and g.effective_from <= d.day
        order by g.effective_from desc limit 1
      ), 3000) as goal_ml
    from public.profiles p cross join days d
  ),
  met as (
    select id, day, day - (row_number() over (partition by id order by day))::int as island
    from daily
    where total_ml >= goal_ml and goal_ml >= 1500
  ),
  islands as (
    select id, count(*)::int as len from met group by id, island
  ),
  scores as (
    select id, sum(len)::int as days_met, max(len)::int as streak from islands group by id
  ),
  cans as (
    select c.user_id as id, count(*)::int as redbulls
    from public.caffeine_intakes c
    where c.kind = 'redbull' and c.local_date between week_start and week_start + 6
    group by c.user_id
  ),
  -- L'orario arriva dal telefono: con least() un orario nel futuro non allunga il segno oltre un'ora.
  marks as (
    select c.user_id as id, least(max(c.taken_at), now()) + interval '1 hour' as monster_until
    from public.caffeine_intakes c
    where c.kind = 'monster' and c.taken_at > now() - interval '1 hour'
    group by c.user_id
  )
  select p.id, p.display_name, p.avatar_path, coalesce(s.days_met, 0), coalesce(s.streak, 0), coalesce(c.redbulls, 0), m.monster_until
  from public.profiles p
    left join scores s on s.id = p.id
    left join cans c on c.id = p.id
    left join marks m on m.id = p.id
  order by 4 desc, 5 desc, 2 asc;
$$;
revoke execute on function public.get_leaderboard(date) from public, anon;
grant execute on function public.get_leaderboard(date) to authenticated;
