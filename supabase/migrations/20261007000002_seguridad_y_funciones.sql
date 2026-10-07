-- =============================================================================
-- Control de acceso (RLS), funciones RPC y registro con código de invitación
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------------

create or replace function public.mi_rol() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.mi_empresa() returns uuid
language sql stable security definer set search_path = '' as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin_de(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and empresa_id = p_empresa
  )
$$;

create or replace function public.es_apoderado_de(p_alumno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.apoderado_alumno where apoderado_id = auth.uid() and alumno_id = p_alumno)
$$;

-- El conductor ve a los alumnos de las rutas que tiene asignadas.
create or replace function public.es_conductor_de_alumno(p_alumno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ruta_paradas rp join public.rutas r on r.id = rp.ruta_id
    where rp.alumno_id = p_alumno and r.conductor_id = auth.uid()
  )
$$;

create or replace function public.es_conductor_de_recorrido(p_recorrido uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recorridos where id = p_recorrido and conductor_id = auth.uid())
$$;

create or replace function public.es_apoderado_en_recorrido(p_recorrido uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recorrido_alumnos ra
    join public.apoderado_alumno aa on aa.alumno_id = ra.alumno_id
    where ra.recorrido_id = p_recorrido and aa.apoderado_id = auth.uid()
  )
$$;

-- Privacidad de la ubicación del furgón:
--  * solo mientras el recorrido está activo;
--  * el conductor y el admin de la empresa;
--  * el apoderado SOLO desde que se disparó el aviso de su hijo hasta que es entregado
--    (así no puede deducir dónde viven los demás niños siguiendo el furgón).
create or replace function public.puede_ver_ubicacion(p_recorrido uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recorridos r
    where r.id = p_recorrido and r.estado = 'activo' and (
      r.conductor_id = auth.uid()
      or public.es_admin_de(r.empresa_id)
      or exists (
        select 1 from public.recorrido_alumnos ra
        join public.apoderado_alumno aa on aa.alumno_id = ra.alumno_id
        join public.avisos av on av.recorrido_alumno_id = ra.id
        where ra.recorrido_id = r.id and aa.apoderado_id = auth.uid() and ra.estado = 'pendiente'
      )
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Habilitar RLS en todo
-- ---------------------------------------------------------------------------

alter table public.empresas enable row level security;
alter table public.perfiles enable row level security;
alter table public.invitaciones enable row level security;
alter table public.dispositivos enable row level security;
alter table public.furgones enable row level security;
alter table public.alumnos enable row level security;
alter table public.apoderado_alumno enable row level security;
alter table public.domicilios enable row level security;
alter table public.contactos enable row level security;
alter table public.rutas enable row level security;
alter table public.ruta_paradas enable row level security;
alter table public.inasistencias enable row level security;
alter table public.recorridos enable row level security;
alter table public.recorrido_alumnos enable row level security;
alter table public.posiciones enable row level security;
alter table public.avisos enable row level security;
alter table public.envios_push enable row level security;
alter table public.llamadas enable row level security;

-- Ningún dato es accesible sin sesión.
revoke all on all tables in schema public from anon;

-- Escrituras sensibles solo vía RPC / Edge Functions (service_role).
revoke insert, update, delete on public.recorridos, public.recorrido_alumnos, public.posiciones,
  public.avisos, public.envios_push, public.llamadas, public.apoderado_alumno, public.invitaciones
  from authenticated;
revoke update on public.perfiles from authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;
revoke update on public.alumnos from authenticated;
grant update (nombre, colegio, curso, minutos_aviso, activo) on public.alumnos to authenticated;
-- La última posición y el cache de ETA del recorrido no se exponen por columna:
-- la ubicación se lee solo desde `posiciones`, protegida por puede_ver_ubicacion().
revoke select on public.recorridos from authenticated;
grant select (id, ruta_id, empresa_id, conductor_id, furgon_id, tipo, estado, iniciado_en, finalizado_en)
  on public.recorridos to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

create policy "miembros ven su empresa" on public.empresas for select
  using (id = public.mi_empresa());

create policy "ver perfil propio o de mi empresa (admin)" on public.perfiles for select
  using (id = auth.uid() or public.es_admin_de(empresa_id));
create policy "editar perfil propio" on public.perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "admin ve invitaciones" on public.invitaciones for select
  using (public.es_admin_de(empresa_id));

create policy "dispositivos propios" on public.dispositivos for all
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "miembros ven furgones" on public.furgones for select
  using (empresa_id = public.mi_empresa());
create policy "admin gestiona furgones" on public.furgones for all
  using (public.es_admin_de(empresa_id)) with check (public.es_admin_de(empresa_id));

create policy "ver alumnos" on public.alumnos for select
  using (public.es_apoderado_de(id) or public.es_admin_de(empresa_id) or public.es_conductor_de_alumno(id));
create policy "editar alumnos" on public.alumnos for update
  using (public.es_apoderado_de(id) or public.es_admin_de(empresa_id))
  with check (public.es_apoderado_de(id) or public.es_admin_de(empresa_id));
create policy "admin crea y elimina alumnos" on public.alumnos for insert
  with check (public.es_admin_de(empresa_id));
create policy "admin elimina alumnos" on public.alumnos for delete
  using (public.es_admin_de(empresa_id));

create policy "ver vínculos apoderado-alumno" on public.apoderado_alumno for select
  using (apoderado_id = auth.uid() or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)));

create policy "ver domicilios" on public.domicilios for select
  using (public.es_apoderado_de(alumno_id) or public.es_conductor_de_alumno(alumno_id)
    or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)));
create policy "gestionar domicilios" on public.domicilios for all
  using (public.es_apoderado_de(alumno_id) or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)))
  with check (public.es_apoderado_de(alumno_id) or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)));

-- Los teléfonos NO son visibles para el conductor: no debe llamar mientras maneja.
create policy "gestionar contactos" on public.contactos for all
  using (public.es_apoderado_de(alumno_id) or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)))
  with check (public.es_apoderado_de(alumno_id) or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)));

create policy "ver rutas" on public.rutas for select
  using (conductor_id = auth.uid() or public.es_admin_de(empresa_id));
create policy "admin gestiona rutas" on public.rutas for all
  using (public.es_admin_de(empresa_id)) with check (public.es_admin_de(empresa_id));

create policy "ver paradas" on public.ruta_paradas for select
  using (exists (select 1 from public.rutas r where r.id = ruta_id and (r.conductor_id = auth.uid() or public.es_admin_de(r.empresa_id))));
create policy "admin gestiona paradas" on public.ruta_paradas for all
  using (exists (select 1 from public.rutas r where r.id = ruta_id and public.es_admin_de(r.empresa_id)))
  with check (exists (select 1 from public.rutas r where r.id = ruta_id and public.es_admin_de(r.empresa_id)));

create policy "ver inasistencias" on public.inasistencias for select
  using (public.es_apoderado_de(alumno_id) or public.es_conductor_de_alumno(alumno_id)
    or public.es_admin_de((select empresa_id from public.alumnos where id = alumno_id)));

create policy "ver recorridos" on public.recorridos for select
  using (conductor_id = auth.uid() or public.es_admin_de(empresa_id) or public.es_apoderado_en_recorrido(id));

create policy "ver paradas del recorrido" on public.recorrido_alumnos for select
  using (public.es_conductor_de_recorrido(recorrido_id) or public.es_apoderado_de(alumno_id)
    or public.es_admin_de((select empresa_id from public.recorridos where id = recorrido_id)));

create policy "ver posiciones (solo recorrido activo y autorizado)" on public.posiciones for select
  using (public.puede_ver_ubicacion(recorrido_id));

create policy "ver avisos" on public.avisos for select
  using (public.es_apoderado_de(alumno_id) or public.es_conductor_de_recorrido(recorrido_id)
    or public.es_admin_de((select empresa_id from public.recorridos where id = recorrido_id)));

create policy "admin ve envíos push" on public.envios_push for select
  using (exists (select 1 from public.avisos av join public.recorridos r on r.id = av.recorrido_id
    where av.id = aviso_id and public.es_admin_de(r.empresa_id)));

create policy "ver llamadas" on public.llamadas for select
  using (exists (select 1 from public.avisos av join public.recorridos r on r.id = av.recorrido_id
    where av.id = aviso_id and (public.es_apoderado_de(av.alumno_id) or public.es_admin_de(r.empresa_id))));

-- ---------------------------------------------------------------------------
-- Registro con código de invitación
-- ---------------------------------------------------------------------------

-- Permite a la pantalla de registro validar el código antes de crear la cuenta.
create or replace function public.validar_invitacion(p_codigo text)
returns table (rol public.rol_usuario, empresa text)
language sql stable security definer set search_path = '' as $$
  select i.rol, e.nombre from public.invitaciones i join public.empresas e on e.id = i.empresa_id
  where i.codigo = upper(trim(p_codigo)) and i.usos_restantes > 0 and (i.expira_en is null or i.expira_en > now())
$$;
grant execute on function public.validar_invitacion(text) to anon, authenticated;

-- Al crear un usuario con `codigo_invitacion` en sus metadatos se crea su perfil con
-- el rol y la empresa del código. El rol nunca lo elige el usuario.
create or replace function public.crear_perfil_desde_invitacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text := upper(trim(new.raw_user_meta_data ->> 'codigo_invitacion'));
  v_inv public.invitaciones;
begin
  if v_codigo is null or v_codigo = '' then
    return new; -- cuentas creadas por el administrador del sistema (p. ej. el script de demo)
  end if;
  select * into v_inv from public.invitaciones where codigo = v_codigo for update;
  if v_inv.codigo is null or v_inv.usos_restantes <= 0 or (v_inv.expira_en is not null and v_inv.expira_en < now()) then
    raise exception 'Código de invitación inválido o vencido';
  end if;
  update public.invitaciones set usos_restantes = usos_restantes - 1 where codigo = v_inv.codigo;
  insert into public.perfiles (id, empresa_id, rol, nombre, telefono)
  values (
    new.id, v_inv.empresa_id, v_inv.rol,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'telefono'), '')
  );
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_desde_invitacion();

create or replace function public.crear_invitacion(p_rol public.rol_usuario, p_usos integer default 50)
returns text language plpgsql security definer set search_path = '' as $$
declare v_codigo text;
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo el administrador puede crear invitaciones' using errcode = '42501';
  end if;
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invitaciones (codigo, empresa_id, rol, usos_restantes, expira_en)
  values (v_codigo, public.mi_empresa(), p_rol, p_usos, now() + interval '30 days');
  return v_codigo;
end $$;

-- ---------------------------------------------------------------------------
-- RPC para la app
-- ---------------------------------------------------------------------------

create or replace function public.registrar_dispositivo(p_token text, p_plataforma text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  -- Un token pertenece al último usuario que inició sesión en ese teléfono.
  insert into public.dispositivos (perfil_id, expo_push_token, plataforma)
  values (auth.uid(), p_token, p_plataforma)
  on conflict (expo_push_token) do update
    set perfil_id = excluded.perfil_id, plataforma = excluded.plataforma, actualizado_en = now();
end $$;

-- El apoderado registra a su hijo con domicilio (pin exacto) y contactos.
-- p_datos: {nombre, colegio, curso, minutos_aviso, parentesco,
--           domicilio: {direccion, lat, lng, indicaciones},
--           contactos: [{nombre, telefono, prioridad}]}
create or replace function public.registrar_alumno(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid;
  v_contacto jsonb;
begin
  if public.mi_rol() is distinct from 'apoderado' then
    raise exception 'Solo un apoderado puede registrar alumnos' using errcode = '42501';
  end if;
  if coalesce(trim(p_datos ->> 'nombre'), '') = '' then raise exception 'Falta el nombre del alumno'; end if;
  if jsonb_array_length(coalesce(p_datos -> 'contactos', '[]')) = 0 then
    raise exception 'Debe registrar al menos un teléfono de contacto';
  end if;

  insert into public.alumnos (empresa_id, nombre, colegio, curso, minutos_aviso)
  values (
    public.mi_empresa(), trim(p_datos ->> 'nombre'), p_datos ->> 'colegio', p_datos ->> 'curso',
    coalesce((p_datos ->> 'minutos_aviso')::smallint, 5)
  ) returning id into v_alumno;

  insert into public.apoderado_alumno (apoderado_id, alumno_id, parentesco)
  values (auth.uid(), v_alumno, p_datos ->> 'parentesco');

  insert into public.domicilios (alumno_id, direccion, lat, lng, indicaciones)
  values (
    v_alumno, p_datos -> 'domicilio' ->> 'direccion', (p_datos -> 'domicilio' ->> 'lat')::float8,
    (p_datos -> 'domicilio' ->> 'lng')::float8, p_datos -> 'domicilio' ->> 'indicaciones'
  );

  for v_contacto in select * from jsonb_array_elements(p_datos -> 'contactos') loop
    insert into public.contactos (alumno_id, nombre, telefono, prioridad)
    values (v_alumno, v_contacto ->> 'nombre', v_contacto ->> 'telefono', (v_contacto ->> 'prioridad')::smallint);
  end loop;

  return v_alumno;
end $$;

-- El admin agrega un alumno al final de una ruta (con su domicilio principal).
create or replace function public.asignar_a_ruta(p_alumno uuid, p_ruta uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid; v_domicilio uuid;
begin
  select empresa_id into v_empresa from public.rutas where id = p_ruta;
  if not public.es_admin_de(v_empresa)
     or not exists (select 1 from public.alumnos where id = p_alumno and empresa_id = v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select id into v_domicilio from public.domicilios where alumno_id = p_alumno
    order by principal desc, creado_en desc limit 1;
  if v_domicilio is null then raise exception 'El alumno no tiene domicilio registrado'; end if;
  insert into public.ruta_paradas (ruta_id, alumno_id, domicilio_id, orden)
  values (p_ruta, p_alumno, v_domicilio,
    coalesce((select max(orden) + 1 from public.ruta_paradas where ruta_id = p_ruta), 1))
  on conflict (ruta_id, alumno_id) do nothing;
end $$;

-- El conductor inicia el recorrido de una de sus rutas. Idempotente.
create or replace function public.iniciar_recorrido(p_ruta uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ruta public.rutas;
  v_id uuid;
  v_hoy date;
begin
  select * into v_ruta from public.rutas where id = p_ruta and activa;
  if v_ruta.id is null or v_ruta.conductor_id is distinct from auth.uid() then
    raise exception 'No tienes asignada esta ruta' using errcode = '42501';
  end if;

  select id into v_id from public.recorridos where ruta_id = p_ruta and estado = 'activo';
  if v_id is not null then return v_id; end if;

  select (now() at time zone e.zona_horaria)::date into v_hoy from public.empresas e where e.id = v_ruta.empresa_id;

  insert into public.recorridos (ruta_id, empresa_id, conductor_id, furgon_id, tipo)
  values (p_ruta, v_ruta.empresa_id, auth.uid(), v_ruta.furgon_id, v_ruta.tipo)
  returning id into v_id;

  insert into public.recorrido_alumnos (recorrido_id, alumno_id, domicilio_id, orden, estado)
  select v_id, rp.alumno_id, rp.domicilio_id, rp.orden,
    case when exists (
      select 1 from public.inasistencias i
      where i.alumno_id = rp.alumno_id and i.fecha = v_hoy and i.tipo in (v_ruta.tipo::text, 'ambos')
    ) then 'no_viaja'::public.estado_parada else 'pendiente'::public.estado_parada end
  from public.ruta_paradas rp
  join public.alumnos a on a.id = rp.alumno_id and a.activo
  where rp.ruta_id = p_ruta;

  return v_id;
end $$;

create or replace function public.finalizar_recorrido(p_recorrido uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_conductor_de_recorrido(p_recorrido) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.recorridos set estado = 'finalizado', finalizado_en = now(), eta_cache = null
  where id = p_recorrido and estado = 'activo';
  update public.llamadas l set estado = 'cancelada', finalizada_en = now()
  from public.avisos av where av.id = l.aviso_id and av.recorrido_id = p_recorrido and l.estado = 'programada';
end $$;

-- El conductor marca "entregado"/"ausente" (o "pendiente" para deshacer).
create or replace function public.marcar_parada(p_parada uuid, p_estado public.estado_parada)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_estado not in ('entregado', 'ausente', 'pendiente') then
    raise exception 'Estado no permitido';
  end if;
  select jsonb_build_object('recorrido_id', r.id, 'alumno_id', a.id, 'nombre', a.nombre, 'tipo', r.tipo)
  into v
  from public.recorrido_alumnos ra
  join public.recorridos r on r.id = ra.recorrido_id
  join public.alumnos a on a.id = ra.alumno_id
  where ra.id = p_parada and r.conductor_id = auth.uid() and r.estado = 'activo';
  if v is null then raise exception 'No autorizado o recorrido no activo' using errcode = '42501'; end if;

  update public.recorrido_alumnos
  set estado = p_estado, marcado_en = case when p_estado = 'pendiente' then null else now() end
  where id = p_parada;

  if p_estado <> 'pendiente' then
    update public.llamadas l set estado = 'cancelada', finalizada_en = now()
    from public.avisos av where av.id = l.aviso_id and av.recorrido_alumno_id = p_parada and l.estado = 'programada';
  end if;
  return v;
end $$;

-- "Hoy no viaja" (o deshacerlo). Si el recorrido ya partió, el alumno se salta igual.
create or replace function public.marcar_no_viaja(p_alumno uuid, p_fecha date, p_tipo text, p_no_viaja boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_apoderado_de(p_alumno)
          or public.es_admin_de((select empresa_id from public.alumnos where id = p_alumno))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_no_viaja then
    insert into public.inasistencias (alumno_id, fecha, tipo, creado_por)
    values (p_alumno, p_fecha, p_tipo, auth.uid()) on conflict do nothing;
  else
    delete from public.inasistencias where alumno_id = p_alumno and fecha = p_fecha and tipo = p_tipo;
  end if;

  update public.recorrido_alumnos ra
  set estado = case when p_no_viaja then 'no_viaja'::public.estado_parada else 'pendiente'::public.estado_parada end
  from public.recorridos r
  join public.empresas e on e.id = r.empresa_id
  where ra.recorrido_id = r.id and ra.alumno_id = p_alumno and r.estado = 'activo'
    and (r.iniciado_en at time zone e.zona_horaria)::date = p_fecha
    and (p_tipo = 'ambos' or r.tipo::text = p_tipo)
    and ra.estado = case when p_no_viaja then 'pendiente'::public.estado_parada else 'no_viaja'::public.estado_parada end;
end $$;

-- El apoderado confirma desde la app que recibió el aviso: detiene los reintentos de llamada.
create or replace function public.confirmar_aviso(p_aviso uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.avisos where id = p_aviso and public.es_apoderado_de(alumno_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.avisos set confirmado_en = coalesce(confirmado_en, now()) where id = p_aviso;
  update public.llamadas set estado = 'cancelada', finalizada_en = now()
  where aviso_id = p_aviso and estado = 'programada';
end $$;

-- ---------------------------------------------------------------------------
-- Funciones internas (solo Edge Functions con service_role)
-- ---------------------------------------------------------------------------

create or replace function public.registrar_posiciones(p_recorrido uuid, p_posiciones jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_insertadas integer; v_ultima jsonb;
begin
  insert into public.posiciones (recorrido_id, client_id, registrada_en, lat, lng, precision_m, velocidad_ms, rumbo)
  select p_recorrido, (e ->> 'client_id')::uuid, to_timestamp((e ->> 'ts')::float8 / 1000),
    (e ->> 'lat')::float8, (e ->> 'lng')::float8, (e ->> 'precision_m')::real, (e ->> 'velocidad_ms')::real,
    (e ->> 'rumbo')::real
  from jsonb_array_elements(p_posiciones) e
  on conflict (recorrido_id, client_id) do nothing;
  get diagnostics v_insertadas = row_count;

  select e into v_ultima from jsonb_array_elements(p_posiciones) e order by (e ->> 'ts')::float8 desc limit 1;
  update public.recorridos
  set ultima_lat = (v_ultima ->> 'lat')::float8, ultima_lng = (v_ultima ->> 'lng')::float8,
      ultima_posicion_en = to_timestamp((v_ultima ->> 'ts')::float8 / 1000)
  where id = p_recorrido
    and (ultima_posicion_en is null or ultima_posicion_en < to_timestamp((v_ultima ->> 'ts')::float8 / 1000));
  return v_insertadas;
end $$;

create or replace function public.paradas_pendientes(p_recorrido uuid)
returns table (id uuid, alumno_id uuid, nombre text, lat float8, lng float8, minutos_aviso integer, avisado boolean)
language sql stable security definer set search_path = '' as $$
  select ra.id, ra.alumno_id, a.nombre, d.lat, d.lng, a.minutos_aviso::integer,
    exists (select 1 from public.avisos av where av.recorrido_alumno_id = ra.id)
  from public.recorrido_alumnos ra
  join public.alumnos a on a.id = ra.alumno_id
  join public.domicilios d on d.id = ra.domicilio_id
  where ra.recorrido_id = p_recorrido and ra.estado = 'pendiente'
  order by ra.orden
$$;

create or replace function public.guardar_etas(p_recorrido uuid, p_etas jsonb, p_cache jsonb, p_fuente text)
returns void language sql security definer set search_path = '' as $$
  update public.recorrido_alumnos ra
  set eta_seg = (e ->> 'eta_seg')::integer, eta_actualizada_en = now()
  from jsonb_array_elements(p_etas) e
  where ra.id = (e ->> 'id')::uuid and ra.recorrido_id = p_recorrido;
  update public.recorridos set eta_cache = coalesce(p_cache, eta_cache), eta_fuente = coalesce(p_fuente, eta_fuente)
  where id = p_recorrido;
$$;

-- Deduplicación atómica: devuelve el id solo si ESTA llamada creó el aviso.
create or replace function public.registrar_aviso(p_parada uuid, p_motivo public.motivo_aviso, p_eta_seg integer)
returns uuid language sql security definer set search_path = '' as $$
  insert into public.avisos (recorrido_id, recorrido_alumno_id, alumno_id, motivo, eta_seg)
  select ra.recorrido_id, ra.id, ra.alumno_id, p_motivo, p_eta_seg
  from public.recorrido_alumnos ra where ra.id = p_parada
  on conflict do nothing
  returning id
$$;

-- Toma (y bloquea) las llamadas programadas vencidas para despacharlas una sola vez.
create or replace function public.reclamar_llamadas(p_limite integer default 20)
returns setof public.llamadas language sql security definer set search_path = '' as $$
  update public.llamadas set estado = 'en_curso', iniciada_en = now()
  where id in (
    select id from public.llamadas
    where estado = 'programada' and programada_para <= now()
    order by programada_para
    for update skip locked
    limit p_limite
  )
  returning *
$$;

revoke execute on function public.registrar_posiciones(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.paradas_pendientes(uuid) from public, anon, authenticated;
revoke execute on function public.guardar_etas(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.registrar_aviso(uuid, public.motivo_aviso, integer) from public, anon, authenticated;
revoke execute on function public.reclamar_llamadas(integer) from public, anon, authenticated;
grant execute on function public.registrar_posiciones(uuid, jsonb) to service_role;
grant execute on function public.paradas_pendientes(uuid) to service_role;
grant execute on function public.guardar_etas(uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.registrar_aviso(uuid, public.motivo_aviso, integer) to service_role;
grant execute on function public.reclamar_llamadas(integer) to service_role;

-- Las funciones de la app requieren sesión.
revoke execute on function public.registrar_dispositivo(text, text) from public, anon;
revoke execute on function public.registrar_alumno(jsonb) from public, anon;
revoke execute on function public.asignar_a_ruta(uuid, uuid) from public, anon;
revoke execute on function public.iniciar_recorrido(uuid) from public, anon;
revoke execute on function public.finalizar_recorrido(uuid) from public, anon;
revoke execute on function public.marcar_parada(uuid, public.estado_parada) from public, anon;
revoke execute on function public.marcar_no_viaja(uuid, date, text, boolean) from public, anon;
revoke execute on function public.confirmar_aviso(uuid) from public, anon;
revoke execute on function public.crear_invitacion(public.rol_usuario, integer) from public, anon;
revoke execute on function public.crear_perfil_desde_invitacion() from public, anon, authenticated;

grant execute on function public.registrar_dispositivo(text, text) to authenticated;
grant execute on function public.registrar_alumno(jsonb) to authenticated;
grant execute on function public.asignar_a_ruta(uuid, uuid) to authenticated;
grant execute on function public.iniciar_recorrido(uuid) to authenticated;
grant execute on function public.finalizar_recorrido(uuid) to authenticated;
grant execute on function public.marcar_parada(uuid, public.estado_parada) to authenticated;
grant execute on function public.marcar_no_viaja(uuid, date, text, boolean) to authenticated;
grant execute on function public.confirmar_aviso(uuid) to authenticated;
grant execute on function public.crear_invitacion(public.rol_usuario, integer) to authenticated;
