-- Bloccare una persona (regole di Google Play sui contenuti degli utenti).
-- Bloccando: l'amicizia finisce, le sfide tra i due spariscono, la persona non compare più nella mia classifica
-- (neanche in quella dei gruppi in comune) e tra i due non passano sproni, reazioni, avvisi né nuove sfide,
-- in nessuna direzione: are_connected() risponde no. Chi è bloccato non lo sa.

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked on public.blocks (blocked);

alter table public.blocks enable row level security;
-- Si legge e si toglie (sblocca) da sé; si aggiunge solo con block_person().
create policy "blocks: vedo i miei" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "blocks: tolgo i miei" on public.blocks for delete to authenticated using (blocker = auth.uid());
revoke all on public.blocks from anon;
revoke insert, update on public.blocks from authenticated;

-- Vero se uno dei due ha bloccato l'altro.
create function public.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a)
  );
$$;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Amici o nello stesso gruppo, e nessuno dei due ha bloccato l'altro (come nella 0027, più il blocco).
create or replace function public.are_connected(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    exists (select 1 from public.friendships f where f.user_a = least(p_a, p_b) and f.user_b = greatest(p_a, p_b))
    or exists (
      select 1 from public.group_members x join public.group_members y on y.group_id = x.group_id
      where x.user_id = p_a and y.user_id = p_b
    )
  ) and not public.is_blocked_between(p_a, p_b);
$$;

create function public.block_person(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return 'not-found'; end if;
  if p_user is null or p_user = v_me then return 'self'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then return 'not-found'; end if;
  insert into public.blocks (blocker, blocked) values (v_me, p_user) on conflict do nothing;
  delete from public.friendships where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
  delete from public.challenges where (from_user = v_me and to_user = p_user) or (from_user = p_user and to_user = v_me);
  return 'ok';
end;
$$;
revoke execute on function public.block_person(uuid) from public, anon;
grant execute on function public.block_person(uuid) to authenticated;

-- Le persone che ho bloccato, con nome e foto per poterle sbloccare.
create function public.blocked_people()
returns table (user_id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_path
  from public.blocks b join public.profiles p on p.id = b.blocked
  where b.blocker = auth.uid()
  order by p.display_name;
$$;
revoke execute on function public.blocked_people() from public, anon;
grant execute on function public.blocked_people() to authenticated;

-- La mia classifica (amici o un gruppo, come nella 0027) senza le persone che ho bloccato.
create or replace function public.get_leaderboard(week_start date, p_group uuid default null)
returns table (user_id uuid, display_name text, avatar_path text, days_met int, streak int)
language sql stable security definer set search_path = '' as $$
  select l.* from public.leaderboard_for(auth.uid(), week_start, p_group) l
  where not exists (select 1 from public.blocks b where b.blocker = auth.uid() and b.blocked = l.user_id);
$$;

-- Codice amico: come nella 0027, ma non si diventa amici di chi si è bloccato o da chi si è stati bloccati.
-- Chi ha bloccato riceve 'blocked' (deve prima sbloccare); chi è stato bloccato riceve 'not-found', come per un codice sbagliato.
create or replace function public.use_code(p_code text) returns json
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
    if exists (select 1 from public.blocks b where b.blocker = v_me and b.blocked = v_other) then
      return json_build_object('ok', false, 'reason', 'blocked', 'name', v_name);
    end if;
    if exists (select 1 from public.blocks b where b.blocker = v_other and b.blocked = v_me) then
      return json_build_object('ok', false, 'reason', 'not-found');
    end if;
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
