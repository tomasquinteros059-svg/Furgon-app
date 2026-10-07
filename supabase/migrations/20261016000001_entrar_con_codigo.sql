-- =============================================================================
-- «Entrar con código de familia»: el papá (o la mamá, abuelo/a) escribe el código que le
-- compartieron, su nombre y su teléfono, y entra directo al perfil compartido, sin correo
-- ni contraseña (sesión anónima de Supabase Auth). Después la app le pide proteger la
-- cuenta con correo y contraseña para no perderla si cambia de teléfono.
--
-- Una sesión anónima solo crea perfil con un código de FAMILIA o un código de invitación de
-- rol apoderado: nunca una cuenta de conductora ni una familia «sin código».
-- =============================================================================

create or replace function public.crear_perfil_desde_invitacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text := upper(trim(new.raw_user_meta_data ->> 'codigo_invitacion'));
  v_inv public.invitaciones;
  v_tel text := nullif(trim(new.raw_user_meta_data ->> 'telefono'), '');
  v_nombre text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(coalesce(new.email, 'familia'), '@', 1));
  v_anonima boolean := coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false);
begin
  if v_codigo is null or v_codigo = '' then
    if not v_anonima and coalesce(new.raw_user_meta_data ->> 'sin_codigo', '') = 'familia' then
      insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (new.id, null, 'apoderado', v_nombre, v_tel);
    end if;
    return new;
  end if;
  -- Código de familia: se crea la cuenta del otro apoderado y se une a los mismos hijos.
  if exists (select 1 from public.invitaciones_familia where codigo = v_codigo) then
    insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (new.id, null, 'apoderado', v_nombre, v_tel);
    perform public.vincular_familia(v_codigo, new.id);
    return new;
  end if;
  select * into v_inv from public.invitaciones where codigo = v_codigo for update;
  if v_inv.codigo is null or v_inv.usos_restantes <= 0 or (v_inv.expira_en is not null and v_inv.expira_en < now()) then
    raise exception 'Código de invitación inválido o vencido';
  end if;
  if v_anonima and v_inv.rol <> 'apoderado' then
    raise exception 'Este código es para crear una cuenta con correo y contraseña';
  end if;
  update public.invitaciones set usos_restantes = usos_restantes - 1 where codigo = v_inv.codigo;
  insert into public.perfiles (id, empresa_id, rol, nombre, telefono)
  values (new.id, v_inv.empresa_id, v_inv.rol, v_nombre, v_tel);
  if v_inv.alumno_id is not null then
    insert into public.apoderado_alumno (apoderado_id, alumno_id, parentesco)
    values (new.id, v_inv.alumno_id, nullif(trim(new.raw_user_meta_data ->> 'parentesco'), ''))
    on conflict do nothing;
  end if;
  return new;
end $$;
