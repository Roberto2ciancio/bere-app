-- Sfide 1 contro 1: «Chi raggiunge l'obiettivo in più giorni questa settimana?». Solo tra amici o compagni di gruppo,
-- una sfida per coppia a settimana, al massimo 5 lanciate a settimana.

-- Giorni a obiettivo di una persona in una settimana (stesse regole della classifica).
create function public.week_score(p_user uuid, p_week date) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from generate_series(0, 6) as o
  where public.goal_for(p_user, p_week + o) >= 1500
    and coalesce((
      select sum(dr.amount_ml * dr.hydration_pct / 100.0) from public.drinks dr
      where dr.user_id = p_user and dr.local_date = p_week + o
    ), 0) >= public.goal_for(p_user, p_week + o);
$$;
revoke execute on function public.week_score(uuid, date) from public, anon, authenticated;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create unique index challenges_pair_week on public.challenges (least(from_user, to_user), greatest(from_user, to_user), week_start);
create index challenges_to_user on public.challenges (to_user, week_start);
alter table public.challenges enable row level security;

-- p_week: il lunedì della settimana in corso, come lo calcola il telefono (accettato anche a cavallo della mezzanotte).
create function public.challenge(p_to uuid, p_week date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_today date;
begin
  if v_me is null then return 'invalid'; end if;
  select (now() at time zone p.tz)::date into v_today from public.profiles p where p.id = v_me;
  if p_week is null or extract(isodow from p_week) <> 1 or p_week > v_today + 1 or p_week <= v_today - 8 then return 'invalid'; end if;
  if p_to = v_me then return 'self'; end if;
  if not public.are_connected(v_me, p_to) then return 'not-connected'; end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge' || v_me::text, 0));
  if exists (
    select 1 from public.challenges c
    where least(c.from_user, c.to_user) = least(v_me, p_to) and greatest(c.from_user, c.to_user) = greatest(v_me, p_to) and c.week_start = p_week
  ) then return 'already'; end if;
  if (select count(*) from public.challenges c where c.from_user = v_me and c.week_start = p_week) >= 5 then return 'limit'; end if;
  insert into public.challenges (from_user, to_user, week_start) values (v_me, p_to, p_week);
  return 'ok';
end;
$$;
revoke execute on function public.challenge(uuid, date) from public, anon;
grant execute on function public.challenge(uuid, date) to authenticated;

create function public.answer_challenge(p_id uuid, p_accept boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.challenges set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_id and to_user = auth.uid() and status = 'pending';
  return found;
end;
$$;
revoke execute on function public.answer_challenge(uuid, boolean) from public, anon;
grant execute on function public.answer_challenge(uuid, boolean) to authenticated;

-- Le mie sfide della settimana, con i giorni a obiettivo di entrambi. Quelle che ho rifiutato non tornano.
create function public.my_challenges(p_week date)
returns table (id uuid, other uuid, other_name text, incoming boolean, status text, my_days int, their_days int)
language sql stable security definer set search_path = '' as $$
  select c.id, o.id, o.display_name, c.to_user = auth.uid(), c.status,
    public.week_score(auth.uid(), p_week), public.week_score(o.id, p_week)
  from public.challenges c
  join public.profiles o on o.id = case when c.from_user = auth.uid() then c.to_user else c.from_user end
  where c.week_start = p_week and auth.uid() in (c.from_user, c.to_user)
    and not (c.to_user = auth.uid() and c.status = 'declined')
  order by c.created_at;
$$;
revoke execute on function public.my_challenges(date) from public, anon;
grant execute on function public.my_challenges(date) to authenticated;
