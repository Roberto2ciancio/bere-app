-- Separata da drinks: la caffeina non conta per l'obiettivo d'acqua né per la classifica.
create table public.caffeine_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('coffee', 'redbull', 'monster')),
  mg int not null check (mg between 1 and 1000),
  taken_at timestamptz not null,
  local_date date not null,
  unique (user_id, client_id)
);
create index caffeine_intakes_user_date_idx on public.caffeine_intakes (user_id, local_date);

alter table public.caffeine_intakes enable row level security;

create policy caffeine_select on public.caffeine_intakes for select to authenticated using (user_id = auth.uid());
create policy caffeine_insert on public.caffeine_intakes for insert to authenticated with check (user_id = auth.uid());
create policy caffeine_delete on public.caffeine_intakes for delete to authenticated using (user_id = auth.uid());
