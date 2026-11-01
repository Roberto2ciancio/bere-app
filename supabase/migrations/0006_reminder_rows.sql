alter table public.schedule_times add column created_at timestamptz not null default now();

-- Tutti gli orari attivi con i dispositivi dell'utente: lo usa solo la funzione che invia i promemoria.
create function public.reminder_rows()
returns table (
  schedule_time_id uuid,
  user_id uuid,
  minutes int,
  weekdays int[],
  tz text,
  drink_ml int,
  created_at timestamptz,
  subscriptions jsonb
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
    ), '[]'::jsonb)
  from public.schedule_times t
  join public.schedules s on s.id = t.schedule_id
  join public.profiles p on p.id = s.user_id
  where s.enabled;
$$;
revoke execute on function public.reminder_rows() from public, anon, authenticated;
grant execute on function public.reminder_rows() to service_role;
