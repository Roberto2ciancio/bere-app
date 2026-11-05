-- Fascia attiva: l'obiettivo si divide solo sulle ore in cui l'utente beve. Spenta di default.
alter table public.profiles
  add column active_split boolean not null default false,
  add column active_start_min int not null default 480 check (active_start_min between 0 and 1440),
  add column active_end_min int not null default 1080 check (active_end_min between 0 and 1440),
  add constraint profiles_active_hours_check check (active_end_min - active_start_min >= 60);

-- Come prima, più quanto serve per dividere l'obiettivo sulla fascia attiva:
-- la fascia, quanto l'utente ha bevuto oggi e il suo obiettivo di oggi.
drop function public.reminder_rows();
create function public.reminder_rows()
returns table (
  schedule_time_id uuid,
  user_id uuid,
  minutes int,
  weekdays int[],
  tz text,
  drink_ml int,
  created_at timestamptz,
  subscriptions jsonb,
  goal_reached boolean,
  active_split boolean,
  active_start_min int,
  active_end_min int,
  drunk_ml int,
  goal_ml int
)
language sql stable security definer set search_path = '' as $$
  select
    t.id,
    s.user_id,
    t.minutes,
    s.weekdays,
    p.tz,
    p.drink_ml,
    t.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', ps.id, 'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
      from public.push_subscriptions ps
      where ps.user_id = s.user_id
    ), '[]'::jsonb),
    p.stop_at_goal and today.drunk_ml >= today.goal_ml,
    p.active_split,
    p.active_start_min,
    p.active_end_min,
    round(today.drunk_ml)::int,
    today.goal_ml
  from public.schedule_times t
  join public.schedules s on s.id = t.schedule_id
  join public.profiles p on p.id = s.user_id
  cross join lateral (
    select
      coalesce((
        select sum(d.amount_ml * d.hydration_pct / 100.0) from public.drinks d
        where d.user_id = s.user_id and d.local_date = (now() at time zone p.tz)::date
      ), 0) as drunk_ml,
      coalesce((
        select g.goal_ml from public.goal_changes g
        where g.user_id = s.user_id and g.effective_from <= (now() at time zone p.tz)::date
        order by g.effective_from desc limit 1
      ), 3000) as goal_ml
  ) today
  where s.enabled;
$$;
revoke execute on function public.reminder_rows() from public, anon, authenticated;
grant execute on function public.reminder_rows() to service_role;
