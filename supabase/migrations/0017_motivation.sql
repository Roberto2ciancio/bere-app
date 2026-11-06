-- Motivazione:
-- 1. obiettivo che si adatta: più acqua nei giorni caldi o con un allenamento (goal_boosts);
-- 2. riepilogo serale quando la giornata è andata male;
-- 3. resoconto della settimana ogni lunedì.

alter table public.profiles
  add column heat_boost boolean not null default false,
  add column city_name text check (char_length(city_name) <= 80),
  add column city_lat double precision check (city_lat between -90 and 90),
  add column city_lon double precision check (city_lon between -180 and 180),
  add column evening_summary boolean not null default true,
  add column weekly_report boolean not null default true;

-- Un aumento per tipo e per giorno: «heat» lo calcola l'app dal meteo, «workout» lo segna l'utente.
create table public.goal_boosts (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  kind text not null check (kind in ('heat', 'workout')),
  extra_ml int not null check (extra_ml between 1 and 2000),
  note text check (char_length(note) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, local_date, kind)
);
alter table public.goal_boosts enable row level security;
create policy goal_boosts_own on public.goal_boosts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- L'obiettivo di un giorno: quello scelto più gli aumenti di quel giorno. Usato ovunque si confronta il bevuto.
create function public.goal_for(p_user uuid, p_day date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select g.goal_ml from public.goal_changes g
    where g.user_id = p_user and g.effective_from <= p_day
    order by g.effective_from desc limit 1
  ), 3000) + coalesce((
    select sum(b.extra_ml)::int from public.goal_boosts b where b.user_id = p_user and b.local_date = p_day
  ), 0);
$$;
revoke execute on function public.goal_for(uuid, date) from public, anon, authenticated;

-- Promemoria: la quantità ricalcolata della fascia attiva tiene conto degli aumenti.
create or replace function public.reminder_rows()
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
      public.goal_for(s.user_id, (now() at time zone p.tz)::date) as goal_ml
  ) today
  where s.enabled;
$$;
revoke execute on function public.reminder_rows() from public, anon, authenticated;
grant execute on function public.reminder_rows() to service_role;

-- Classifica: un giorno conta se si raggiunge l'obiettivo di quel giorno, aumenti compresi.
create or replace function public.get_leaderboard(week_start date)
returns table (user_id uuid, display_name text, avatar_path text, days_met int, streak int)
language sql stable security definer set search_path = '' as $$
  with days as (
    select (week_start + offs)::date as day from generate_series(0, 6) as offs
  ),
  daily as (
    select
      p.id,
      d.day,
      coalesce((
        select sum(dr.amount_ml * dr.hydration_pct / 100.0) from public.drinks dr where dr.user_id = p.id and dr.local_date = d.day
      ), 0) as total_ml,
      public.goal_for(p.id, d.day) as goal_ml
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
  )
  select p.id, p.display_name, p.avatar_path, coalesce(s.days_met, 0), coalesce(s.streak, 0)
  from public.profiles p left join scores s on s.id = p.id
  order by 4 desc, 5 desc, 2 asc;
$$;
revoke execute on function public.get_leaderboard(date) from public, anon;
grant execute on function public.get_leaderboard(date) to authenticated;

-- Dopo ogni bevuta: come prima, con l'obiettivo di oggi aumenti compresi.
create or replace function public.after_drink() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text;
  v_share boolean;
  v_today date;
  v_total numeric;
  v_goal int;
begin
  update public.profiles set last_seen_at = greatest(coalesce(last_seen_at, now()), now())
  where id = new.user_id
  returning tz, share_goal into v_tz, v_share;
  if v_tz is null or not v_share then return null; end if;

  v_today := (now() at time zone v_tz)::date;
  if new.local_date <> v_today then return null; end if;
  if exists (select 1 from public.goal_events where user_id = new.user_id and local_date = v_today) then return null; end if;

  select coalesce(sum(d.amount_ml * d.hydration_pct / 100.0), 0) into v_total
  from public.drinks d where d.user_id = new.user_id and d.local_date = v_today;
  v_goal := public.goal_for(new.user_id, v_today);

  if v_goal >= 1500 and v_total >= v_goal then
    insert into public.goal_events (user_id, local_date) values (new.user_id, v_today) on conflict do nothing;
  end if;
  return null;
end;
$$;

-- «Bevuto ✓»: il totale restituito si confronta con l'obiettivo di oggi, aumenti compresi.
create or replace function public.drink_from_push(p_log_id uuid) returns json
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
  select l.user_id into v_user from public.push_log l
  where l.id = p_log_id and l.scheduled_at > now() - interval '24 hours';
  if v_user is null then
    return json_build_object('ok', false);
  end if;

  select p.drink_ml, p.tz, p.units into v_ml, v_tz, v_units from public.profiles p where p.id = v_user;
  v_today := (now() at time zone v_tz)::date;

  insert into public.drinks (user_id, client_id, amount_ml, drunk_at, local_date)
  values (v_user, p_log_id, v_ml, now(), v_today)
  on conflict (user_id, client_id) do nothing;
  v_added := found;

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

-- Riepilogo serale: una volta al giorno, a fine fascia attiva (o alle 21), solo se è mancato parecchio
-- (almeno 500 ml e almeno un quinto dell'obiettivo) e solo a chi usa l'app: gli assenti hanno già il loro promemoria.
create table public.evening_summaries (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
alter table public.evening_summaries enable row level security;

create function public.take_evening_summaries(p_now timestamptz default now())
returns table (user_id uuid, display_name text, drunk_ml int, goal_ml int, subscriptions json)
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('take_evening_summaries', 0));
  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      (p_now at time zone p.tz)::date as day,
      coalesce((
        select sum(d.amount_ml * d.hydration_pct / 100.0) from public.drinks d
        where d.user_id = p.id and d.local_date = (p_now at time zone p.tz)::date
      ), 0) as drunk,
      public.goal_for(p.id, (p_now at time zone p.tz)::date) as goal,
      extract(hour from p_now at time zone p.tz) * 60 + extract(minute from p_now at time zone p.tz) as minute,
      case when p.active_split then least(p.active_end_min, 1380) else 1260 end as at_minute
    from public.profiles p
    where p.evening_summary
      and p.last_seen_at > p_now - interval '1 day'
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  picked as (
    select * from candidates c
    where c.minute between c.at_minute and c.at_minute + 29
      and c.goal - c.drunk >= greatest(500, c.goal * 0.2)
      and not exists (select 1 from public.evening_summaries e where e.user_id = c.id and e.local_date = c.day)
  ),
  recorded as (
    insert into public.evening_summaries (user_id, local_date, sent_at)
    select id, day, p_now from picked
    returning public.evening_summaries.user_id
  )
  select pk.id, pk.display_name, round(pk.drunk)::int, pk.goal,
    (select json_agg(json_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from public.push_subscriptions s where s.user_id = pk.id)
  from picked pk join recorded r on r.user_id = pk.id;
end;
$$;
revoke execute on function public.take_evening_summaries(timestamptz) from public, anon, authenticated;
grant execute on function public.take_evening_summaries(timestamptz) to service_role;

-- Resoconto del lunedì sulla settimana appena finita: media, giorni a obiettivo e posto in classifica.
-- Dalle 9 (o dall'inizio della fascia attiva, se più tardi) a mezzogiorno, a chi ha usato l'app nelle ultime due settimane.
create table public.weekly_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.weekly_reports enable row level security;

create function public.take_weekly_reports(p_now timestamptz default now())
returns table (
  user_id uuid, display_name text, week_start date, days_met int, average_ml int, rank int, players int, subscriptions json
)
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('take_weekly_reports', 0));
  return query
  with candidates as (
    select p.id, p.display_name, (p_now at time zone p.tz)::date - 7 as last_week
    from public.profiles p
    where p.weekly_report
      and extract(isodow from p_now at time zone p.tz) = 1
      and extract(hour from p_now at time zone p.tz) * 60 + extract(minute from p_now at time zone p.tz)
        between greatest(540, case when p.active_split then p.active_start_min else 0 end) and 719
      and p.last_seen_at > p_now - interval '14 days'
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
      and not exists (
        select 1 from public.weekly_reports w where w.user_id = p.id and w.week_start = (p_now at time zone p.tz)::date - 7
      )
  ),
  stats as (
    select
      c.id,
      c.display_name,
      c.last_week,
      lb.days_met,
      (
        select round(coalesce(sum(d.amount_ml * d.hydration_pct / 100.0), 0) / 7)::int from public.drinks d
        where d.user_id = c.id and d.local_date between c.last_week and c.last_week + 6
      ) as average_ml,
      (
        select 1 + count(*)::int from public.get_leaderboard(c.last_week) o
        where o.days_met > lb.days_met or (o.days_met = lb.days_met and o.streak > lb.streak)
      ) as rank,
      (select count(*)::int from public.get_leaderboard(c.last_week)) as players
    from candidates c
    join lateral (select l.days_met, l.streak from public.get_leaderboard(c.last_week) l where l.user_id = c.id) lb on true
  ),
  recorded as (
    insert into public.weekly_reports (user_id, week_start, sent_at)
    select id, last_week, p_now from stats
    returning public.weekly_reports.user_id
  )
  select st.id, st.display_name, st.last_week, st.days_met, st.average_ml, st.rank, st.players,
    (select json_agg(json_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from public.push_subscriptions s where s.user_id = st.id)
  from stats st join recorded r on r.user_id = st.id;
end;
$$;
revoke execute on function public.take_weekly_reports(timestamptz) from public, anon, authenticated;
grant execute on function public.take_weekly_reports(timestamptz) to service_role;
