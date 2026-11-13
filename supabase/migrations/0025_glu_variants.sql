-- Varianti di Glu: oltre a 'glu' si può scegliere una variante sbloccata con i livelli (solo estetica).
alter table public.profiles drop constraint profiles_home_style_check;
alter table public.profiles add constraint profiles_home_style_check
  check (home_style in ('glu', 'menta', 'limone', 'fragola', 'cocco', 'notte'));
alter table public.profiles alter column home_style set default 'glu';
