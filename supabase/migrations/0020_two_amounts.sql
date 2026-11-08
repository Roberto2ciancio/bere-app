-- Due quantità nella notifica: chi lo sceglie dal Profilo riceve «Bevuto 200 ml» e «Bevuto 500 ml» nel promemoria.
-- Su Android le notifiche hanno al massimo due pulsanti, quindi è una scelta: le due quantità oppure «Bevuto ✓» e «Tra 15 min».

alter table public.profiles
  add column push_amounts boolean not null default false;

-- «Bevuto» dalla notifica con una quantità scelta. Senza quantità vale quella del profilo, come prima:
-- i service worker già installati continuano a chiamarla con il solo id del promemoria.
drop function public.drink_from_push(uuid);
create function public.drink_from_push(p_log_id uuid, p_amount_ml int default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_ml int;
  v_tz text;
  v_units text;
  v_today date;
  v_added boolean;
  v_drunk numeric;
begin
  if p_amount_ml is not null and p_amount_ml not between 1 and 2000 then
    return json_build_object('ok', false);
  end if;

  select l.user_id into v_user from public.push_log l
  where l.id = p_log_id and l.scheduled_at > now() - interval '24 hours';
  if v_user is null then
    return json_build_object('ok', false);
  end if;

  select coalesce(p_amount_ml, p.drink_ml), p.tz, p.units into v_ml, v_tz, v_units from public.profiles p where p.id = v_user;
  v_today := (now() at time zone v_tz)::date;

  -- client_id = id del promemoria: toccare due volte (anche due pulsanti diversi) non segna due bevute.
  insert into public.drinks (user_id, client_id, amount_ml, drunk_at, local_date)
  values (v_user, p_log_id, v_ml, now(), v_today)
  on conflict (user_id, client_id) do nothing;
  v_added := found;
  if not v_added then
    select d.amount_ml into v_ml from public.drinks d where d.user_id = v_user and d.client_id = p_log_id;
  end if;

  select coalesce(sum(d.amount_ml * d.hydration_pct / 100.0), 0) into v_drunk
  from public.drinks d where d.user_id = v_user and d.local_date = v_today;

  return json_build_object(
    'ok', true,
    'added', v_added,
    'amount_ml', v_ml,
    'drunk_ml', round(v_drunk)::int,
    'goal_ml', public.goal_for(v_user, v_today),
    'units', v_units
  );
end;
$$;
revoke execute on function public.drink_from_push(uuid, int) from public;
grant execute on function public.drink_from_push(uuid, int) to anon, authenticated;

-- I promemoria portano la scelta dei pulsanti e le unità, per scrivere le quantità sui pulsanti.
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
  goal_ml int,
  push_amounts boolean,
  units text
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
    today.goal_ml,
    p.push_amounts,
    p.units
  from public.schedule_times t
  join public.schedules s on s.id = t.schedule_id
  join public.profiles p on p.id = s.user_id
  cross join lateral (
    select
      coalesce((
        select sum(d.amount_ml * d.hydration_pct / 100.0) from public.drinks d
        where d.user_id = s.user_id and d.local_date = (now() at time zone p.tz)::date
      ), 0) as drunk_ml,
      public.goal_for(s.user_id, (now() at time zone p.tz)::date) as goal_ml
  ) today
  where s.enabled;
$$;
revoke execute on function public.reminder_rows() from public, anon, authenticated;
grant execute on function public.reminder_rows() to service_role;

-- Anche il promemoria rimandato ha gli stessi pulsanti dell'originale.
drop function public.take_snoozes(timestamptz);
create function public.take_snoozes(p_now timestamptz default now())
returns table (log_id uuid, user_id uuid, drink_ml int, subscriptions json, push_amounts boolean, units text)
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('take_snoozes', 0));
  return query
  with due as (
    update public.push_snoozes s set sent_at = p_now
    where s.sent_at is null and s.due_at <= p_now
    returning s.log_id, s.user_id, s.due_at
  )
  select d.log_id, d.user_id, p.drink_ml,
    (select json_agg(json_build_object('id', ps.id, 'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
     from public.push_subscriptions ps where ps.user_id = d.user_id),
    p.push_amounts, p.units
  from due d
  join public.profiles p on p.id = d.user_id
  where d.due_at > p_now - interval '30 minutes'
    and not exists (select 1 from public.drinks dr where dr.user_id = d.user_id and dr.client_id = d.log_id)
    and not public.is_paused(d.user_id, p_now)
    and not (
      p.stop_at_goal and public.goal_for(d.user_id, (p_now at time zone p.tz)::date) <= coalesce((
        select sum(dr.amount_ml * dr.hydration_pct / 100.0) from public.drinks dr
        where dr.user_id = d.user_id and dr.local_date = (p_now at time zone p.tz)::date
      ), 0)
    );
end;
$$;
revoke execute on function public.take_snoozes(timestamptz) from public, anon, authenticated;
grant execute on function public.take_snoozes(timestamptz) to service_role;
