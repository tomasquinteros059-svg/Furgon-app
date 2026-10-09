-- Correcciones del QA (revisión funcional de la base de datos).
--  1. «Hoy no va»: deshacer un tramo cuando estaba marcado el día completo deja marcado el otro,
--     y una parada solo vuelve a «pendiente» si ninguna inasistencia la sigue cubriendo.
--  2. La tía no puede volver a «pendiente» a un niño que su familia marcó «hoy no viaja».
--  3. iniciar_recorrido: un doble toque devuelve el mismo recorrido; uno de un día anterior que
--     quedó abierto se cierra y se crea el de hoy.
--  4. registrar_aviso y reclamar_llamadas: nada de avisos ni llamadas si el niño ya fue atendido,
--     el aviso ya se confirmó o el recorrido terminó.
--  5. Fechas en hora de Chile (no UTC) en bajas, cobros y el resumen del panel.
--  6. generar_cobros de un mes pasado usa quién estaba inscrito ese mes.
--  7. Eliminar la cuenta de una familia anula sus cobros de meses futuros (como una baja).
--  8. dejar_de_compartir: dos familiares que salen a la vez no dejan al niño sin apoderado.


-- 1) «Hoy no va»
create or replace function public.marcar_no_viaja(p_alumno uuid, p_fecha date, p_tipo text, p_no_viaja boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_apoderado_de(p_alumno)
          or public.es_conductor_de_alumno(p_alumno)
          or public.es_admin_de((select empresa_id from public.alumnos where id = p_alumno))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('ida', 'vuelta', 'ambos') then raise exception 'Tipo no válido'; end if;
  if p_no_viaja then
    insert into public.inasistencias (alumno_id, fecha, tipo, creado_por)
    values (p_alumno, p_fecha, p_tipo, auth.uid()) on conflict do nothing;
  else
    delete from public.inasistencias where alumno_id = p_alumno and fecha = p_fecha and tipo = p_tipo;
    -- Estaba marcado el día completo y se deshace un tramo: queda marcado solo el otro.
    if p_tipo <> 'ambos' and exists (
        select 1 from public.inasistencias where alumno_id = p_alumno and fecha = p_fecha and tipo = 'ambos') then
      delete from public.inasistencias where alumno_id = p_alumno and fecha = p_fecha and tipo = 'ambos';
      insert into public.inasistencias (alumno_id, fecha, tipo, creado_por)
      values (p_alumno, p_fecha, case p_tipo when 'ida' then 'vuelta' else 'ida' end, auth.uid()) on conflict do nothing;
    end if;
  end if;

  -- Si el recorrido de hoy ya partió, se actualiza al tiro: la tía se salta esa casa.
  update public.recorrido_alumnos ra
  set estado = case when p_no_viaja then 'no_viaja'::public.estado_parada else 'pendiente'::public.estado_parada end
  from public.recorridos r
  join public.empresas e on e.id = r.empresa_id
  where ra.recorrido_id = r.id and ra.alumno_id = p_alumno and r.estado = 'activo'
    and (r.iniciado_en at time zone e.zona_horaria)::date = p_fecha
    and (p_tipo = 'ambos' or r.tipo::text = p_tipo)
    and ra.estado = case when p_no_viaja then 'pendiente'::public.estado_parada else 'no_viaja'::public.estado_parada end
    -- Al deshacer, solo si ya ninguna inasistencia cubre ese tramo.
    and (p_no_viaja or not exists (
      select 1 from public.inasistencias i
      where i.alumno_id = p_alumno and i.fecha = p_fecha and i.tipo in (r.tipo::text, 'ambos')));

  -- Ya no hay que avisar a esa familia: se cancelan sus llamadas pendientes.
  if p_no_viaja then
    update public.llamadas l set estado = 'cancelada', finalizada_en = now()
    from public.avisos av
    join public.recorrido_alumnos ra on ra.id = av.recorrido_alumno_id
    where l.aviso_id = av.id and l.estado = 'programada' and ra.alumno_id = p_alumno and ra.estado = 'no_viaja';
  end if;
end $$;

-- 2) La tía no cambia una parada «hoy no viaja»
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
  if exists (select 1 from public.recorrido_alumnos where id = p_parada and estado = 'no_viaja') then
    raise exception 'La familia marcó que hoy no viaja. Si sí viaja, quítalo en «Hoy no va».';
  end if;

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

-- 3) Iniciar recorrido
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

  select (now() at time zone e.zona_horaria)::date into v_hoy from public.empresas e where e.id = v_ruta.empresa_id;

  -- Uno abierto de un día anterior (no se cerró solo): se cierra y se empieza el de hoy.
  update public.recorridos r set estado = 'finalizado', finalizado_en = now(), eta_cache = null
  from public.empresas e
  where r.ruta_id = p_ruta and r.estado = 'activo' and e.id = r.empresa_id
    and (r.iniciado_en at time zone e.zona_horaria)::date < v_hoy;
  select id into v_id from public.recorridos where ruta_id = p_ruta and estado = 'activo';
  if v_id is not null then return v_id; end if;

  begin
    insert into public.recorridos (ruta_id, empresa_id, conductor_id, furgon_id, tipo)
    values (p_ruta, v_ruta.empresa_id, auth.uid(), v_ruta.furgon_id, v_ruta.tipo)
    returning id into v_id;
  exception when unique_violation then
    -- Doble toque: el otro intento ya lo creó.
    select id into v_id from public.recorridos where ruta_id = p_ruta and estado = 'activo';
    return v_id;
  end;

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

-- 4) Avisos y llamadas solo si todavía sirven
create or replace function public.registrar_aviso(p_parada uuid, p_motivo public.motivo_aviso, p_eta_seg integer)
returns uuid language sql security definer set search_path = '' as $$
  insert into public.avisos (recorrido_id, recorrido_alumno_id, alumno_id, motivo, eta_seg)
  select ra.recorrido_id, ra.id, ra.alumno_id, p_motivo, p_eta_seg
  from public.recorrido_alumnos ra
  join public.recorridos r on r.id = ra.recorrido_id and r.estado = 'activo'
  where ra.id = p_parada and ra.estado = 'pendiente'
  on conflict do nothing
  returning id
$$;

create or replace function public.reclamar_llamadas(p_limite integer default 20)
returns setof public.llamadas language plpgsql security definer set search_path = '' as $$
begin
  -- Las que ya no hacen falta (confirmado, niño atendido, recorrido cerrado) se cancelan.
  update public.llamadas l set estado = 'cancelada', finalizada_en = now()
  from public.avisos av
  join public.recorrido_alumnos ra on ra.id = av.recorrido_alumno_id
  join public.recorridos r on r.id = av.recorrido_id
  where l.aviso_id = av.id and l.estado = 'programada' and l.programada_para <= now()
    and (av.confirmado_en is not null or ra.estado <> 'pendiente' or r.estado <> 'activo');
  return query
  update public.llamadas set estado = 'en_curso', iniciada_en = now()
  where id in (
    select id from public.llamadas
    where estado = 'programada' and programada_para <= now()
    order by programada_para
    for update skip locked
    limit p_limite
  )
  returning *;
end $$;


-- 5) Fechas en hora de Chile
create or replace function public.dar_de_baja(p_alumno uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_hoy date := public.hoy_empresa();
begin
  update public.alumnos set activo = false, fecha_baja = v_hoy, motivo_baja = p_motivo
  where id = p_alumno and empresa_id = v_empresa;
  if not found then raise exception 'Alumno no encontrado'; end if;
  delete from public.ruta_paradas where alumno_id = p_alumno;
  update public.cobros set estado = 'anulado', nota = 'Baja del servicio'
  where alumno_id = p_alumno and estado = 'pendiente' and periodo > date_trunc('month', v_hoy)::date;
end $$;

create or replace function public.resumen_admin()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_hoy date := public.hoy_empresa();
  v_mes date := date_trunc('month', v_hoy)::date;
  -- Inicio del mes en hora de Chile, para comparar con fechas y horas guardadas en UTC.
  v_desde timestamptz := v_mes::timestamp at time zone coalesce((select zona_horaria from public.empresas where id = v_empresa), 'America/Santiago');
begin
  return jsonb_build_object(
    'alumnos_activos', (select count(*) from public.alumnos where empresa_id = v_empresa and activo),
    'alumnos_sin_ruta', (select count(*) from public.alumnos a where a.empresa_id = v_empresa and a.activo
      and not exists (select 1 from public.ruta_paradas rp where rp.alumno_id = a.id)),
    'familias_sin_app', (select count(*) from public.alumnos a where a.empresa_id = v_empresa and a.activo
      and not exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = a.id)),
    'recorridos_activos', (select count(*) from public.recorridos where empresa_id = v_empresa and estado = 'activo'),
    'avisos_mes', (select count(*) from public.avisos av join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and av.disparado_en >= v_desde),
    'llamadas_app_mes', (select count(*) from public.llamadas l join public.avisos av on av.id = l.aviso_id
      join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'app' and l.iniciada_en >= v_desde),
    'llamadas_telefono_mes', (select count(*) from public.llamadas l join public.avisos av on av.id = l.aviso_id
      join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'telefono' and l.iniciada_en >= v_desde),
    'minutos_telefono_mes', (select coalesce(sum(ceil(coalesce(l.duracion_seg, 0) / 60.0)), 0) from public.llamadas l
      join public.avisos av on av.id = l.aviso_id join public.recorridos r on r.id = av.recorrido_id
      where r.empresa_id = v_empresa and l.canal = 'telefono' and l.iniciada_en >= v_desde),
    'cobrado_mes', (select coalesce(sum(monto), 0) from public.cobros where empresa_id = v_empresa and periodo = v_mes and estado = 'pagado'),
    'por_cobrar_mes', (select coalesce(sum(monto), 0) from public.cobros where empresa_id = v_empresa and periodo = v_mes and estado = 'pendiente'),
    'morosos', (select count(distinct alumno_id) from public.cobros where empresa_id = v_empresa and estado = 'pendiente' and vence_en < v_hoy),
    'solicitudes_abiertas', (select count(*) from public.solicitudes where empresa_id = v_empresa and estado = 'abierta')
  );
end $$;

-- 6) Cobros del mes según quién estaba inscrito
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
  -- Inscritos ese mes: creados antes de que terminara y sin baja antes de que empezara.
  where a.empresa_id = v_empresa
    and a.creado_en < (v_periodo + interval '1 month')
    and (a.activo or (a.fecha_baja is not null and a.fecha_baja >= v_periodo))
  on conflict (alumno_id, periodo) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 7) Eliminar cuenta: sin cobros futuros
create or replace function public.eliminar_datos_de_cuenta(p_usuario uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
  v_fotos text[];
  v_solos uuid[];
begin
  select * into v_perfil from public.perfiles where id = p_usuario;
  if v_perfil.id is null then return '{}'; end if;

  if public.es_ultimo_admin(p_usuario) then
    select coalesce(array_agg(f), '{}') into v_fotos
      from public.licencias l, unnest(array[l.foto_frente, l.foto_reverso]) f
      where l.empresa_id = v_perfil.empresa_id and f is not null;
    -- Es su propio servicio: se borra completo. Las familias quedan con su cuenta, sin empresa.
    delete from public.empresas where id = v_perfil.empresa_id;
    return v_fotos;
  end if;

  select coalesce(array_agg(f), '{}') into v_fotos
    from public.licencias l, unnest(array[l.foto_frente, l.foto_reverso]) f
    where l.conductor_id = p_usuario and f is not null;

  -- Hijos sin otro apoderado: se dan de baja del furgón y se borran sus datos personales
  -- (domicilio, contactos, rutas). Su nombre y sus cobros quedan para la contabilidad del
  -- transportista, como dice la política de privacidad.
  select coalesce(array_agg(a.id), '{}') into v_solos
  from public.alumnos a
  where exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = a.id and aa.apoderado_id = p_usuario)
    and not exists (select 1 from public.apoderado_alumno o where o.alumno_id = a.id and o.apoderado_id <> p_usuario);
  update public.alumnos set activo = false, fecha_baja = coalesce(fecha_baja, (now() at time zone 'America/Santiago')::date),
    motivo_baja = coalesce(motivo_baja, 'La familia eliminó su cuenta')
  where id = any (v_solos);
  delete from public.ruta_paradas where alumno_id = any (v_solos);
  -- Como una baja: se anulan los cobros pendientes de meses futuros.
  update public.cobros c set estado = 'anulado', nota = 'Baja del servicio'
  from public.alumnos a join public.empresas e on e.id = a.empresa_id
  where c.alumno_id = a.id and a.id = any (v_solos) and c.estado = 'pendiente'
    and c.periodo > date_trunc('month', (now() at time zone e.zona_horaria)::date)::date;
  delete from public.contactos where alumno_id = any (v_solos);
  delete from public.invitaciones where alumno_id = any (v_solos);
  -- El historial de recorridos apunta al domicilio: se deja sin dirección ni coordenadas.
  update public.domicilios set direccion = '(eliminada)', indicaciones = null, lat = 0, lng = 0
  where alumno_id = any (v_solos);

  -- Hijos compartidos: se quita su teléfono de los contactos de llamada.
  delete from public.contactos c
  where c.apoderado_id = p_usuario
     or (v_perfil.telefono is not null and c.telefono = v_perfil.telefono
         and exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = c.alumno_id and aa.apoderado_id = p_usuario));
  delete from public.invitaciones_familia where creado_por = p_usuario and usado_por is null;

  return v_fotos;
end;
$$;

-- 8) Dejar de compartir, de a uno
create or replace function public.dejar_de_compartir(p_alumno uuid, p_apoderado uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_vinculo public.apoderado_alumno;
begin
  select * into v_vinculo from public.apoderado_alumno where alumno_id = p_alumno and apoderado_id = p_apoderado;
  if v_vinculo.apoderado_id is null then raise exception 'No encontrado'; end if;
  if not (p_apoderado = auth.uid() or (coalesce(v_vinculo.invitado_por = auth.uid(), false) and public.es_apoderado_de(p_alumno))) then
    raise exception 'Solo puedes quitar a quien tú invitaste' using errcode = '42501';
  end if;
  perform 1 from public.alumnos where id = p_alumno for update; -- uno a la vez por niño
  if (select count(*) from public.apoderado_alumno where alumno_id = p_alumno) <= 1 then
    raise exception 'Eres el único apoderado: no puedes dejarlo sin nadie a cargo';
  end if;
  delete from public.apoderado_alumno where alumno_id = p_alumno and apoderado_id = p_apoderado;
  delete from public.contactos where alumno_id = p_alumno and apoderado_id = p_apoderado;
end $$;
