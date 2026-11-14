-- Amici e classifiche private. La classifica generale non c'è più: vedi (e puoi spronare, reagire,
-- ricevere avvisi da) solo i tuoi amici e chi è nei tuoi gruppi.
-- Codici: 6 caratteri per un amico, 7 per un gruppo, così un solo campo «Aggiungi» basta per entrambi.

create function public.new_code(p_len int) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
begin
  for i in 1..p_len loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.new_code(int) from public, anon, authenticated;

alter table public.profiles add column friend_code text unique default public.new_code(6);
update public.profiles set friend_code = public.new_code(6) where friend_code is null;
alter table public.profiles alter column friend_code set not null;

create table public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default public.new_code(7),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on public.group_members (user_id);

-- Nessuna policy: si passa solo dalle funzioni qui sotto.
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Amici, o nello stesso gruppo.
create function public.are_connected(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_a = least(p_a, p_b) and f.user_b = greatest(p_a, p_b))
    or exists (
      select 1 from public.group_members x join public.group_members y on y.group_id = x.group_id
      where x.user_id = p_a and y.user_id = p_b
    );
$$;
revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;

-- Il codice di un amico (6) o di un gruppo (7). Risponde con ok, kind ('friend' o 'group'), name e, se serve, reason.
create function public.use_code(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_other uuid;
  v_name text;
  v_group uuid;
begin
  if v_me is null then return json_build_object('ok', false, 'reason', 'not-found'); end if;
  if char_length(v_code) = 6 then
    select p.id, p.display_name into v_other, v_name from public.profiles p where p.friend_code = v_code;
    if v_other is null then return json_build_object('ok', false, 'reason', 'not-found'); end if;
    if v_other = v_me then return json_build_object('ok', false, 'reason', 'self'); end if;
    if exists (select 1 from public.friendships f where f.user_a = least(v_me, v_other) and f.user_b = greatest(v_me, v_other)) then
      return json_build_object('ok', true, 'kind', 'friend', 'name', v_name, 'already', true);
    end if;
    if (select count(*) from public.friendships f where v_me in (f.user_a, f.user_b)) >= 200 then
      return json_build_object('ok', false, 'reason', 'limit');
    end if;
    insert into public.friendships (user_a, user_b) values (least(v_me, v_other), greatest(v_me, v_other)) on conflict do nothing;
    return json_build_object('ok', true, 'kind', 'friend', 'name', v_name, 'already', false);
  elsif char_length(v_code) = 7 then
    select g.id, g.name into v_group, v_name from public.groups g where g.invite_code = v_code;
    if v_group is null then return json_build_object('ok', false, 'reason', 'not-found'); end if;
    perform pg_advisory_xact_lock(hashtextextended(v_group::text, 0));
    if exists (select 1 from public.group_members m where m.group_id = v_group and m.user_id = v_me) then
      return json_build_object('ok', true, 'kind', 'group', 'name', v_name, 'group_id', v_group, 'already', true);
    end if;
    if (select count(*) from public.group_members m where m.user_id = v_me) >= 10 then
      return json_build_object('ok', false, 'reason', 'limit');
    end if;
    if (select count(*) from public.group_members m where m.group_id = v_group) >= 50 then
      return json_build_object('ok', false, 'reason', 'full');
    end if;
    insert into public.group_members (group_id, user_id) values (v_group, v_me);
    return json_build_object('ok', true, 'kind', 'group', 'name', v_name, 'group_id', v_group, 'already', false);
  end if;
  return json_build_object('ok', false, 'reason', 'not-found');
end;
$$;
revoke execute on function public.use_code(text) from public, anon;
grant execute on function public.use_code(text) to authenticated;

create function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
$$;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

create function public.create_group(p_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_code text;
begin
  if v_me is null or char_length(v_name) not between 1 and 40 then return json_build_object('ok', false, 'reason', 'name'); end if;
  if (select count(*) from public.group_members m where m.user_id = v_me) >= 10 then
    return json_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into public.groups (name, created_by) values (v_name, v_me) returning id, invite_code into v_id, v_code;
  insert into public.group_members (group_id, user_id) values (v_id, v_me);
  return json_build_object('ok', true, 'id', v_id, 'name', v_name, 'invite_code', v_code);
end;
$$;
revoke execute on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;

-- Esce l'ultimo: il gruppo sparisce.
create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.group_members where group_id = p_group and user_id = auth.uid();
  delete from public.groups g where g.id = p_group and not exists (select 1 from public.group_members m where m.group_id = g.id);
end;
$$;
revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

create function public.my_groups() returns table (id uuid, name text, invite_code text, members int)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.invite_code, (select count(*)::int from public.group_members x where x.group_id = g.id)
  from public.groups g join public.group_members m on m.group_id = g.id
  where m.user_id = auth.uid()
  order by g.created_at;
$$;
revoke execute on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- Classifica vista da qualcuno: senza gruppo lui e i suoi amici; con un gruppo i suoi membri, solo se ne fa parte.
-- Un giorno conta se si raggiunge l'obiettivo di quel giorno, aumenti compresi (come nella 0017).
create function public.leaderboard_for(p_viewer uuid, p_week_start date, p_group uuid default null)
returns table (user_id uuid, display_name text, avatar_path text, days_met int, streak int)
language sql stable security definer set search_path = '' as $$
  with members as (
    select p_viewer as id where p_group is null
    union
    select case when f.user_a = p_viewer then f.user_b else f.user_a end
    from public.friendships f where p_group is null and p_viewer in (f.user_a, f.user_b)
    union
    select m.user_id from public.group_members m
    where m.group_id = p_group
      and exists (select 1 from public.group_members me where me.group_id = p_group and me.user_id = p_viewer)
  ),
  days as (
    select (p_week_start + offs)::date as day from generate_series(0, 6) as offs
  ),
  daily as (
    select
      p.id,
      d.day,
      coalesce((
        select sum(dr.amount_ml * dr.hydration_pct / 100.0) from public.drinks dr where dr.user_id = p.id and dr.local_date = d.day
      ), 0) as total_ml,
      public.goal_for(p.id, d.day) as goal_ml
    from public.profiles p join members mb on mb.id = p.id cross join days d
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
  from public.profiles p join members mb on mb.id = p.id left join scores s on s.id = p.id
  order by 4 desc, 5 desc, 2 asc;
$$;
revoke execute on function public.leaderboard_for(uuid, date, uuid) from public, anon, authenticated;

drop function public.get_leaderboard(date);
create function public.get_leaderboard(week_start date, p_group uuid default null)
returns table (user_id uuid, display_name text, avatar_path text, days_met int, streak int)
language sql stable security definer set search_path = '' as $$
  select * from public.leaderboard_for(auth.uid(), week_start, p_group);
$$;
revoke execute on function public.get_leaderboard(date, uuid) from public, anon;
grant execute on function public.get_leaderboard(date, uuid) to authenticated;

-- Sproni, reazioni e avvisi: solo tra amici o compagni di gruppo.
create or replace function public.claim_poke(p_from uuid, p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  accepted boolean;
begin
  if p_from = p_to then return 'self'; end if;
  if not public.are_connected(p_from, p_to) then return 'blocked'; end if;
  select allow_pokes into accepted from public.profiles where id = p_to;
  if accepted is null or not accepted then return 'blocked'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_from::text || p_to::text, 0));
  if exists (select 1 from public.pokes where from_user = p_from and to_user = p_to and created_at > now() - interval '1 hour') then
    return 'cooldown';
  end if;
  if (select count(*) from public.pokes where from_user = p_from and to_user = p_to and created_at > now() - interval '1 day') >= 3 then
    return 'limit';
  end if;
  insert into public.pokes (from_user, to_user) values (p_from, p_to);
  return 'ok';
end;
$$;

create or replace function public.claim_cheer(p_from uuid, p_to uuid, p_reaction text default '👏') returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
begin
  if p_reaction is null or p_reaction not in ('👏', '💪', '🔥') then return 'invalid'; end if;
  if p_from = p_to then return 'self'; end if;
  if not public.are_connected(p_from, p_to) then return 'no-goal'; end if;
  select e.id into v_event
  from public.goal_events e join public.profiles p on p.id = e.user_id
  where e.user_id = p_to and e.local_date = (now() at time zone p.tz)::date;
  if v_event is null then return 'no-goal'; end if;
  insert into public.cheers (event_id, from_user, cheered_at, reaction) values (v_event, p_from, now(), p_reaction)
  on conflict on constraint cheers_event_id_from_user_key do update set cheered_at = now(), reaction = p_reaction
  where public.cheers.cheered_at is null;
  return case when found then 'ok' else 'already' end;
end;
$$;

create or replace function public.cheerable_today()
returns table (user_id uuid, cheered boolean, reaction text)
language sql stable security definer set search_path = '' as $$
  select e.user_id, c.id is not null, c.reaction
  from public.goal_events e
  join public.profiles p on p.id = e.user_id
  left join public.cheers c on c.event_id = e.id and c.from_user = auth.uid() and c.cheered_at is not null
  where e.local_date = (now() at time zone p.tz)::date and e.user_id <> auth.uid()
    and public.are_connected(auth.uid(), e.user_id);
$$;

create or replace function public.take_goal_alerts(p_now timestamptz default now())
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
      and public.are_connected(ev.user_id, p.id)
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

-- Resoconto del lunedì: il posto è tra te e i tuoi amici.
create or replace function public.take_weekly_reports(p_now timestamptz default now())
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
        select 1 + count(*)::int from public.leaderboard_for(c.id, c.last_week) o
        where o.days_met > lb.days_met or (o.days_met = lb.days_met and o.streak > lb.streak)
      ) as rank,
      (select count(*)::int from public.leaderboard_for(c.id, c.last_week)) as players
    from candidates c
    join lateral (select l.days_met, l.streak from public.leaderboard_for(c.id, c.last_week) l where l.user_id = c.id) lb on true
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
