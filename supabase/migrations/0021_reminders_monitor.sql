-- Controllo da fuori (GitHub Actions, ogni 10 minuti): quando ha girato l'ultima volta il job delle notifiche.
-- Solo un orario, niente dati delle persone: si può leggere con la chiave pubblica dell'app.
create function public.reminders_last_run() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select last_run_at from public.service_status where id = 1;
$$;
revoke execute on function public.reminders_last_run() from public;
grant execute on function public.reminders_last_run() to anon, authenticated;
