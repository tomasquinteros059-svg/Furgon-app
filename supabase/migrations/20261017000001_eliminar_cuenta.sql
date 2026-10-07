-- Eliminar la cuenta desde la app (lo exigen Apple y Google, y la política de privacidad).
--
-- La función de Edge «eliminar-cuenta» llama a eliminar_datos_de_cuenta() con service_role,
-- borra las fotos de licencia que devuelve y luego elimina el usuario de auth (que borra su
-- perfil en cascada). Qué se borra:
--  · apoderado: sus hijos que no tienen otro apoderado (con domicilio, contactos, cobros…);
--    en los hijos compartidos solo se quita su vínculo y su teléfono de contacto.
--  · último administrador de una empresa (admin, o tía con permiso de administrar): la
--    empresa completa con sus alumnos, rutas y cobros.
--  · conductor: su licencia; sus recorridos pasados quedan sin conductor (historial del servicio).

alter table public.recorridos alter column conductor_id drop not null;
alter table public.recorridos drop constraint recorridos_conductor_id_fkey;
alter table public.recorridos add constraint recorridos_conductor_id_fkey
  foreign key (conductor_id) references public.perfiles (id) on delete set null;

-- ¿Es el usuario el último que administra su empresa?
create or replace function public.es_ultimo_admin(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_usuario and p.empresa_id is not null
      and (p.rol = 'admin' or (p.rol = 'conductor' and p.puede_administrar))
      and not exists (
        select 1 from public.perfiles o
        where o.empresa_id = p.empresa_id and o.id <> p.id
          and (o.rol = 'admin' or (o.rol = 'conductor' and o.puede_administrar))
      )
  )
$$;

-- Lo que se borrará, para mostrarlo antes de confirmar.
create or replace function public.resumen_eliminacion()
returns table (rol public.rol_usuario, borra_empresa boolean, empresa text, alumnos_borrados integer, familias_afectadas integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_perfil public.perfiles;
begin
  select * into v_perfil from public.perfiles where id = v_uid;
  if v_perfil.id is null then
    return query select null::public.rol_usuario, false, null::text, 0, 0;
    return;
  end if;
  if public.es_ultimo_admin(v_uid) then
    return query
      select v_perfil.rol, true, e.nombre,
        (select count(*)::int from public.alumnos a where a.empresa_id = e.id),
        (select count(distinct aa.apoderado_id)::int from public.apoderado_alumno aa
           join public.alumnos a on a.id = aa.alumno_id where a.empresa_id = e.id)
      from public.empresas e where e.id = v_perfil.empresa_id;
  else
    return query select v_perfil.rol, false, null::text,
      (select count(*)::int from public.apoderado_alumno aa where aa.apoderado_id = v_uid
         and not exists (select 1 from public.apoderado_alumno o where o.alumno_id = aa.alumno_id and o.apoderado_id <> v_uid)),
      0;
  end if;
end;
$$;
revoke all on function public.resumen_eliminacion() from public, anon;
grant execute on function public.resumen_eliminacion() to authenticated;

-- Borra los datos de la cuenta (no el usuario de auth). Devuelve las rutas de fotos de
-- licencia a borrar del bucket «licencias». Solo para service_role.
create or replace function public.eliminar_datos_de_cuenta(p_usuario uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
  v_fotos text[];
begin
  select * into v_perfil from public.perfiles where id = p_usuario;
  if v_perfil.id is null then return '{}'; end if;

  if public.es_ultimo_admin(p_usuario) then
    select coalesce(array_agg(f), '{}') into v_fotos
      from public.licencias l, unnest(array[l.foto_frente, l.foto_reverso]) f
      where l.empresa_id = v_perfil.empresa_id and f is not null;
    -- Las familias quedan con su cuenta, sin empresa; sus hijos de esta empresa se borran.
    delete from public.empresas where id = v_perfil.empresa_id;
    return v_fotos;
  end if;

  select coalesce(array_agg(f), '{}') into v_fotos
    from public.licencias l, unnest(array[l.foto_frente, l.foto_reverso]) f
    where l.conductor_id = p_usuario and f is not null;

  -- Hijos sin otro apoderado: se borran con todos sus datos.
  delete from public.alumnos a
  where exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = a.id and aa.apoderado_id = p_usuario)
    and not exists (select 1 from public.apoderado_alumno o where o.alumno_id = a.id and o.apoderado_id <> p_usuario);

  -- Hijos compartidos: se quita su teléfono de los contactos de llamada.
  delete from public.contactos c
  where c.apoderado_id = p_usuario
     or (v_perfil.telefono is not null and c.telefono = v_perfil.telefono
         and exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = c.alumno_id and aa.apoderado_id = p_usuario));

  return v_fotos;
end;
$$;
revoke all on function public.eliminar_datos_de_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_datos_de_cuenta(uuid) to service_role;
revoke all on function public.es_ultimo_admin(uuid) from public, anon, authenticated;
