-- Tipi di bevanda: conta la parte che idrata, 100 = come l'acqua. I valori di default per riga vecchia restano acqua.
alter table public.drinks
  add column drink_type text not null default 'water' check (char_length(drink_type) between 1 and 40),
  add column hydration_pct int not null default 100 check (hydration_pct between 0 and 150);

create table public.drink_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  hydration_pct int not null check (hydration_pct between 0 and 150),
  unique (user_id, name)
);

create table public.cups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  amount_ml int not null check (amount_ml between 1 and 2000),
  drink_type text not null default 'water' check (char_length(drink_type) between 1 and 40),
  hydration_pct int not null default 100 check (hydration_pct between 0 and 150)
);
create index cups_user_idx on public.cups (user_id);

alter table public.drink_types enable row level security;
alter table public.cups enable row level security;
create policy drink_types_all on public.drink_types for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cups_all on public.cups for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles
  add column weight_kg numeric(5, 1) check (weight_kg between 20 and 400),
  add column activity text check (activity in ('sedentary', 'light', 'moderate', 'very')),
  add column units text not null default 'ml' check (units in ('ml', 'oz')),
  add column stop_at_goal boolean not null default false,
  add column allow_pokes boolean not null default true;

alter table public.profiles drop constraint profiles_home_style_check;
alter table public.profiles add constraint profiles_home_style_check
  check (home_style in ('bottle', 'ring', 'drops', 'drop-face', 'cat', 'fish'));

-- Totali per giorno dell'utente: lo storico non deve scaricare ogni singola bevuta.
create function public.daily_totals()
returns table (day date, total_ml int, drinks int)
language sql stable security definer set search_path = '' as $$
  select d.local_date, round(sum(d.amount_ml * d.hydration_pct / 100.0))::int, count(*)::int
  from public.drinks d
  where d.user_id = auth.uid()
  group by d.local_date
  order by d.local_date;
$$;
revoke execute on function public.daily_totals() from public, anon;
grant execute on function public.daily_totals() to authenticated;

-- La classifica conta l'acqua equivalente, non il volume: una birra non vale un bicchiere d'acqua.
create or replace function public.get_leaderboard(week_start date)
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
        select sum(dr.amount_ml * dr.hydration_pct / 100.0) from public.drinks dr where dr.user_id = p.id and dr.local_date = d.day
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

-- Come prima, più l'indicazione di chi ha chiesto di smettere e ha già raggiunto l'obiettivo oggi.
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
  goal_reached boolean
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
    p.stop_at_goal and coalesce((
      select sum(d.amount_ml * d.hydration_pct / 100.0) from public.drinks d
      where d.user_id = s.user_id and d.local_date = (now() at time zone p.tz)::date
    ), 0) >= coalesce((
      select g.goal_ml from public.goal_changes g
      where g.user_id = s.user_id and g.effective_from <= (now() at time zone p.tz)::date
      order by g.effective_from desc limit 1
    ), 3000)
  from public.schedule_times t
  join public.schedules s on s.id = t.schedule_id
  join public.profiles p on p.id = s.user_id
  where s.enabled;
$$;
revoke execute on function public.reminder_rows() from public, anon, authenticated;
grant execute on function public.reminder_rows() to service_role;

-- Spronare un amico manda una notifica a un'altra persona: va limitato e si può rifiutare.
create table public.pokes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index pokes_pair_idx on public.pokes (from_user, to_user, created_at desc);
alter table public.pokes enable row level security;

create function public.claim_poke(p_from uuid, p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  accepted boolean;
begin
  if p_from = p_to then return 'self'; end if;
  select allow_pokes into accepted from public.profiles where id = p_to;
  if accepted is null or not accepted then return 'blocked'; end if;
  -- Il blocco evita che richieste simultanee superino insieme il limite.
  perform pg_advisory_xact_lock(hashtextextended(p_from::text || p_to::text, 0));
  if (select count(*) from public.pokes where from_user = p_from and to_user = p_to and created_at > now() - interval '1 day') >= 3 then
    return 'limit';
  end if;
  insert into public.pokes (from_user, to_user) values (p_from, p_to);
  return 'ok';
end;
$$;
revoke execute on function public.claim_poke(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_poke(uuid, uuid) to service_role;
