-- =============================================================================
-- Llamadas: primero gratis por la app, con costo (Twilio) solo si no hay internet
-- =============================================================================

alter type public.estado_llamada add value if not exists 'sin_internet';

alter table public.llamadas
  add column canal text not null default 'telefono' check (canal in ('app', 'telefono')),
  add column acuse_en timestamptz;

-- Contactos de un alumno, indicando si pueden recibir la llamada gratis por la app:
-- el teléfono del contacto pertenece a un apoderado del alumno con un dispositivo registrado.
create or replace function public.contactos_llamada(p_alumno uuid)
returns table (id uuid, nombre text, telefono text, prioridad smallint, tiene_app boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, c.telefono, c.prioridad,
    exists (
      select 1 from public.perfiles pf
      join public.apoderado_alumno aa on aa.apoderado_id = pf.id and aa.alumno_id = c.alumno_id
      join public.dispositivos d on d.perfil_id = pf.id
      where pf.telefono = c.telefono
    )
  from public.contactos c
  where c.alumno_id = p_alumno
  order by c.prioridad
$$;

-- Dispositivos a los que se envía la llamada por la app de un contacto.
create or replace function public.dispositivos_de_contacto(p_contacto uuid)
returns table (id uuid, expo_push_token text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.expo_push_token
  from public.contactos c
  join public.perfiles pf on pf.telefono = c.telefono
  join public.apoderado_alumno aa on aa.apoderado_id = pf.id and aa.alumno_id = c.alumno_id
  join public.dispositivos d on d.perfil_id = pf.id
  where c.id = p_contacto
$$;

revoke execute on function public.contactos_llamada(uuid) from public, anon, authenticated;
revoke execute on function public.dispositivos_de_contacto(uuid) from public, anon, authenticated;
grant execute on function public.contactos_llamada(uuid) to service_role;
grant execute on function public.dispositivos_de_contacto(uuid) to service_role;

-- Los envíos de la llamada por la app también quedan registrados.
alter table public.envios_push drop constraint if exists envios_push_tipo_check;
alter table public.envios_push add constraint envios_push_tipo_check
  check (tipo in ('aviso', 'entregado', 'ausente', 'llamada'));
