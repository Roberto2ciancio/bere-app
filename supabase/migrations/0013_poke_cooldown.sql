-- Oltre al limite di 3 al giorno, impone un'attesa minima tra due sproni alla stessa persona.
create or replace function public.claim_poke(p_from uuid, p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  accepted boolean;
begin
  if p_from = p_to then return 'self'; end if;
  select allow_pokes into accepted from public.profiles where id = p_to;
  if accepted is null or not accepted then return 'blocked'; end if;
  -- Il blocco evita che richieste simultanee superino insieme il limite.
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
