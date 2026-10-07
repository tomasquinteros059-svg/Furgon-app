-- =============================================================================
-- La tía del furgón también puede administrar (cuando es la dueña del servicio):
-- con el permiso `puede_administrar`, una conductora tiene las mismas facultades que
-- el administrador sobre su empresa (alumnos, rutas, cobros, solicitudes).
-- Solo un administrador principal (rol admin) puede dar o quitar el permiso.
-- =============================================================================

alter table public.perfiles add column puede_administrar boolean not null default false;

-- Nadie se da el permiso a sí mismo: la columna no es editable desde la app.
revoke update on public.perfiles from authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;

-- ¿El usuario actual administra su empresa? (admin, o conductora con permiso)
create or replace function public.soy_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and (rol = 'admin' or (rol = 'conductor' and puede_administrar))
  )
$$;

create or replace function public.es_admin_de(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and empresa_id = p_empresa
      and (rol = 'admin' or (rol = 'conductor' and puede_administrar))
  )
$$;

create or replace function public.requiere_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.soy_admin() then
    raise exception 'Solo el administrador puede hacer esto' using errcode = '42501';
  end if;
  return public.mi_empresa();
end $$;

create or replace function public.crear_invitacion(p_rol public.rol_usuario, p_usos integer default 50)
returns text language plpgsql security definer set search_path = '' as $$
declare v_codigo text;
begin
  if not public.soy_admin() then
    raise exception 'Solo el administrador puede crear invitaciones' using errcode = '42501';
  end if;
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invitaciones (codigo, empresa_id, rol, usos_restantes, expira_en)
  values (v_codigo, public.mi_empresa(), p_rol, p_usos, now() + interval '30 days');
  return v_codigo;
end $$;

-- Solo el administrador principal da o quita el permiso de administrar a una conductora.
create or replace function public.permitir_administrar(p_perfil uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo el administrador principal puede dar este permiso' using errcode = '42501';
  end if;
  update public.perfiles set puede_administrar = p_valor
  where id = p_perfil and rol = 'conductor' and empresa_id = public.mi_empresa();
  if not found then raise exception 'Conductora no encontrada'; end if;
end $$;

revoke execute on function public.soy_admin() from public, anon;
revoke execute on function public.permitir_administrar(uuid, boolean) from public, anon;
grant execute on function public.soy_admin() to authenticated;
grant execute on function public.permitir_administrar(uuid, boolean) to authenticated;
