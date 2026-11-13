-- Reazioni ai traguardi degli amici: oltre a 👏, anche 💪 e 🔥. Una reazione per amico al giorno, come prima.

alter table public.cheers
  add column reaction text not null default '👏' check (reaction in ('👏', '💪', '🔥'));

drop function public.claim_cheer(uuid, uuid);
create function public.claim_cheer(p_from uuid, p_to uuid, p_reaction text default '👏') returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
begin
  if p_reaction is null or p_reaction not in ('👏', '💪', '🔥') then return 'invalid'; end if;
  if p_from = p_to then return 'self'; end if;
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
revoke execute on function public.claim_cheer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_cheer(uuid, uuid, text) to service_role;

-- La classifica mostra quale reazione ho già mandato (null se nessuna).
drop function public.cheerable_today();
create function public.cheerable_today()
returns table (user_id uuid, cheered boolean, reaction text)
language sql stable security definer set search_path = '' as $$
  select e.user_id, c.id is not null, c.reaction
  from public.goal_events e
  join public.profiles p on p.id = e.user_id
  left join public.cheers c on c.event_id = e.id and c.from_user = auth.uid() and c.cheered_at is not null
  where e.local_date = (now() at time zone p.tz)::date and e.user_id <> auth.uid();
$$;
revoke execute on function public.cheerable_today() from public, anon;
grant execute on function public.cheerable_today() to authenticated;
