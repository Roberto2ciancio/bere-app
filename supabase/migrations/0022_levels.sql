-- Livelli e punti: stesse regole di src/levels/levels.ts (pointsFromDays).
-- 1 punto ogni 100 ml fino all'obiettivo del giorno; +20 per giorno a obiettivo;
-- +50 per settimana con almeno 5 giorni a obiettivo, +150 se 7. Obiettivi sotto 1,5 L: niente bonus.
create function public.get_levels() returns table (user_id uuid, points int)
language sql stable security definer set search_path = '' as $$
  with daily as (
    select d.user_id, d.local_date as day, sum(d.amount_ml * d.hydration_pct / 100.0) as total_ml
    from public.drinks d
    group by d.user_id, d.local_date
  ),
  scored as (
    select user_id, day, total_ml, public.goal_for(user_id, day) as goal_ml from daily
  ),
  per_day as (
    select
      user_id,
      day,
      floor(least(total_ml, goal_ml) / 100)::int as pts,
      (total_ml >= goal_ml and goal_ml >= 1500) as met
    from scored
  ),
  per_week as (
    select user_id, date_trunc('week', day)::date as week, count(*) filter (where met) as met_days
    from per_day
    group by user_id, date_trunc('week', day)::date
  ),
  totals as (
    select user_id, sum(pts + case when met then 20 else 0 end)::int as points from per_day group by user_id
  ),
  bonuses as (
    select user_id, sum(case when met_days >= 7 then 150 when met_days >= 5 then 50 else 0 end)::int as points
    from per_week group by user_id
  )
  select p.id, coalesce(t.points, 0) + coalesce(b.points, 0)
  from public.profiles p
  left join totals t on t.user_id = p.id
  left join bonuses b on b.user_id = p.id;
$$;
revoke execute on function public.get_levels() from public, anon;
grant execute on function public.get_levels() to authenticated;
