-- Notifiche delle sfide: a chi viene sfidato, e a chi ha sfidato quando l'altro accetta.
-- Come gli avvisi degli obiettivi: le prende il job ogni minuto, una volta sola, solo dalle 8 alle 22 di chi le riceve.

alter table public.challenges
  add column alerted_at timestamptz,
  add column answered_at timestamptz,
  add column answer_alerted_at timestamptz;

-- Le sfide già lanciate non mandano più niente.
update public.challenges set alerted_at = now(), answer_alerted_at = now();

create or replace function public.answer_challenge(p_id uuid, p_accept boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.challenges set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
  where id = p_id and to_user = auth.uid() and status = 'pending';
  return found;
end;
$$;

create function public.take_challenge_alerts(p_now timestamptz default now())
returns table (kind text, to_user uuid, other_name text, subscriptions json)
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('take_challenge_alerts', 0));
  return query
  with fresh as (
    update public.challenges c set alerted_at = p_now
    from public.profiles t
    where t.id = c.to_user and c.alerted_at is null and c.status = 'pending'
      and c.created_at > p_now - interval '12 hours'
      and extract(hour from p_now at time zone t.tz) between 8 and 21
    returning 'new'::text as kind, c.to_user as target, c.from_user as other
  ),
  accepted as (
    update public.challenges c set answer_alerted_at = p_now
    from public.profiles t
    where t.id = c.from_user and c.answer_alerted_at is null and c.status = 'accepted'
      and c.answered_at > p_now - interval '12 hours'
      and extract(hour from p_now at time zone t.tz) between 8 and 21
    returning 'accepted'::text as kind, c.from_user as target, c.to_user as other
  ),
  due as (
    select * from fresh union all select * from accepted
  )
  select d.kind, d.target, o.display_name,
    (select json_agg(json_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from public.push_subscriptions s where s.user_id = d.target)
  from due d join public.profiles o on o.id = d.other
  where exists (select 1 from public.push_subscriptions s where s.user_id = d.target);
end;
$$;
revoke execute on function public.take_challenge_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.take_challenge_alerts(timestamptz) to service_role;
