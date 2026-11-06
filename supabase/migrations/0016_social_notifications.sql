-- Notifiche sociali:
-- 1. chi raggiunge l'obiettivo avvisa gli altri, che possono mandargli i complimenti;
-- 2. chi non apre l'app da un giorno riceve un promemoria con il suo nome (dopo 1, 3 e 7 giorni, poi basta).

alter table public.profiles
  add column share_goal boolean not null default true,
  add column friend_goal_alerts boolean not null default true,
  add column nudge_inactive boolean not null default true,
  add column last_seen_at timestamptz;

-- Un evento al giorno per persona: nasce quando il totale di oggi supera l'obiettivo.
create table public.goal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  alerted_at timestamptz,
  unique (user_id, local_date)
);

-- Una riga per amico avvisato: il suo id fa da biglietto per «Complimenti» dalla notifica.
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.goal_events (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  cheered_at timestamptz,
  unique (event_id, from_user)
);

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index nudges_user_idx on public.nudges (user_id, sent_at desc);

-- Solo le funzioni qui sotto le leggono e scrivono.
alter table public.goal_events enable row level security;
alter table public.cheers enable row level security;
alter table public.nudges enable row level security;

-- Dopo ogni bevuta: la persona è attiva, e se oggi ha appena superato l'obiettivo nasce l'evento.
create function public.after_drink() returns trigger
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
  -- Le bevute aggiunte a giorni passati non avvisano nessuno.
  if new.local_date <> v_today then return null; end if;
  if exists (select 1 from public.goal_events where user_id = new.user_id and local_date = v_today) then return null; end if;

  select coalesce(sum(d.amount_ml * d.hydration_pct / 100.0), 0) into v_total
  from public.drinks d where d.user_id = new.user_id and d.local_date = v_today;
  select coalesce((
    select g.goal_ml from public.goal_changes g
    where g.user_id = new.user_id and g.effective_from <= v_today
    order by g.effective_from desc limit 1
  ), 3000) into v_goal;

  -- Come in classifica: valgono solo obiettivi da 1,5 L in su.
  if v_goal >= 1500 and v_total >= v_goal then
    insert into public.goal_events (user_id, local_date) values (new.user_id, v_today) on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger drinks_after_insert after insert on public.drinks
  for each row execute function public.after_drink();

-- L'app lo chiama all'apertura.
create function public.touch_last_seen() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- p_now serve ai test: il job usa l'ora attuale.
-- Per il job ogni minuto: prende gli eventi nuovi (una volta sola) e restituisce un avviso per ogni amico
-- che li vuole, ha un dispositivo ed è sveglio (dalle 8 alle 22 nel suo fuso).
create function public.take_goal_alerts(p_now timestamptz default now())
returns table (event_id uuid, achiever text, to_user uuid, token uuid, subscriptions json)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with ev as (
    update public.goal_events e set alerted_at = p_now
    where e.alerted_at is null and e.created_at > p_now - interval '1 hour'
    returning e.id, e.user_id
  ),
  targets as (
    select ev.id as ev_id, p.id as friend
    from ev join public.profiles p on p.id <> ev.user_id
    where p.friend_goal_alerts
      and extract(hour from p_now at time zone p.tz) between 8 and 21
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  tokens as (
    insert into public.cheers (event_id, from_user)
    select ev_id, friend from targets
    on conflict on constraint cheers_event_id_from_user_key do update set created_at = public.cheers.created_at
    returning public.cheers.id, public.cheers.event_id, public.cheers.from_user
  )
  select t.event_id, a.display_name, t.from_user, t.id,
    (select json_agg(json_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from public.push_subscriptions s where s.user_id = t.from_user)
  from tokens t
  join ev on ev.id = t.event_id
  join public.profiles a on a.id = ev.user_id;
end;
$$;
revoke execute on function public.take_goal_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.take_goal_alerts(timestamptz) to service_role;

-- «Complimenti» dalla notifica: il biglietto vale una volta, entro 24 ore.
create function public.claim_cheer_token(p_token uuid)
returns table (to_user uuid, from_name text)
language sql security definer set search_path = '' as $$
  update public.cheers c set cheered_at = now()
  from public.goal_events e
  where c.id = p_token and c.cheered_at is null and e.id = c.event_id and e.created_at > now() - interval '24 hours'
  returning e.user_id, (select p.display_name from public.profiles p where p.id = c.from_user);
$$;
revoke execute on function public.claim_cheer_token(uuid) from public, anon, authenticated;
grant execute on function public.claim_cheer_token(uuid) to service_role;

-- «Complimenti» dalla classifica: solo a chi ha raggiunto l'obiettivo oggi, una volta per persona.
create function public.claim_cheer(p_from uuid, p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
begin
  if p_from = p_to then return 'self'; end if;
  select e.id into v_event
  from public.goal_events e join public.profiles p on p.id = e.user_id
  where e.user_id = p_to and e.local_date = (now() at time zone p.tz)::date;
  if v_event is null then return 'no-goal'; end if;
  insert into public.cheers (event_id, from_user, cheered_at) values (v_event, p_from, now())
  on conflict on constraint cheers_event_id_from_user_key do update set cheered_at = now()
  where public.cheers.cheered_at is null;
  return case when found then 'ok' else 'already' end;
end;
$$;
revoke execute on function public.claim_cheer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_cheer(uuid, uuid) to service_role;

-- Per la classifica: chi ha raggiunto l'obiettivo oggi, e se gli ho già fatto i complimenti.
create function public.cheerable_today()
returns table (user_id uuid, cheered boolean)
language sql stable security definer set search_path = '' as $$
  select e.user_id, exists (
    select 1 from public.cheers c where c.event_id = e.id and c.from_user = auth.uid() and c.cheered_at is not null
  )
  from public.goal_events e join public.profiles p on p.id = e.user_id
  where e.local_date = (now() at time zone p.tz)::date and e.user_id <> auth.uid();
$$;
revoke execute on function public.cheerable_today() from public, anon;
grant execute on function public.cheerable_today() to authenticated;

-- Per il job ogni minuto: chi non si vede da almeno 1, 3 o 7 giorni (un promemoria per soglia, poi basta),
-- di giorno nel suo fuso (dalle 10 alle 20, e dentro la fascia attiva se l'ha accesa).
create function public.take_inactivity_nudges(p_now timestamptz default now())
returns table (user_id uuid, display_name text, days_away int, stage int, goal_ml int, subscriptions json)
language plpgsql security definer set search_path = '' as $$
begin
  -- Due job sovrapposti non devono mandare lo stesso promemoria due volte.
  perform pg_advisory_xact_lock(hashtextextended('take_inactivity_nudges', 0));
  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      floor(extract(epoch from p_now - p.last_seen_at) / 86400)::int as away,
      (select count(*) from public.nudges n where n.user_id = p.id and n.sent_at > p.last_seen_at)::int as sent,
      coalesce((
        select g.goal_ml from public.goal_changes g
        where g.user_id = p.id and g.effective_from <= (p_now at time zone p.tz)::date
        order by g.effective_from desc limit 1
      ), 3000) as goal
    from public.profiles p
    where p.nudge_inactive
      and p.last_seen_at is not null
      and p.last_seen_at < p_now - interval '1 day'
      and extract(hour from p_now at time zone p.tz) between 10 and 19
      and (not p.active_split or (
        extract(hour from p_now at time zone p.tz) * 60 + extract(minute from p_now at time zone p.tz)
        between p.active_start_min and p.active_end_min - 1
      ))
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
      and not exists (select 1 from public.nudges n where n.user_id = p.id and n.sent_at > p_now - interval '20 hours')
  ),
  picked as (
    select * from candidates c where c.sent < 3 and c.away >= (array[1, 3, 7])[c.sent + 1]
  ),
  recorded as (
    insert into public.nudges (user_id, sent_at) select id, p_now from picked returning public.nudges.user_id
  )
  select pk.id, pk.display_name, pk.away, pk.sent, pk.goal,
    (select json_agg(json_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from public.push_subscriptions s where s.user_id = pk.id)
  from picked pk join recorded r on r.user_id = pk.id;
end;
$$;
revoke execute on function public.take_inactivity_nudges(timestamptz) from public, anon, authenticated;
grant execute on function public.take_inactivity_nudges(timestamptz) to service_role;
