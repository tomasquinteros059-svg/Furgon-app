-- =============================================================================
-- 1) «Ya subió mi hijo/a»: mientras el alumno va a bordo, su familia sigue el furgón
--    en vivo (posición exacta), además de la ventana aviso → llegada que ya existía.
-- 2) Conexiones familia ↔ tía/tío: la familia busca a su tía o tío del furgón y le pide
--    conectarse; la tía busca a una familia (por correo o teléfono exactos) y la invita.
--    Al aceptar, la familia puede registrar a sus hijos con esa tía. Una familia puede
--    estar conectada con varias (por ejemplo, hermanos que van a colegios distintos).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) A bordo
-- ---------------------------------------------------------------------------

alter table public.recorrido_alumnos
  add column a_bordo_desde timestamptz,
  add column a_bordo_por text check (a_bordo_por in ('familia', 'tia'));

-- ¿Este alumno va a bordo ahora? En la vuelta, hasta que llega a su hogar; en la ida,
-- desde que subió hasta que termina el recorrido (llegada al colegio).
create or replace function public.va_a_bordo(p_estado public.estado_parada, p_tipo public.tipo_recorrido, p_desde timestamptz)
returns boolean language sql immutable as $$
  select p_desde is not null and (p_estado = 'pendiente' or (p_tipo = 'ida' and p_estado = 'entregado'))
$$;

-- Distancia aproximada en metros (para validar que el furgón está en la casa).
create or replace function public.distancia_m(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8 language sql immutable as $$
  select 12742000 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))
$$;

-- La familia avisa que su hijo/a ya subió al furgón.
--  * Vuelta: los niños suben en el colegio al empezar, así que basta con que el recorrido
--    esté en curso y el alumno pendiente.
--  * Ida: el furgón tiene que estar en la casa (a menos de 300 m) o la tía ya lo marcó.
--    Así nadie puede ver la posición exacta mientras el furgón recoge a otros niños.
create or replace function public.confirmar_subida(p_alumno uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if not public.es_apoderado_de(p_alumno) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select ra.id, ra.estado, ra.a_bordo_desde, r.tipo, r.ultima_lat, r.ultima_lng, d.lat, d.lng
  into v
  from public.recorrido_alumnos ra
  join public.recorridos r on r.id = ra.recorrido_id and r.estado = 'activo'
  join public.domicilios d on d.id = ra.domicilio_id
  where ra.alumno_id = p_alumno
  order by r.iniciado_en desc limit 1;

  if v.id is null then raise exception 'No hay un recorrido en curso para tu hijo/a'; end if;
  if v.estado in ('ausente', 'no_viaja') then raise exception 'Hoy está marcado como que no viaja'; end if;
  if v.tipo = 'vuelta' and v.estado <> 'pendiente' then raise exception 'Ya está en su hogar'; end if;
  if v.tipo = 'ida' and v.estado = 'pendiente' and (
       v.ultima_lat is null or public.distancia_m(v.ultima_lat, v.ultima_lng, v.lat, v.lng) > 300) then
    raise exception 'El furgón todavía no llega a tu casa. Toca el botón cuando tu hijo/a se suba.';
  end if;

  update public.recorrido_alumnos
  set a_bordo_desde = coalesce(a_bordo_desde, now()), a_bordo_por = coalesce(a_bordo_por, 'familia')
  where id = v.id;
  return jsonb_build_object('a_bordo_desde', coalesce(v.a_bordo_desde, now()));
end $$;

-- La tía marca «Subió» en la ida: también queda a bordo (y la familia lo puede seguir).
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
  set estado = p_estado,
      marcado_en = case when p_estado = 'pendiente' then null else now() end,
      a_bordo_desde = case
        when p_estado = 'entregado' and v ->> 'tipo' = 'ida' then coalesce(a_bordo_desde, now())
        when p_estado = 'pendiente' and a_bordo_por = 'tia' then null
        else a_bordo_desde end,
      a_bordo_por = case
        when p_estado = 'entregado' and v ->> 'tipo' = 'ida' then coalesce(a_bordo_por, 'tia')
        when p_estado = 'pendiente' and a_bordo_por = 'tia' then null
        else a_bordo_por end
  where id = p_parada;

  if p_estado <> 'pendiente' then
    update public.llamadas l set estado = 'cancelada', finalizada_en = now()
    from public.avisos av where av.id = l.aviso_id and av.recorrido_alumno_id = p_parada and l.estado = 'programada';
  end if;
  return v;
end $$;

-- Posiciones que puede leer la familia: desde el aviso hasta la llegada (como antes) o
-- desde que su hijo/a subió mientras va a bordo.
create or replace function public.puede_ver_posicion(p_recorrido uuid, p_registrada_en timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recorridos r
    where r.id = p_recorrido and r.estado = 'activo' and (
      r.conductor_id = auth.uid()
      or public.es_admin_de(r.empresa_id)
      or exists (
        select 1 from public.recorrido_alumnos ra
        join public.apoderado_alumno aa on aa.alumno_id = ra.alumno_id
        left join public.avisos av on av.recorrido_alumno_id = ra.id
        where ra.recorrido_id = r.id and aa.apoderado_id = auth.uid() and (
          (ra.estado = 'pendiente' and av.disparado_en is not null and p_registrada_en >= av.disparado_en)
          or (public.va_a_bordo(ra.estado, r.tipo, ra.a_bordo_desde) and p_registrada_en >= ra.a_bordo_desde)
        )
      )
    )
  )
$$;

create or replace function public.seguimiento_furgon(p_alumno uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
  v_exacta boolean;
  v_a_bordo boolean;
  v_antes integer;
begin
  if not public.es_apoderado_de(p_alumno) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select ra.orden, ra.estado, ra.eta_seg, ra.marcado_en, ra.a_bordo_desde, ra.a_bordo_por,
         r.id as recorrido_id, r.tipo, r.iniciado_en, r.ultima_lat, r.ultima_lng, r.ultima_posicion_en,
         av.disparado_en as aviso_en, av.confirmado_en,
         pc.nombre as conductor, f.patente, f.descripcion as furgon,
         d.lat as casa_lat, d.lng as casa_lng
  into v
  from public.recorrido_alumnos ra
  join public.recorridos r on r.id = ra.recorrido_id and r.estado = 'activo'
  join public.domicilios d on d.id = ra.domicilio_id
  left join public.avisos av on av.recorrido_alumno_id = ra.id
  left join public.perfiles pc on pc.id = r.conductor_id
  left join public.furgones f on f.id = r.furgon_id
  where ra.alumno_id = p_alumno
  order by r.iniciado_en desc
  limit 1;

  if v.recorrido_id is null then
    return null; -- no hay recorrido activo: nada que mostrar
  end if;

  v_a_bordo := public.va_a_bordo(v.estado, v.tipo, v.a_bordo_desde);
  v_exacta := (v.aviso_en is not null and v.estado = 'pendiente') or v_a_bordo;
  select count(*) into v_antes
  from public.recorrido_alumnos x
  where x.recorrido_id = v.recorrido_id and x.estado = 'pendiente' and x.orden < v.orden;

  return jsonb_build_object(
    'recorrido_id', v.recorrido_id,
    'tipo', v.tipo,
    'iniciado_en', v.iniciado_en,
    'estado', v.estado,
    'eta_seg', v.eta_seg,
    'marcado_en', v.marcado_en,
    'paradas_antes', v_antes,
    'aviso_en', v.aviso_en,
    'confirmado_en', v.confirmado_en,
    'a_bordo', v_a_bordo,
    'a_bordo_desde', v.a_bordo_desde,
    'a_bordo_por', v.a_bordo_por,
    'conductor', v.conductor,
    'patente', v.patente,
    'furgon', v.furgon,
    'casa', jsonb_build_object('lat', v.casa_lat, 'lng', v.casa_lng),
    'ubicacion', case
      when v.ultima_lat is null or not (v.estado = 'pendiente' or v_a_bordo) then null
      when v_exacta then jsonb_build_object(
        'exacta', true, 'lat', v.ultima_lat, 'lng', v.ultima_lng, 'en', v.ultima_posicion_en)
      else jsonb_build_object(
        'exacta', false, 'lat', round(v.ultima_lat::numeric, 2), 'lng', round(v.ultima_lng::numeric, 2),
        'radio_m', 1000, 'en', v.ultima_posicion_en)
    end
  );
end $$;

-- ---------------------------------------------------------------------------
-- 2) Conexiones familia ↔ tía/tío
-- ---------------------------------------------------------------------------

-- La tía decide si aparece en la búsqueda de las familias y qué muestra.
alter table public.perfiles
  add column visible_en_busqueda boolean not null default false,
  add column comunas text,
  add column presentacion text check (presentacion is null or length(presentacion) <= 300);
grant update (visible_en_busqueda, comunas, presentacion) on public.perfiles to authenticated;

create table public.conexiones (
  id uuid primary key default gen_random_uuid(),
  apoderado_id uuid not null references public.perfiles (id) on delete cascade,
  conductor_id uuid not null references public.perfiles (id) on delete cascade,
  iniciada_por text not null check (iniciada_por in ('apoderado', 'conductor')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  mensaje text check (mensaje is null or length(mensaje) <= 500),
  creado_en timestamptz not null default now(),
  respondido_en timestamptz,
  unique (apoderado_id, conductor_id)
);
create index on public.conexiones (conductor_id, estado);
alter table public.conexiones enable row level security;
create policy "ver mis conexiones" on public.conexiones for select
  using (apoderado_id = auth.uid() or conductor_id = auth.uid());
-- Sin políticas de escritura: todo pasa por las funciones de abajo.

-- Una familia sin código de invitación también puede crear su cuenta (como apoderado,
-- sin empresa) y luego conectarse con su tía o tío desde la búsqueda.
create or replace function public.crear_perfil_desde_invitacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text := upper(trim(new.raw_user_meta_data ->> 'codigo_invitacion'));
  v_inv public.invitaciones;
  v_tel text := nullif(trim(new.raw_user_meta_data ->> 'telefono'), '');
  v_nombre text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1));
begin
  if v_codigo is null or v_codigo = '' then
    if coalesce(new.raw_user_meta_data ->> 'sin_codigo', '') = 'familia' then
      insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (new.id, null, 'apoderado', v_nombre, v_tel);
    end if;
    return new;
  end if;
  select * into v_inv from public.invitaciones where codigo = v_codigo for update;
  if v_inv.codigo is null or v_inv.usos_restantes <= 0 or (v_inv.expira_en is not null and v_inv.expira_en < now()) then
    raise exception 'Código de invitación inválido o vencido';
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

-- El hijo queda en el furgón de la tía elegida (p_datos.conductor_id, con conexión aceptada)
-- o, si no se elige, en el furgón de la familia. Sin furgón, primero hay que conectarse.
create or replace function public.registrar_alumno(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid;
  v_contacto jsonb;
  v_empresa uuid := public.mi_empresa();
begin
  if public.mi_rol() is distinct from 'apoderado' then
    raise exception 'Solo un apoderado puede registrar alumnos' using errcode = '42501';
  end if;
  if nullif(p_datos ->> 'conductor_id', '') is not null then
    select p.empresa_id into v_empresa
    from public.conexiones c join public.perfiles p on p.id = c.conductor_id
    where c.apoderado_id = auth.uid() and c.conductor_id = (p_datos ->> 'conductor_id')::uuid and c.estado = 'aceptada';
    if v_empresa is null then raise exception 'No estás conectado/a con esa tía o tío'; end if;
  end if;
  if v_empresa is null then
    raise exception 'Primero conéctate con tu tía o tío del furgón (botón «Conectar con mi tía o tío»).';
  end if;
  if coalesce(trim(p_datos ->> 'nombre'), '') = '' then raise exception 'Falta el nombre del alumno'; end if;
  if jsonb_array_length(coalesce(p_datos -> 'contactos', '[]')) = 0 then
    raise exception 'Debe registrar al menos un teléfono de contacto';
  end if;

  insert into public.alumnos (empresa_id, nombre, colegio, curso, minutos_aviso)
  values (
    v_empresa, trim(p_datos ->> 'nombre'), p_datos ->> 'colegio', p_datos ->> 'curso',
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

-- La familia busca a su tía o tío: solo aparecen quienes activaron «aparecer en la búsqueda».
create or replace function public.buscar_tias(p_texto text)
returns table (id uuid, nombre text, empresa text, comunas text, presentacion text, conexion text, conexion_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := '%' || lower(trim(coalesce(p_texto, ''))) || '%';
begin
  if public.mi_rol() is distinct from 'apoderado' then
    raise exception 'Solo las familias pueden buscar tías o tíos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 2 then return; end if;
  return query
    select p.id, p.nombre, e.nombre, p.comunas, p.presentacion, c.estado, c.id
    from public.perfiles p
    join public.empresas e on e.id = p.empresa_id
    left join public.conexiones c on c.conductor_id = p.id and c.apoderado_id = auth.uid()
    where p.rol = 'conductor' and p.visible_en_busqueda
      and (lower(p.nombre) like v_q or lower(e.nombre) like v_q or lower(coalesce(p.comunas, '')) like v_q)
    order by p.nombre
    limit 20;
end $$;

-- La tía busca a una familia. Para proteger a las familias, solo con el correo o el
-- teléfono exactos (no se puede recorrer la lista de apoderados).
create or replace function public.buscar_familia(p_texto text)
returns table (id uuid, nombre text, conexion text, conexion_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t text := lower(trim(coalesce(p_texto, '')));
  v_tel text := regexp_replace(v_t, '[^0-9]', '', 'g');
begin
  if public.mi_rol() is distinct from 'conductor' then
    raise exception 'Solo la tía o el tío del furgón puede buscar familias' using errcode = '42501';
  end if;
  -- Teléfono chileno escrito sin código de país (9 dígitos que empiezan en 9).
  if length(v_tel) = 9 and v_tel like '9%' then v_tel := '56' || v_tel; end if;
  return query
    select p.id, p.nombre, c.estado, c.id
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.conexiones c on c.apoderado_id = p.id and c.conductor_id = auth.uid()
    where p.rol = 'apoderado' and (
      (position('@' in v_t) > 0 and lower(u.email) = v_t)
      or (length(v_tel) >= 8 and p.telefono = '+' || v_tel)
    )
    limit 5;
end $$;

-- Pedir conexión (la familia a una tía, o la tía a una familia que encontró).
create or replace function public.solicitar_conexion(p_otro uuid, p_mensaje text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rol public.rol_usuario := public.mi_rol();
  v_otro public.perfiles;
  v_apoderado uuid;
  v_conductor public.perfiles;
  v_c public.conexiones;
begin
  select * into v_otro from public.perfiles where id = p_otro;
  if v_rol = 'apoderado' then
    if v_otro.id is null or v_otro.rol <> 'conductor' or not v_otro.visible_en_busqueda then
      raise exception 'Tía o tío no encontrado';
    end if;
    v_apoderado := auth.uid(); v_conductor := v_otro;
  elsif v_rol = 'conductor' then
    if v_otro.id is null or v_otro.rol <> 'apoderado' then raise exception 'Familia no encontrada'; end if;
    v_apoderado := v_otro.id;
    select * into v_conductor from public.perfiles where id = auth.uid();
  else
    raise exception 'Solo familias y conductores pueden conectarse' using errcode = '42501';
  end if;
  if v_conductor.empresa_id is null then raise exception 'La tía o el tío aún no tiene furgón registrado'; end if;

  select * into v_c from public.conexiones where apoderado_id = v_apoderado and conductor_id = v_conductor.id;
  if v_c.id is not null then
    if v_c.estado = 'aceptada' then raise exception 'Ya están conectados'; end if;
    if v_c.estado = 'pendiente' then raise exception 'Ya hay una solicitud pendiente'; end if;
    -- Para no insistir: tras un rechazo, una nueva solicitud solo después de 7 días.
    if v_c.estado = 'rechazada' and v_c.respondido_en > now() - interval '7 days' then
      raise exception 'La solicitud fue rechazada hace poco. Podrás volver a intentarlo en unos días.';
    end if;
    update public.conexiones set estado = 'pendiente', iniciada_por = v_rol::text, mensaje = nullif(trim(p_mensaje), ''),
      creado_en = now(), respondido_en = null
    where id = v_c.id;
    return v_c.id;
  end if;
  insert into public.conexiones (apoderado_id, conductor_id, iniciada_por, mensaje)
  values (v_apoderado, v_conductor.id, v_rol::text, nullif(trim(p_mensaje), ''))
  returning id into v_c.id;
  return v_c.id;
end $$;

-- Responde quien recibió la solicitud. Si la familia aún no tenía furgón, este pasa a ser
-- el suyo (avisos, preguntas frecuentes); con más de uno, elige al registrar a cada hijo.
create or replace function public.responder_conexion(p_conexion uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.conexiones;
begin
  select * into v_c from public.conexiones where id = p_conexion for update;
  if v_c.id is null or v_c.estado <> 'pendiente' then raise exception 'Solicitud no encontrada'; end if;
  if not ((v_c.iniciada_por = 'apoderado' and v_c.conductor_id = auth.uid())
       or (v_c.iniciada_por = 'conductor' and v_c.apoderado_id = auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_aceptar then
    update public.perfiles set empresa_id = (select empresa_id from public.perfiles where id = v_c.conductor_id)
    where id = v_c.apoderado_id and empresa_id is null;
  end if;
  update public.conexiones set estado = case when p_aceptar then 'aceptada' else 'rechazada' end, respondido_en = now()
  where id = p_conexion;
end $$;

-- Quien envió una solicitud pendiente la puede retirar.
create or replace function public.cancelar_conexion(p_conexion uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.conexiones set estado = 'cancelada', respondido_en = now()
  where id = p_conexion and estado = 'pendiente'
    and ((iniciada_por = 'apoderado' and apoderado_id = auth.uid()) or (iniciada_por = 'conductor' and conductor_id = auth.uid()));
  if not found then raise exception 'Solicitud no encontrada'; end if;
end $$;

-- Mis conexiones con los datos del otro lado. A la tía se le muestran los nombres de los
-- hijos de las familias conectadas (para ubicarlos), nunca sus direcciones ni teléfonos.
create or replace function public.mis_conexiones()
returns table (id uuid, estado text, iniciada_por text, mensaje text, creado_en timestamptz,
               otro_id uuid, otro_nombre text, empresa text, comunas text, hijos text[])
language sql stable security definer set search_path = '' as $$
  select c.id, c.estado, c.iniciada_por, c.mensaje, c.creado_en,
    o.id, o.nombre, e.nombre, case when o.rol = 'conductor' then o.comunas end,
    case when o.rol = 'apoderado' and c.estado = 'aceptada' then (
      select coalesce(array_agg(a.nombre order by a.nombre), '{}') from public.apoderado_alumno aa
      join public.alumnos a on a.id = aa.alumno_id and a.activo where aa.apoderado_id = o.id) end
  from public.conexiones c
  join public.perfiles o on o.id = case when c.apoderado_id = auth.uid() then c.conductor_id else c.apoderado_id end
  left join public.empresas e on e.id = o.empresa_id and o.rol = 'conductor'
  where (c.apoderado_id = auth.uid() or c.conductor_id = auth.uid()) and c.estado in ('pendiente', 'aceptada')
  order by c.estado = 'aceptada', c.creado_en desc
$$;

-- Las solicitudes (preguntas, cancelaciones) van al furgón del hijo del que se trata.
create or replace function public.crear_solicitud(p_tipo text, p_asunto text, p_mensaje text, p_alumno uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_empresa uuid;
begin
  if public.mi_rol() is distinct from 'apoderado' then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_alumno is not null and not public.es_apoderado_de(p_alumno) then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_empresa := coalesce((select empresa_id from public.alumnos where id = p_alumno), public.mi_empresa());
  if v_empresa is null then raise exception 'Primero conéctate con tu tía o tío del furgón'; end if;
  insert into public.solicitudes (empresa_id, alumno_id, autor_id, tipo, asunto)
  values (v_empresa, p_alumno, auth.uid(), p_tipo, p_asunto) returning id into v_id;
  insert into public.solicitud_mensajes (solicitud_id, autor_id, cuerpo) values (v_id, auth.uid(), p_mensaje);
  return v_id;
end $$;

revoke execute on function public.confirmar_subida(uuid) from public, anon;
revoke execute on function public.buscar_tias(text) from public, anon;
revoke execute on function public.buscar_familia(text) from public, anon;
revoke execute on function public.solicitar_conexion(uuid, text) from public, anon;
revoke execute on function public.responder_conexion(uuid, boolean) from public, anon;
revoke execute on function public.cancelar_conexion(uuid) from public, anon;
revoke execute on function public.mis_conexiones() from public, anon;
grant execute on function public.confirmar_subida(uuid) to authenticated;
grant execute on function public.buscar_tias(text) to authenticated;
grant execute on function public.buscar_familia(text) to authenticated;
grant execute on function public.solicitar_conexion(uuid, text) to authenticated;
grant execute on function public.responder_conexion(uuid, boolean) to authenticated;
grant execute on function public.cancelar_conexion(uuid) to authenticated;
grant execute on function public.mis_conexiones() to authenticated;
