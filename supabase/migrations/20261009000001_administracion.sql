-- =============================================================================
-- Administración (app web del dueño): alumnos con código para la familia, cobros,
-- solicitudes (preguntas, cancelaciones), preguntas frecuentes y reportes.
-- =============================================================================

alter table public.empresas
  add column mensualidad_defecto integer not null default 60000 check (mensualidad_defecto >= 0),
  add column dia_vencimiento smallint not null default 5 check (dia_vencimiento between 1 and 28),
  add column telefono_contacto text;

alter table public.alumnos
  add column mensualidad integer check (mensualidad is null or mensualidad >= 0),
  add column fecha_baja date,
  add column motivo_baja text;

-- Un código de invitación puede venir ligado a un alumno ya creado por el administrador:
-- quien se registre con él queda como apoderado de ese alumno.
alter table public.invitaciones add column alumno_id uuid references public.alumnos (id) on delete cascade;

create or replace function public.crear_perfil_desde_invitacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text := upper(trim(new.raw_user_meta_data ->> 'codigo_invitacion'));
  v_inv public.invitaciones;
  v_tel text := nullif(trim(new.raw_user_meta_data ->> 'telefono'), '');
begin
  if v_codigo is null or v_codigo = '' then
    return new;
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
    v_tel
  );
  if v_inv.alumno_id is not null then
    insert into public.apoderado_alumno (apoderado_id, alumno_id, parentesco)
    values (new.id, v_inv.alumno_id, nullif(trim(new.raw_user_meta_data ->> 'parentesco'), ''))
    on conflict do nothing;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Cobros (mensualidades)
-- ---------------------------------------------------------------------------

create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  periodo date not null check (extract(day from periodo) = 1), -- primer día del mes
  monto integer not null check (monto >= 0),
  vence_en date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'anulado')),
  pagado_en timestamptz,
  medio text check (medio in ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  nota text,
  creado_en timestamptz not null default now(),
  unique (alumno_id, periodo)
);
create index on public.cobros (empresa_id, periodo);

-- ---------------------------------------------------------------------------
-- Solicitudes de los apoderados (preguntas, cancelaciones, cambios) y sus mensajes
-- ---------------------------------------------------------------------------

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  alumno_id uuid references public.alumnos (id) on delete set null,
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  tipo text not null check (tipo in ('pregunta', 'cancelacion_servicio', 'cambio_datos', 'reclamo', 'otro')),
  asunto text not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'respondida', 'cerrada')),
  resolucion text check (resolucion in ('aprobada', 'rechazada')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.solicitudes (empresa_id, estado, actualizado_en desc);

create table public.solicitud_mensajes (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  cuerpo text not null check (length(trim(cuerpo)) > 0),
  creado_en timestamptz not null default now()
);
create index on public.solicitud_mensajes (solicitud_id, creado_en);

create table public.preguntas_frecuentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  pregunta text not null,
  respuesta text not null,
  orden integer not null default 0,
  publicada boolean not null default true
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.cobros enable row level security;
alter table public.solicitudes enable row level security;
alter table public.solicitud_mensajes enable row level security;
alter table public.preguntas_frecuentes enable row level security;
revoke all on public.cobros, public.solicitudes, public.solicitud_mensajes, public.preguntas_frecuentes from anon;
revoke insert, update, delete on public.cobros from authenticated;

create policy "ver cobros" on public.cobros for select
  using (public.es_admin_de(empresa_id) or public.es_apoderado_de(alumno_id));

create policy "ver solicitudes" on public.solicitudes for select
  using (autor_id = auth.uid() or public.es_admin_de(empresa_id));
create policy "apoderado crea solicitudes" on public.solicitudes for insert
  with check (autor_id = auth.uid() and empresa_id = public.mi_empresa() and public.mi_rol() = 'apoderado'
    and (alumno_id is null or public.es_apoderado_de(alumno_id)) and estado = 'abierta' and resolucion is null);
create policy "admin actualiza solicitudes" on public.solicitudes for update
  using (public.es_admin_de(empresa_id)) with check (public.es_admin_de(empresa_id));

create policy "ver mensajes" on public.solicitud_mensajes for select
  using (exists (select 1 from public.solicitudes s where s.id = solicitud_id
    and (s.autor_id = auth.uid() or public.es_admin_de(s.empresa_id))));
create policy "escribir mensajes" on public.solicitud_mensajes for insert
  with check (autor_id = auth.uid() and exists (select 1 from public.solicitudes s where s.id = solicitud_id
    and s.estado <> 'cerrada' and (s.autor_id = auth.uid() or public.es_admin_de(s.empresa_id))));

create policy "ver preguntas frecuentes" on public.preguntas_frecuentes for select
  using ((publicada and empresa_id = public.mi_empresa()) or public.es_admin_de(empresa_id));
create policy "admin gestiona preguntas frecuentes" on public.preguntas_frecuentes for all
  using (public.es_admin_de(empresa_id)) with check (public.es_admin_de(empresa_id));

-- El admin ve y edita los datos de su empresa; los apoderados ven a los perfiles
-- de su empresa solo a través de las funciones (no hay cambio en perfiles).
create policy "admin edita su empresa" on public.empresas for update
  using (public.es_admin_de(id)) with check (public.es_admin_de(id));
grant update (nombre, mensualidad_defecto, dia_vencimiento, telefono_contacto) on public.empresas to authenticated;

-- Mantiene actualizado_en y el estado de la solicitud cuando alguien escribe.
create or replace function public.al_escribir_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.solicitudes s
  set actualizado_en = now(),
      estado = case
        when public.es_admin_de(s.empresa_id) then 'respondida'
        else 'abierta' end
  where s.id = new.solicitud_id and s.estado <> 'cerrada';
  return new;
end $$;
create trigger al_escribir_mensaje after insert on public.solicitud_mensajes
  for each row execute function public.al_escribir_mensaje();

-- ---------------------------------------------------------------------------
-- RPC del administrador
-- ---------------------------------------------------------------------------

create or replace function public.requiere_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo el administrador puede hacer esto' using errcode = '42501';
  end if;
  v := public.mi_empresa();
  return v;
end $$;

-- Crea un alumno completo (domicilio, contactos), lo asigna a una ruta y genera el
-- código con el que su familia se registra y queda vinculada.
-- p_datos: {nombre, colegio, curso, minutos_aviso, mensualidad, ruta_ids: [uuid],
--           domicilio: {direccion, lat, lng, indicaciones}, contactos: [{nombre, telefono, prioridad}]}
create or replace function public.admin_crear_alumno(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_alumno uuid;
  v_domicilio uuid;
  v_contacto jsonb;
  v_ruta text;
  v_codigo text;
begin
  if coalesce(trim(p_datos ->> 'nombre'), '') = '' then raise exception 'Falta el nombre del alumno'; end if;
  if p_datos -> 'domicilio' ->> 'lat' is null then raise exception 'Falta ubicar la casa en el mapa'; end if;

  insert into public.alumnos (empresa_id, nombre, colegio, curso, minutos_aviso, mensualidad)
  values (v_empresa, trim(p_datos ->> 'nombre'), p_datos ->> 'colegio', p_datos ->> 'curso',
    coalesce((p_datos ->> 'minutos_aviso')::smallint, 5), (p_datos ->> 'mensualidad')::integer)
  returning id into v_alumno;

  insert into public.domicilios (alumno_id, direccion, lat, lng, indicaciones)
  values (v_alumno, coalesce(p_datos -> 'domicilio' ->> 'direccion', ''), (p_datos -> 'domicilio' ->> 'lat')::float8,
    (p_datos -> 'domicilio' ->> 'lng')::float8, p_datos -> 'domicilio' ->> 'indicaciones')
  returning id into v_domicilio;

  for v_contacto in select * from jsonb_array_elements(coalesce(p_datos -> 'contactos', '[]')) loop
    insert into public.contactos (alumno_id, nombre, telefono, prioridad)
    values (v_alumno, v_contacto ->> 'nombre', v_contacto ->> 'telefono', (v_contacto ->> 'prioridad')::smallint);
  end loop;

  for v_ruta in select * from jsonb_array_elements_text(coalesce(p_datos -> 'ruta_ids', '[]')) loop
    if not exists (select 1 from public.rutas where id = v_ruta::uuid and empresa_id = v_empresa) then
      raise exception 'Ruta no válida';
    end if;
    insert into public.ruta_paradas (ruta_id, alumno_id, domicilio_id, orden)
    values (v_ruta::uuid, v_alumno, v_domicilio,
      coalesce((select max(orden) + 1 from public.ruta_paradas where ruta_id = v_ruta::uuid), 1));
  end loop;

  v_codigo := public.codigo_familia(v_alumno);
  return jsonb_build_object('alumno_id', v_alumno, 'codigo', v_codigo);
end $$;

-- Código (reutilizable por ambos padres) para que la familia se registre ligada al alumno.
create or replace function public.codigo_familia(p_alumno uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_codigo text;
begin
  if not exists (select 1 from public.alumnos where id = p_alumno and empresa_id = v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select codigo into v_codigo from public.invitaciones
  where alumno_id = p_alumno and usos_restantes > 0 and (expira_en is null or expira_en > now())
  order by creado_en desc limit 1;
  if v_codigo is null then
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.invitaciones (codigo, empresa_id, rol, usos_restantes, expira_en, alumno_id)
    values (v_codigo, v_empresa, 'apoderado', 4, now() + interval '60 days', p_alumno);
  end if;
  return v_codigo;
end $$;

-- Edición de un alumno por el administrador (incluye la mensualidad, que el apoderado no puede tocar).
create or replace function public.admin_actualizar_alumno(p_alumno uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  update public.alumnos set
    nombre = coalesce(nullif(trim(p_datos ->> 'nombre'), ''), nombre),
    colegio = case when p_datos ? 'colegio' then p_datos ->> 'colegio' else colegio end,
    curso = case when p_datos ? 'curso' then p_datos ->> 'curso' else curso end,
    minutos_aviso = coalesce((p_datos ->> 'minutos_aviso')::smallint, minutos_aviso),
    mensualidad = case when p_datos ? 'mensualidad' then (p_datos ->> 'mensualidad')::integer else mensualidad end
  where id = p_alumno and empresa_id = v_empresa;
  if not found then raise exception 'Alumno no encontrado'; end if;
end $$;

-- Sube o baja un alumno en el orden de la ruta.
create or replace function public.mover_parada(p_ruta uuid, p_alumno uuid, p_delta integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_actual public.ruta_paradas;
  v_otro public.ruta_paradas;
begin
  select rp.* into v_actual from public.ruta_paradas rp join public.rutas r on r.id = rp.ruta_id
  where rp.ruta_id = p_ruta and rp.alumno_id = p_alumno and r.empresa_id = v_empresa;
  if v_actual.id is null then raise exception 'Parada no encontrada'; end if;
  select * into v_otro from public.ruta_paradas
  where ruta_id = p_ruta and (case when p_delta < 0 then orden < v_actual.orden else orden > v_actual.orden end)
  order by case when p_delta < 0 then -orden else orden end limit 1;
  if v_otro.id is null then return; end if;
  update public.ruta_paradas set orden = v_otro.orden where id = v_actual.id;
  update public.ruta_paradas set orden = v_actual.orden where id = v_otro.id;
end $$;

-- Genera las mensualidades de un mes para todos los alumnos activos (idempotente).
create or replace function public.generar_cobros(p_periodo date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_n integer;
begin
  insert into public.cobros (empresa_id, alumno_id, periodo, monto, vence_en)
  select v_empresa, a.id, v_periodo, coalesce(a.mensualidad, e.mensualidad_defecto),
    v_periodo + (e.dia_vencimiento - 1)
  from public.alumnos a join public.empresas e on e.id = a.empresa_id
  where a.empresa_id = v_empresa and a.activo
  on conflict (alumno_id, periodo) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.registrar_pago(p_cobro uuid, p_medio text, p_nota text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  update public.cobros set estado = 'pagado', pagado_en = now(), medio = p_medio, nota = p_nota
  where id = p_cobro and empresa_id = v_empresa and estado = 'pendiente';
  if not found then raise exception 'El cobro no existe o no está pendiente'; end if;
end $$;

create or replace function public.anular_cobro(p_cobro uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  update public.cobros set estado = 'anulado', nota = coalesce(p_nota, nota)
  where id = p_cobro and empresa_id = v_empresa and estado = 'pendiente';
  if not found then raise exception 'El cobro no existe o no está pendiente'; end if;
end $$;

-- Da de baja a un alumno: deja de estar en las rutas y se anulan sus cobros futuros.
create or replace function public.dar_de_baja(p_alumno uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  update public.alumnos set activo = false, fecha_baja = current_date, motivo_baja = p_motivo
  where id = p_alumno and empresa_id = v_empresa;
  if not found then raise exception 'Alumno no encontrado'; end if;
  delete from public.ruta_paradas where alumno_id = p_alumno;
  update public.cobros set estado = 'anulado', nota = 'Baja del servicio'
  where alumno_id = p_alumno and estado = 'pendiente' and periodo > date_trunc('month', current_date)::date;
end $$;

-- Responde una solicitud de cancelación: si se aprueba, se da de baja al alumno.
create or replace function public.resolver_cancelacion(p_solicitud uuid, p_aprobar boolean, p_mensaje text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_sol public.solicitudes;
begin
  select * into v_sol from public.solicitudes where id = p_solicitud and empresa_id = v_empresa;
  if v_sol.id is null or v_sol.tipo <> 'cancelacion_servicio' then raise exception 'Solicitud no válida'; end if;
  if v_sol.estado = 'cerrada' then raise exception 'La solicitud ya está cerrada'; end if;
  if coalesce(trim(p_mensaje), '') <> '' then
    insert into public.solicitud_mensajes (solicitud_id, autor_id, cuerpo) values (p_solicitud, auth.uid(), p_mensaje);
  end if;
  if p_aprobar and v_sol.alumno_id is not null then
    perform public.dar_de_baja(v_sol.alumno_id, 'Cancelación solicitada por el apoderado');
  end if;
  update public.solicitudes set estado = 'cerrada', resolucion = case when p_aprobar then 'aprobada' else 'rechazada' end,
    actualizado_en = now()
  where id = p_solicitud;
end $$;

-- Cifras del panel principal.
create or replace function public.resumen_admin()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_mes date := date_trunc('month', current_date)::date;
begin
  return jsonb_build_object(
    'alumnos_activos', (select count(*) from public.alumnos where empresa_id = v_empresa and activo),
    'alumnos_sin_ruta', (select count(*) from public.alumnos a where a.empresa_id = v_empresa and a.activo
      and not exists (select 1 from public.ruta_paradas rp where rp.alumno_id = a.id)),
    'familias_sin_app', (select count(*) from public.alumnos a where a.empresa_id = v_empresa and a.activo
      and not exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = a.id)),
    'recorridos_activos', (select count(*) from public.recorridos where empresa_id = v_empresa and estado = 'activo'),
    'avisos_mes', (select count(*) from public.avisos av join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and av.disparado_en >= v_mes),
    'llamadas_app_mes', (select count(*) from public.llamadas l join public.avisos av on av.id = l.aviso_id
      join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'app' and l.iniciada_en >= v_mes),
    'llamadas_telefono_mes', (select count(*) from public.llamadas l join public.avisos av on av.id = l.aviso_id
      join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'telefono' and l.iniciada_en >= v_mes),
    'minutos_telefono_mes', (select coalesce(sum(ceil(coalesce(l.duracion_seg, 0) / 60.0)), 0) from public.llamadas l
      join public.avisos av on av.id = l.aviso_id join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'telefono' and l.iniciada_en >= v_mes),
    'cobrado_mes', (select coalesce(sum(monto), 0) from public.cobros where empresa_id = v_empresa and periodo = v_mes and estado = 'pagado'),
    'por_cobrar_mes', (select coalesce(sum(monto), 0) from public.cobros where empresa_id = v_empresa and periodo = v_mes and estado = 'pendiente'),
    'morosos', (select count(distinct alumno_id) from public.cobros where empresa_id = v_empresa and estado = 'pendiente' and vence_en < current_date),
    'solicitudes_abiertas', (select count(*) from public.solicitudes where empresa_id = v_empresa and estado = 'abierta')
  );
end $$;

-- El apoderado pide la cancelación del servicio o hace una pregunta (con su primer mensaje).
create or replace function public.crear_solicitud(p_tipo text, p_asunto text, p_mensaje text, p_alumno uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.mi_rol() is distinct from 'apoderado' then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_alumno is not null and not public.es_apoderado_de(p_alumno) then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.solicitudes (empresa_id, alumno_id, autor_id, tipo, asunto)
  values (public.mi_empresa(), p_alumno, auth.uid(), p_tipo, p_asunto) returning id into v_id;
  insert into public.solicitud_mensajes (solicitud_id, autor_id, cuerpo) values (v_id, auth.uid(), p_mensaje);
  return v_id;
end $$;

revoke execute on function public.requiere_admin() from public, anon;
revoke execute on function public.admin_crear_alumno(jsonb) from public, anon;
revoke execute on function public.codigo_familia(uuid) from public, anon;
revoke execute on function public.admin_actualizar_alumno(uuid, jsonb) from public, anon;
revoke execute on function public.mover_parada(uuid, uuid, integer) from public, anon;
revoke execute on function public.generar_cobros(date) from public, anon;
revoke execute on function public.registrar_pago(uuid, text, text) from public, anon;
revoke execute on function public.anular_cobro(uuid, text) from public, anon;
revoke execute on function public.dar_de_baja(uuid, text) from public, anon;
revoke execute on function public.resolver_cancelacion(uuid, boolean, text) from public, anon;
revoke execute on function public.resumen_admin() from public, anon;
revoke execute on function public.crear_solicitud(text, text, text, uuid) from public, anon;
revoke execute on function public.al_escribir_mensaje() from public, anon, authenticated;
grant execute on function public.requiere_admin() to authenticated;
grant execute on function public.admin_crear_alumno(jsonb) to authenticated;
grant execute on function public.codigo_familia(uuid) to authenticated;
grant execute on function public.admin_actualizar_alumno(uuid, jsonb) to authenticated;
grant execute on function public.mover_parada(uuid, uuid, integer) to authenticated;
grant execute on function public.generar_cobros(date) to authenticated;
grant execute on function public.registrar_pago(uuid, text, text) to authenticated;
grant execute on function public.anular_cobro(uuid, text) to authenticated;
grant execute on function public.dar_de_baja(uuid, text) to authenticated;
grant execute on function public.resolver_cancelacion(uuid, boolean, text) to authenticated;
grant execute on function public.resumen_admin() to authenticated;
grant execute on function public.crear_solicitud(text, text, text, uuid) to authenticated;

-- El admin necesita ver a los conductores de su empresa para asignarlos (ya cubierto por
-- la política de perfiles) y quitar paradas de una ruta (cubierto por ruta_paradas).

-- La conversación de una consulta se actualiza en vivo en la app (Realtime respeta RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.solicitud_mensajes;
  end if;
end $$;
