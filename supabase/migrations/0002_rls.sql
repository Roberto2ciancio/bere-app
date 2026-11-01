alter table public.profiles enable row level security;
alter table public.goal_changes enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_times enable row level security;
alter table public.drinks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
alter table public.feedback enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy goal_select on public.goal_changes for select to authenticated using (user_id = auth.uid());
-- Un nuovo obiettivo vale al più presto dal giorno dopo, nel fuso dell'utente.
create policy goal_insert on public.goal_changes for insert to authenticated with check (
  user_id = auth.uid()
  and effective_from > (select (now() at time zone p.tz)::date from public.profiles p where p.id = auth.uid())
);
create policy goal_update on public.goal_changes for update to authenticated
  using (
    user_id = auth.uid()
    and effective_from > (select (now() at time zone p.tz)::date from public.profiles p where p.id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and effective_from > (select (now() at time zone p.tz)::date from public.profiles p where p.id = auth.uid())
  );

create policy schedules_all on public.schedules for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy schedule_times_all on public.schedule_times for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));

create policy drinks_select on public.drinks for select to authenticated using (user_id = auth.uid());
create policy drinks_insert on public.drinks for insert to authenticated with check (user_id = auth.uid());
create policy drinks_delete on public.drinks for delete to authenticated using (user_id = auth.uid());

create policy subs_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy subs_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

create policy push_log_select on public.push_log for select to authenticated using (user_id = auth.uid());

create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = auth.uid());

-- Un endpoint appartiene a un dispositivo: passa a chi ha effettuato l'accesso per ultimo.
create function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

-- Chiamata dal service worker, senza sessione: l'id casuale della riga fa da credenziale.
create function public.mark_push_received(p_log_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.push_log set received_at = now() where id = p_log_id and received_at is null;
$$;
revoke execute on function public.mark_push_received(uuid) from public;
grant execute on function public.mark_push_received(uuid) to anon, authenticated;
