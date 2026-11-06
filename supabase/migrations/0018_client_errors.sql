-- Monitoraggio errori: l'app manda qui gli errori che capitano sui telefoni.
-- Nessuno li legge dall'app; si consultano dalla dashboard di Supabase (o con la vista client_errors_recent).

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('error', 'rejection', 'react')),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  route text check (char_length(route) <= 200),
  app_version text check (char_length(app_version) <= 20),
  user_agent text check (char_length(user_agent) <= 300)
);
create index client_errors_created_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;

-- Si scrive solo da qui: limiti per non riempire il database se un errore si ripete in loop.
-- Al massimo 30 errori all'ora per utente e 300 all'ora in tutto; si tengono 30 giorni.
create function public.report_client_error(
  p_kind text, p_message text, p_stack text, p_route text, p_app_version text, p_user_agent text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if p_kind not in ('error', 'rejection', 'react') or coalesce(trim(p_message), '') = '' then return false; end if;
  if v_user is not null and (
    select count(*) from public.client_errors where user_id = v_user and created_at > now() - interval '1 hour'
  ) >= 30 then return false; end if;
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 300 then return false; end if;

  insert into public.client_errors (user_id, kind, message, stack, route, app_version, user_agent)
  values (v_user, p_kind, left(p_message, 500), left(p_stack, 4000), left(p_route, 200), left(p_app_version, 20), left(p_user_agent, 300));

  delete from public.client_errors where created_at < now() - interval '30 days';
  return true;
end;
$$;
revoke execute on function public.report_client_error(text, text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text, text) to anon, authenticated;

-- Riassunto degli ultimi 7 giorni: quale errore, quante volte, su quante persone, in quale versione.
create view public.client_errors_recent with (security_invoker = true) as
  select
    message,
    count(*)::int as times,
    count(distinct user_id)::int as people,
    max(created_at) as last_seen,
    max(app_version) as last_version,
    (array_agg(route order by created_at desc))[1] as last_route
  from public.client_errors
  where created_at > now() - interval '7 days'
  group by message
  order by max(created_at) desc;
revoke all on public.client_errors_recent from public, anon, authenticated;
