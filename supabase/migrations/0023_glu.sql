-- Glu, la goccia mascotte: nuovo stile della home, predefinito per tutti.
alter table public.profiles drop constraint profiles_home_style_check;
alter table public.profiles add constraint profiles_home_style_check
  check (home_style in ('bottle', 'ring', 'drops', 'drop-face', 'cat', 'fish', 'can', 'glu'));
alter table public.profiles alter column home_style set default 'glu';
update public.profiles set home_style = 'glu' where home_style = 'bottle';

-- Obiettivo scelto al primo avvio: vale da oggi (non dal giorno prima come quello di registrazione).
-- Consentito solo a un account nuovo (meno di 24 ore) e senza bevute, così non riscrive la storia.
create function public.set_initial_goal(p_goal_ml int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_created timestamptz;
  v_tz text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_goal_ml is null or p_goal_ml < 100 or p_goal_ml > 10000 then
    raise exception 'invalid_goal';
  end if;
  select created_at into v_created from auth.users where id = auth.uid();
  if v_created is null or v_created < now() - interval '24 hours' then
    raise exception 'account_not_new';
  end if;
  if exists (select 1 from public.drinks where user_id = auth.uid()) then
    raise exception 'has_drinks';
  end if;
  select tz into v_tz from public.profiles where id = auth.uid();
  insert into public.goal_changes (user_id, effective_from, goal_ml)
  values (auth.uid(), (now() at time zone coalesce(v_tz, 'UTC'))::date, p_goal_ml)
  on conflict (user_id, effective_from) do update set goal_ml = excluded.goal_ml;
end;
$$;
revoke execute on function public.set_initial_goal(int) from public, anon;
grant execute on function public.set_initial_goal(int) to authenticated;
