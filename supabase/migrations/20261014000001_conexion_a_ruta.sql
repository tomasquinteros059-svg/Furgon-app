-- =============================================================================
-- Al aceptar a una familia, la tía elige en qué rutas va (ida, vuelta o ambas).
-- Cada hijo que esa familia registre entra solo a esas rutas, en el lugar donde menos
-- alarga el recorrido, y aparece como «nuevo» en el panel principal de la tía.
-- =============================================================================

alter table public.conexiones add column rutas uuid[] not null default '{}';
alter table public.ruta_paradas add column agregado_en timestamptz not null default now();

-- Inserta al alumno en la posición que menos alarga la ruta (inserción más barata).
-- La ida termina en el colegio y la vuelta parte de él. Devuelve el número de parada.
create or replace function public.agregar_a_ruta_en_mejor_lugar(p_ruta uuid, p_alumno uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_ruta public.rutas;
  v_dom public.domicilios;
  v_lat float8[] := '{}';
  v_lng float8[] := '{}';
  v_fila record;
  v_n integer;
  v_k integer;
  v_mejor integer;
  v_costo float8;
  v_menor float8 := 'infinity';
  v_hay_prev boolean;
  v_hay_sig boolean;
  v_plat float8; v_plng float8; v_slat float8; v_slng float8;
begin
  select orden into v_k from public.ruta_paradas where ruta_id = p_ruta and alumno_id = p_alumno;
  if v_k is not null then return v_k; end if;
  select * into v_ruta from public.rutas where id = p_ruta;
  select * into v_dom from public.domicilios where alumno_id = p_alumno order by principal desc, creado_en desc limit 1;
  if v_ruta.id is null or v_dom.id is null then raise exception 'Ruta o domicilio no encontrado'; end if;

  -- Numeración limpia 1..n antes de insertar.
  update public.ruta_paradas rp set orden = o.n
  from (select id, row_number() over (order by orden) as n from public.ruta_paradas where ruta_id = p_ruta) o
  where rp.id = o.id;
  for v_fila in select d.lat, d.lng from public.ruta_paradas rp join public.domicilios d on d.id = rp.domicilio_id
                where rp.ruta_id = p_ruta order by rp.orden loop
    v_lat := v_lat || v_fila.lat; v_lng := v_lng || v_fila.lng;
  end loop;
  v_n := coalesce(array_length(v_lat, 1), 0);

  -- Probar cada hueco: antes de la parada k (k = n + 1 es al final).
  for v_k in 1 .. v_n + 1 loop
    v_hay_prev := v_k > 1 or (v_ruta.tipo = 'vuelta' and v_ruta.colegio_lat is not null);
    v_hay_sig := v_k <= v_n or (v_ruta.tipo = 'ida' and v_ruta.colegio_lat is not null);
    if v_k > 1 then v_plat := v_lat[v_k - 1]; v_plng := v_lng[v_k - 1]; else v_plat := v_ruta.colegio_lat; v_plng := v_ruta.colegio_lng; end if;
    if v_k <= v_n then v_slat := v_lat[v_k]; v_slng := v_lng[v_k]; else v_slat := v_ruta.colegio_lat; v_slng := v_ruta.colegio_lng; end if;
    v_costo := 0;
    if v_hay_prev then v_costo := v_costo + public.distancia_m(v_plat, v_plng, v_dom.lat, v_dom.lng); end if;
    if v_hay_sig then v_costo := v_costo + public.distancia_m(v_dom.lat, v_dom.lng, v_slat, v_slng); end if;
    if v_hay_prev and v_hay_sig then v_costo := v_costo - public.distancia_m(v_plat, v_plng, v_slat, v_slng); end if;
    if v_costo < v_menor - 0.01 then v_menor := v_costo; v_mejor := v_k; end if;
  end loop;

  update public.ruta_paradas set orden = orden + 1 where ruta_id = p_ruta and orden >= v_mejor;
  insert into public.ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values (p_ruta, p_alumno, v_dom.id, v_mejor);
  return v_mejor;
end $$;

-- Agrega a los hijos (activos, de la empresa de la tía y aún sin ruta) a las rutas de la conexión.
create or replace function public.agregar_hijos_de_conexion(p_conexion uuid, p_alumno uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_c public.conexiones;
  v_empresa uuid;
  v_alumno uuid;
  v_ruta uuid;
  v_n integer := 0;
begin
  select * into v_c from public.conexiones where id = p_conexion and estado = 'aceptada';
  if v_c.id is null then return 0; end if;
  select empresa_id into v_empresa from public.perfiles where id = v_c.conductor_id;
  for v_alumno in
    select a.id from public.apoderado_alumno aa join public.alumnos a on a.id = aa.alumno_id
    where aa.apoderado_id = v_c.apoderado_id and a.activo and a.empresa_id = v_empresa
      and (p_alumno is null or a.id = p_alumno)
      and (p_alumno is not null or not exists (select 1 from public.ruta_paradas rp where rp.alumno_id = a.id))
  loop
    for v_ruta in
      select r.id from public.rutas r
      where r.id = any (v_c.rutas) and r.activa and r.conductor_id = v_c.conductor_id
    loop
      perform public.agregar_a_ruta_en_mejor_lugar(v_ruta, v_alumno);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- Solo valen rutas de la propia tía.
create or replace function public.rutas_validas(p_conductor uuid, p_rutas uuid[])
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(r.id), '{}') from public.rutas r
  where r.id = any (coalesce(p_rutas, '{}')) and r.conductor_id = p_conductor and r.activa
$$;

drop function public.solicitar_conexion(uuid, text);
create function public.solicitar_conexion(p_otro uuid, p_mensaje text default null, p_rutas uuid[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rol public.rol_usuario := public.mi_rol();
  v_otro public.perfiles;
  v_apoderado uuid;
  v_conductor public.perfiles;
  v_c public.conexiones;
  v_rutas uuid[];
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
  -- Cuando invita la tía, ya elige las rutas; cuando pide la familia, las elige al aceptar.
  v_rutas := case when v_rol = 'conductor' then public.rutas_validas(v_conductor.id, p_rutas) else '{}' end;

  select * into v_c from public.conexiones where apoderado_id = v_apoderado and conductor_id = v_conductor.id;
  if v_c.id is not null then
    if v_c.estado = 'aceptada' then raise exception 'Ya están conectados'; end if;
    if v_c.estado = 'pendiente' then raise exception 'Ya hay una solicitud pendiente'; end if;
    if v_c.estado = 'rechazada' and v_c.respondido_en > now() - interval '7 days' then
      raise exception 'La solicitud fue rechazada hace poco. Podrás volver a intentarlo en unos días.';
    end if;
    update public.conexiones set estado = 'pendiente', iniciada_por = v_rol::text, mensaje = nullif(trim(p_mensaje), ''),
      rutas = v_rutas, creado_en = now(), respondido_en = null
    where id = v_c.id;
    return v_c.id;
  end if;
  insert into public.conexiones (apoderado_id, conductor_id, iniciada_por, mensaje, rutas)
  values (v_apoderado, v_conductor.id, v_rol::text, nullif(trim(p_mensaje), ''), v_rutas)
  returning id into v_c.id;
  return v_c.id;
end $$;

drop function public.responder_conexion(uuid, boolean);
create function public.responder_conexion(p_conexion uuid, p_aceptar boolean, p_rutas uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_c public.conexiones;
begin
  select * into v_c from public.conexiones where id = p_conexion for update;
  if v_c.id is null or v_c.estado <> 'pendiente' then raise exception 'Solicitud no encontrada'; end if;
  if not ((v_c.iniciada_por = 'apoderado' and v_c.conductor_id = auth.uid())
       or (v_c.iniciada_por = 'conductor' and v_c.apoderado_id = auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not p_aceptar then
    update public.conexiones set estado = 'rechazada', respondido_en = now() where id = p_conexion;
    return 0;
  end if;
  update public.perfiles set empresa_id = (select empresa_id from public.perfiles where id = v_c.conductor_id)
  where id = v_c.apoderado_id and empresa_id is null;
  update public.conexiones set estado = 'aceptada', respondido_en = now(),
    -- La tía elige las rutas al aceptar; si aceptó la familia, quedan las de la invitación.
    rutas = case when v_c.iniciada_por = 'apoderado' then public.rutas_validas(v_c.conductor_id, p_rutas) else rutas end
  where id = p_conexion;
  -- Hijos que la familia ya tenía registrados con este furgón y sin ruta: entran de inmediato.
  return public.agregar_hijos_de_conexion(p_conexion);
end $$;

-- Al registrar a un hijo, entra solo a las rutas de la tía con la que está conectada la familia.
create or replace function public.registrar_alumno(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid;
  v_contacto jsonb;
  v_empresa uuid := public.mi_empresa();
  v_conductor uuid := nullif(p_datos ->> 'conductor_id', '')::uuid;
  v_c uuid;
begin
  if public.mi_rol() is distinct from 'apoderado' then
    raise exception 'Solo un apoderado puede registrar alumnos' using errcode = '42501';
  end if;
  if v_conductor is not null then
    select p.empresa_id into v_empresa
    from public.conexiones c join public.perfiles p on p.id = c.conductor_id
    where c.apoderado_id = auth.uid() and c.conductor_id = v_conductor and c.estado = 'aceptada';
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

  -- A las rutas que eligió la tía (de la conexión con este furgón).
  for v_c in
    select c.id from public.conexiones c join public.perfiles p on p.id = c.conductor_id
    where c.apoderado_id = auth.uid() and c.estado = 'aceptada' and p.empresa_id = v_empresa
      and (v_conductor is null or c.conductor_id = v_conductor)
  loop
    perform public.agregar_hijos_de_conexion(v_c, v_alumno);
  end loop;

  return v_alumno;
end $$;

-- Mis conexiones, ahora con las rutas elegidas (solo las ve la tía).
drop function public.mis_conexiones();
create function public.mis_conexiones()
returns table (id uuid, estado text, iniciada_por text, mensaje text, creado_en timestamptz,
               otro_id uuid, otro_nombre text, empresa text, comunas text, hijos text[], rutas text[])
language sql stable security definer set search_path = '' as $$
  select c.id, c.estado, c.iniciada_por, c.mensaje, c.creado_en,
    o.id, o.nombre, e.nombre, case when o.rol = 'conductor' then o.comunas end,
    case when o.rol = 'apoderado' and c.estado = 'aceptada' then (
      select coalesce(array_agg(a.nombre order by a.nombre), '{}') from public.apoderado_alumno aa
      join public.alumnos a on a.id = aa.alumno_id and a.activo where aa.apoderado_id = o.id) end,
    case when c.conductor_id = auth.uid() then (
      select coalesce(array_agg(r.nombre order by r.hora_salida), '{}') from public.rutas r where r.id = any (c.rutas)) end
  from public.conexiones c
  join public.perfiles o on o.id = case when c.apoderado_id = auth.uid() then c.conductor_id else c.apoderado_id end
  left join public.empresas e on e.id = o.empresa_id and o.rol = 'conductor'
  where (c.apoderado_id = auth.uid() or c.conductor_id = auth.uid()) and c.estado in ('pendiente', 'aceptada')
  order by c.estado = 'aceptada', c.creado_en desc
$$;

-- Panel principal de la tía: alumnos que se sumaron a sus rutas en los últimos días.
create or replace function public.nuevos_en_mis_rutas(p_dias integer default 3)
returns table (alumno text, ruta text, tipo public.tipo_recorrido, parada integer, agregado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.nombre, r.nombre, r.tipo, rp.orden, rp.agregado_en
  from public.ruta_paradas rp
  join public.rutas r on r.id = rp.ruta_id and r.conductor_id = auth.uid() and r.activa
  join public.alumnos a on a.id = rp.alumno_id and a.activo
  where rp.agregado_en > now() - make_interval(days => greatest(1, least(p_dias, 30)))
  order by rp.agregado_en desc, r.hora_salida
$$;

revoke execute on function public.agregar_a_ruta_en_mejor_lugar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.agregar_hijos_de_conexion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rutas_validas(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.solicitar_conexion(uuid, text, uuid[]) from public, anon;
revoke execute on function public.responder_conexion(uuid, boolean, uuid[]) from public, anon;
revoke execute on function public.mis_conexiones() from public, anon;
revoke execute on function public.nuevos_en_mis_rutas(integer) from public, anon;
grant execute on function public.solicitar_conexion(uuid, text, uuid[]) to authenticated;
grant execute on function public.responder_conexion(uuid, boolean, uuid[]) to authenticated;
grant execute on function public.mis_conexiones() to authenticated;
grant execute on function public.nuevos_en_mis_rutas(integer) to authenticated;
