-- Glu è l'unico stile della home: gli altri vengono tolti e tutti passano a Glu.
update public.profiles set home_style = 'glu' where home_style <> 'glu';
alter table public.profiles drop constraint profiles_home_style_check;
alter table public.profiles add constraint profiles_home_style_check check (home_style in ('glu'));
alter table public.profiles alter column home_style set default 'glu';
