-- Un fuso inesistente farebbe fallire il calcolo dei promemoria.
create function public.validate_profile_tz() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.tz) then
    raise exception 'fuso orario non valido: %', new.tz using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_tz
  before insert or update of tz on public.profiles
  for each row execute function public.validate_profile_tz();

-- I dati di registrazione arrivano dal client: un fuso errato non deve impedire di iscriversi.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  requested text := nullif(new.raw_user_meta_data ->> 'tz', '');
begin
  insert into public.profiles (id, display_name, tz)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Utente'),
    case
      when exists (select 1 from pg_catalog.pg_timezone_names where name = requested) then requested
      else 'Europe/Rome'
    end
  );
  insert into public.goal_changes (user_id, effective_from, goal_ml)
  values (new.id, (now() at time zone 'UTC')::date - 1, 3000);
  return new;
end;
$$;

-- Dopo un viaggio lo stesso orario cade in un altro istante della stessa data: è un altro invio.
alter table public.push_log drop constraint push_log_user_id_schedule_time_id_scheduled_date_key;
alter table public.push_log add constraint push_log_once unique (user_id, schedule_time_id, scheduled_at);
alter table public.push_log add column claimed_at timestamptz not null default now();

-- Riprende un invio fallito, o rimasto a metà perché la funzione si è interrotta.
-- L'update è atomico: se due esecuzioni si sovrappongono, una sola ottiene la riga.
create function public.reclaim_push(p_user uuid, p_time uuid, p_at timestamptz) returns uuid
language sql security definer set search_path = '' as $$
  update public.push_log
  set status = 'pending', claimed_at = now()
  where user_id = p_user
    and schedule_time_id = p_time
    and scheduled_at = p_at
    and (status = 'failed' or (status = 'pending' and claimed_at < now() - interval '2 minutes'))
  returning id;
$$;
revoke execute on function public.reclaim_push(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reclaim_push(uuid, uuid, timestamptz) to service_role;

-- Segno di vita del job: se manca, nessuna riga di registro può dire che il servizio è fermo.
create table public.service_status (
  id int primary key default 1 check (id = 1),
  last_run_at timestamptz
);
insert into public.service_status (id) values (1);
alter table public.service_status enable row level security;
create policy service_status_select on public.service_status for select to authenticated using (true);
