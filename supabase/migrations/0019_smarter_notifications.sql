-- Notifiche più furbe:
-- 1. «Tra 15 min» nel promemoria: lo stesso promemoria torna un quarto d'ora dopo (al massimo 3 volte);
-- 2. modalità pausa: per qualche giorno non parte nessuna notifica e la serie non si rompe.

-- Un promemoria rimandato. L'id del promemoria (casuale, arriva solo nella push cifrata) fa da biglietto,
-- come per «Bevuto ✓»: il service worker non ha la sessione dell'utente.
create table public.push_snoozes (
  log_id uuid primary key references public.push_log (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  times int not null default 1 check (times between 1 and 3),
  sent_at timestamptz
);
create index push_snoozes_due_idx on public.push_snoozes (due_at) where sent_at is null;
alter table public.push_snoozes enable row level security;

create function public.snooze_from_push(p_log_id uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_times int;
begin
  select l.user_id into v_user from public.push_log l
  where l.id = p_log_id and l.scheduled_at > now() - interval '24 hours';
  if v_user is null then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  select s.times into v_times from public.push_snoozes s where s.log_id = p_log_id;
  if v_times >= 3 then
    return json_build_object('ok', false, 'reason', 'limit');
  end if;

  insert into public.push_snoozes (log_id, user_id, due_at)
  values (p_log_id, v_user, now() + interval '15 minutes')
  on conflict (log_id) do update set due_at = excluded.due_at, times = public.push_snoozes.times + 1, sent_at = null
  returning times into v_times;

  return json_build_object('ok', true, 'times', v_times);
end;
$$;
revoke execute on function public.snooze_from_push(uuid) from public;
grant execute on function public.snooze_from_push(uuid) to anon, authenticated;

-- Periodi di pausa, estremi compresi, nelle date del fuso dell'utente. Al massimo 30 giorni.
create table public.pause_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date < 30)
);
create index pause_periods_user_idx on public.pause_periods (user_id, end_date desc);
alter table public.pause_periods enable row level security;
create policy pause_periods_own on public.pause_periods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- In pausa adesso, nel fuso dell'utente.
create function public.is_paused(p_user uuid, p_now timestamptz default now()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pause_periods pp join public.profiles p on p.id = pp.user_id
    where pp.user_id = p_user and (p_now at time zone p.tz)::date between pp.start_date and pp.end_date
  );
$$;
revoke execute on function public.is_paused(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.is_paused(uuid, timestamptz) to service_role;

-- Chi è in pausa adesso: le funzioni di invio li saltano tutti, promemoria e avvisi sociali.
create function public.paused_user_ids(p_now timestamptz default now()) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct pp.user_id from public.pause_periods pp join public.profiles p on p.id = pp.user_id
  where (p_now at time zone p.tz)::date between pp.start_date and pp.end_date;
$$;
revoke execute on function public.paused_user_ids(timestamptz) from public, anon, authenticated;
grant execute on function public.paused_user_ids(timestamptz) to service_role;

-- Promemoria rimandati da inviare adesso, presi una volta sola. Si saltano quelli già bevuti con «Bevuto ✓»,
-- quelli di chi ha raggiunto l'obiettivo e ha chiesto di fermarsi, quelli di chi è in pausa
-- e quelli scaduti da più di mezz'ora (il job era fermo: arriverebbero fuori tempo).
create function public.take_snoozes(p_now timestamptz default now())
returns table (log_id uuid, user_id uuid, drink_ml int, subscriptions json)
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
     from public.push_subscriptions ps where ps.user_id = d.user_id)
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
