-- Idioma de cada persona (el que elige en la app): avisos, notificaciones y llamadas por voz
-- le llegan en ese idioma. Por ahora español o inglés.
alter table public.perfiles
  add column idioma text not null default 'es' check (idioma in ('es', 'en'));
grant update (idioma) on public.perfiles to authenticated;
