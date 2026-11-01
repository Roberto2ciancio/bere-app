create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  background_path text,
  home_style text not null default 'bottle' check (home_style in ('bottle', 'ring', 'drops')),
  sound text not null default 'goccia',
  drink_ml int not null default 200 check (drink_ml between 1 and 2000),
  tz text not null default 'Europe/Rome'
);

create table public.goal_changes (
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  goal_ml int not null check (goal_ml between 100 and 10000),
  primary key (user_id, effective_from)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  weekdays int[] not null check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  enabled boolean not null default true
);
create index schedules_user_idx on public.schedules (user_id);

create table public.schedule_times (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  minutes int not null check (minutes between 0 and 1439),
  unique (schedule_id, minutes)
);

create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  amount_ml int not null check (amount_ml between 1 and 2000),
  drunk_at timestamptz not null,
  local_date date not null,
  unique (user_id, client_id)
);
create index drinks_user_date_idx on public.drinks (user_id, local_date);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  last_ok_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  schedule_time_id uuid references public.schedule_times (id) on delete set null,
  scheduled_date date not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  received_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'missed', 'no-device')),
  unique (user_id, schedule_time_id, scheduled_date)
);
create index push_log_user_idx on public.push_log (user_id, scheduled_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, tz)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Utente'),
    coalesce(nullif(new.raw_user_meta_data ->> 'tz', ''), 'Europe/Rome')
  );
  insert into public.goal_changes (user_id, effective_from, goal_ml)
  values (new.id, (now() at time zone 'UTC')::date - 1, 3000);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
