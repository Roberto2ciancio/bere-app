-- «Bevuto ✓» nella notifica: il service worker non ha la sessione dell'utente,
-- quindi l'id del promemoria (casuale, arriva solo nella push cifrata) fa da biglietto.
-- Vale una sola bevuta, della quantità scelta nel profilo, e scade dopo 24 ore.
create function public.drink_from_push(p_log_id uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_ml int;
  v_tz text;
  v_units text;
  v_today date;
  v_added boolean;
  v_drunk numeric;
  v_goal int;
begin
  select l.user_id into v_user from public.push_log l
  where l.id = p_log_id and l.scheduled_at > now() - interval '24 hours';
  if v_user is null then
    return json_build_object('ok', false);
  end if;

  select p.drink_ml, p.tz, p.units into v_ml, v_tz, v_units from public.profiles p where p.id = v_user;
  v_today := (now() at time zone v_tz)::date;

  -- client_id = id del promemoria: toccare due volte non segna due bevute.
  insert into public.drinks (user_id, client_id, amount_ml, drunk_at, local_date)
  values (v_user, p_log_id, v_ml, now(), v_today)
  on conflict (user_id, client_id) do nothing;
  v_added := found;

  select coalesce(sum(d.amount_ml * d.hydration_pct / 100.0), 0) into v_drunk
  from public.drinks d where d.user_id = v_user and d.local_date = v_today;
  select coalesce((
    select g.goal_ml from public.goal_changes g
    where g.user_id = v_user and g.effective_from <= v_today
    order by g.effective_from desc limit 1
  ), 3000) into v_goal;

  return json_build_object(
    'ok', true,
    'added', v_added,
    'amount_ml', v_ml,
    'drunk_ml', round(v_drunk)::int,
    'goal_ml', v_goal,
    'units', v_units
  );
end;
$$;
revoke execute on function public.drink_from_push(uuid) from public;
grant execute on function public.drink_from_push(uuid) to anon, authenticated;
