-- =============================================================================
-- Seguimiento en vivo para el apoderado (mapa tipo Uber)
--
--  * Durante todo el recorrido: zona APROXIMADA del furgón (lat/lng redondeadas a
--    0,01° ≈ 1 km), paradas que faltan antes de su casa y ETA.
--  * Desde el aviso de su hijo hasta la entrega: posición EXACTA y el trayecto
--    recorrido desde ese momento.
--  Así la mamá ve el avance en tiempo real sin poder deducir dónde viven los demás niños.
-- =============================================================================

create or replace function public.seguimiento_furgon(p_alumno uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
  v_exacta boolean;
  v_antes integer;
begin
  if not public.es_apoderado_de(p_alumno) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select ra.orden, ra.estado, ra.eta_seg, ra.marcado_en,
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

  v_exacta := v.aviso_en is not null and v.estado = 'pendiente';
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
    'conductor', v.conductor,
    'patente', v.patente,
    'furgon', v.furgon,
    'casa', jsonb_build_object('lat', v.casa_lat, 'lng', v.casa_lng),
    'ubicacion', case
      when v.ultima_lat is null or v.estado <> 'pendiente' then null
      when v_exacta then jsonb_build_object(
        'exacta', true, 'lat', v.ultima_lat, 'lng', v.ultima_lng, 'en', v.ultima_posicion_en)
      else jsonb_build_object(
        'exacta', false, 'lat', round(v.ultima_lat::numeric, 2), 'lng', round(v.ultima_lng::numeric, 2),
        'radio_m', 1000, 'en', v.ultima_posicion_en)
    end
  );
end $$;

revoke execute on function public.seguimiento_furgon(uuid) from public, anon;
grant execute on function public.seguimiento_furgon(uuid) to authenticated;

-- El apoderado solo puede leer las posiciones registradas DESDE el aviso de su hijo
-- (antes podía leer el historial completo del recorrido durante su ventana, incluidas
-- las detenciones en otras casas).
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
        join public.avisos av on av.recorrido_alumno_id = ra.id
        where ra.recorrido_id = r.id and aa.apoderado_id = auth.uid() and ra.estado = 'pendiente'
          and p_registrada_en >= av.disparado_en
      )
    )
  )
$$;

drop policy "ver posiciones (solo recorrido activo y autorizado)" on public.posiciones;
create policy "ver posiciones (solo recorrido activo, desde el aviso)" on public.posiciones for select
  using (public.puede_ver_posicion(recorrido_id, registrada_en));
