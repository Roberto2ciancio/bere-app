alter table public.profiles drop constraint profiles_home_style_check;
alter table public.profiles add constraint profiles_home_style_check
  check (home_style in ('bottle', 'ring', 'drops', 'drop-face', 'cat', 'fish', 'can'));
