-- =============================================================================
-- Rutas recomendadas, "hoy no va" desde la ruta y precios editables en cobros.
-- =============================================================================

-- Fecha de hoy en la zona horaria de la empresa del usuario (para "hoy no va").
create or replace function public.hoy_empresa() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(e.zona_horaria, 'America/Santiago'))::date
  from public.empresas e where e.id = public.mi_empresa()
$$;

-- Guarda un orden completo para la ruta (por ejemplo, el recomendado).
-- p_alumnos debe traer exactamente a los mismos alumnos que ya están en la ruta.
create or replace function public.aplicar_orden_ruta(p_ruta uuid, p_alumnos uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_actuales uuid[];
begin
  if not exists (select 1 from public.rutas where id = p_ruta and empresa_id = v_empresa) then
    raise exception 'Ruta no encontrada';
  end if;
  select coalesce(array_agg(alumno_id order by alumno_id), '{}') into v_actuales
  from public.ruta_paradas where ruta_id = p_ruta;
  if cardinality(p_alumnos) <> cardinality(v_actuales)
     or (select array_agg(x order by x) from unnest(p_alumnos) x) is distinct from v_actuales
     or (select count(distinct x) from unnest(p_alumnos) x) <> cardinality(p_alumnos) then
    raise exception 'La ruta cambió mientras la revisabas: vuelve a pedir la recomendación';
  end if;
  update public.ruta_paradas rp set orden = o.pos
  from unnest(p_alumnos) with ordinality as o(alumno_id, pos)
  where rp.ruta_id = p_ruta and rp.alumno_id = o.alumno_id;
end $$;

-- "Hoy no viaja": además del apoderado y de quien administra, la tía que lleva al alumno
-- también puede marcarlo (botón «Hoy no va» en sus rutas).
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
  end if;

  -- Si el recorrido de hoy ya partió, se actualiza al tiro: la tía se salta esa casa.
  update public.recorrido_alumnos ra
  set estado = case when p_no_viaja then 'no_viaja'::public.estado_parada else 'pendiente'::public.estado_parada end
  from public.recorridos r
  join public.empresas e on e.id = r.empresa_id
  where ra.recorrido_id = r.id and ra.alumno_id = p_alumno and r.estado = 'activo'
    and (r.iniciado_en at time zone e.zona_horaria)::date = p_fecha
    and (p_tipo = 'ambos' or r.tipo::text = p_tipo)
    and ra.estado = case when p_no_viaja then 'pendiente'::public.estado_parada else 'no_viaja'::public.estado_parada end;

  -- Ya no hay que avisar a esa familia: se cancelan sus llamadas pendientes.
  if p_no_viaja then
    update public.llamadas l set estado = 'cancelada', finalizada_en = now()
    from public.avisos av
    join public.recorrido_alumnos ra on ra.id = av.recorrido_alumno_id
    where l.aviso_id = av.id and l.estado = 'programada' and ra.alumno_id = p_alumno and ra.estado = 'no_viaja';
  end if;
end $$;

-- Precio (mensualidad) de un alumno. Se aplica también a sus cobros pendientes desde p_desde
-- (por ejemplo, el mes en curso), para que la contabilidad de la tía cuadre.
create or replace function public.fijar_mensualidad(p_alumno uuid, p_monto integer, p_desde date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_n integer := 0;
begin
  if p_monto is null or p_monto < 0 then raise exception 'El precio no puede ser negativo'; end if;
  update public.alumnos set mensualidad = p_monto where id = p_alumno and empresa_id = v_empresa;
  if not found then raise exception 'Alumno no encontrado'; end if;
  if p_desde is not null then
    update public.cobros set monto = p_monto
    where alumno_id = p_alumno and empresa_id = v_empresa and estado = 'pendiente'
      and periodo >= date_trunc('month', p_desde)::date;
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end $$;

-- Cambia el monto de un cobro pendiente (descuento, mes incompleto, etc.).
create or replace function public.cambiar_monto_cobro(p_cobro uuid, p_monto integer, p_nota text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  if p_monto is null or p_monto < 0 then raise exception 'El monto no puede ser negativo'; end if;
  update public.cobros set monto = p_monto, nota = coalesce(nullif(trim(p_nota), ''), nota)
  where id = p_cobro and empresa_id = v_empresa and estado = 'pendiente';
  if not found then raise exception 'Solo se puede cambiar el monto de un cobro pendiente'; end if;
end $$;

revoke execute on function public.hoy_empresa() from public, anon;
revoke execute on function public.aplicar_orden_ruta(uuid, uuid[]) from public, anon;
revoke execute on function public.fijar_mensualidad(uuid, integer, date) from public, anon;
revoke execute on function public.cambiar_monto_cobro(uuid, integer, text) from public, anon;
grant execute on function public.hoy_empresa() to authenticated;
grant execute on function public.aplicar_orden_ruta(uuid, uuid[]) to authenticated;
grant execute on function public.fijar_mensualidad(uuid, integer, date) to authenticated;
grant execute on function public.cambiar_monto_cobro(uuid, integer, text) to authenticated;
