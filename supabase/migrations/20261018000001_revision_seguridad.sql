-- Correcciones de la revisión de seguridad previa al despliegue.
--  1. Códigos de invitación: límite de intentos fallidos y sin nombres de niños en la validación;
--     códigos de familia más largos (alfabeto sin caracteres que se confunden).
--  2. Seguimiento en vivo: nunca la posición exacta cerca de la casa de otro niño del recorrido.
--  3. Un código de familia deja de servir si a quien lo creó lo quitaron de esos hijos.
--  4. Las familias no pueden activar o desactivar al alumno (eso es del transportista).
--  5. Licencia: una rechazada no cuenta, y una sin revisar solo sirve 30 días.
--  6. Eliminar la cuenta de una familia no borra los cobros del transportista: el alumno se da
--     de baja y se borran sus datos personales (domicilio, contactos).
--  7. Paradas y rutas: el alumno, su domicilio y el conductor tienen que ser de la misma empresa.
--  8. Al cerrarse un recorrido por cualquier vía, se cancelan sus llamadas programadas.

-- ---------------------------------------------------------------------------
-- 1) Códigos de invitación
-- ---------------------------------------------------------------------------
create or replace function public.codigo_aleatorio(p_prefijo text, p_largo integer) returns text
language sql volatile set search_path = '' as $$
  select p_prefijo || string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '' order by i)
  from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as b) x, generate_series(0, least(p_largo, 16) - 1) i
$$;

create table public.intentos_codigo (
  clave text not null,
  en timestamptz not null default now()
);
create index on public.intentos_codigo (clave, en);
alter table public.intentos_codigo enable row level security; -- sin políticas: solo funciones internas

-- Quién intenta: la sesión, o la IP si aún no hay sesión.
create or replace function public.clave_intento() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.uid()::text,
    'ip:' || nullif(trim(split_part(coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'sin-ip')
$$;

-- Máximo 10 códigos equivocados por hora (por sesión o IP). No dice de quién es la familia ni
-- los nombres de los hijos: eso se ve después de entrar.
create or replace function public.validar_invitacion(p_codigo text)
returns table (rol public.rol_usuario, empresa text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_clave text := public.clave_intento();
  v_hay boolean := false;
begin
  if (select count(*) from public.intentos_codigo where clave = v_clave and en > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiados códigos equivocados. Espera una hora e inténtalo de nuevo.' using errcode = '54000';
  end if;
  for rol, empresa in
    select i.rol, e.nombre from public.invitaciones i join public.empresas e on e.id = i.empresa_id
    where i.codigo = upper(trim(p_codigo)) and i.usos_restantes > 0 and (i.expira_en is null or i.expira_en > now())
    union all
    select 'apoderado'::public.rol_usuario, 'la familia de ' || split_part(p.nombre, ' ', 1)
    from public.invitaciones_familia f join public.perfiles p on p.id = f.creado_por
    where f.codigo = upper(trim(p_codigo)) and f.usado_por is null and f.expira_en > now()
  loop
    v_hay := true;
    return next;
  end loop;
  if not v_hay then
    insert into public.intentos_codigo (clave) values (v_clave);
    delete from public.intentos_codigo where en < now() - interval '1 day';
  end if;
end $$;
revoke all on function public.validar_invitacion(text) from public;
grant execute on function public.validar_invitacion(text) to anon, authenticated;
revoke all on function public.codigo_aleatorio(text, integer) from public, anon, authenticated;
revoke all on function public.clave_intento() from public, anon, authenticated;

create or replace function public.compartir_familia(p_alumnos uuid[] default null, p_parentesco text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_alumnos uuid[];
  v_codigo text;
begin
  if public.mi_rol() is distinct from 'apoderado' then raise exception 'Solo las familias comparten su perfil' using errcode = '42501'; end if;
  select array_agg(a.id order by a.nombre) into v_alumnos
  from public.alumnos a join public.apoderado_alumno aa on aa.alumno_id = a.id and aa.apoderado_id = auth.uid()
  where a.activo and (p_alumnos is null or a.id = any (p_alumnos));
  if v_alumnos is null then raise exception 'Primero registra a tus hijos'; end if;
  if p_alumnos is not null and cardinality(v_alumnos) <> (select count(distinct x) from unnest(p_alumnos) x) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  v_codigo := public.codigo_aleatorio('F', 8);
  insert into public.invitaciones_familia (codigo, creado_por, alumnos, parentesco)
  values (v_codigo, auth.uid(), v_alumnos, nullif(trim(p_parentesco), ''));
  return v_codigo;
end $$;

-- 3) El código de familia exige que quien lo creó siga a cargo de esos hijos.
create or replace function public.vincular_familia(p_codigo text, p_apoderado uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitaciones_familia;
  v_yo public.perfiles;
  v_alumno uuid;
  v_prioridad smallint;
  v_nombres text[];
begin
  select * into v_inv from public.invitaciones_familia where codigo = upper(trim(p_codigo)) for update;
  if v_inv.codigo is null or v_inv.usado_por is not null or v_inv.expira_en < now() then
    raise exception 'Código de familia inválido, vencido o ya usado';
  end if;
  if v_inv.creado_por = p_apoderado then raise exception 'Este código es para compartir con otra persona'; end if;
  -- Quien creó el código tiene que seguir a cargo de todos esos hijos (si lo quitaron, el código ya no sirve).
  if exists (select 1 from unnest(v_inv.alumnos) x where not exists (
      select 1 from public.apoderado_alumno aa where aa.alumno_id = x and aa.apoderado_id = v_inv.creado_por)) then
    raise exception 'Código de familia inválido, vencido o ya usado';
  end if;
  select * into v_yo from public.perfiles where id = p_apoderado;
  if v_yo.rol <> 'apoderado' then raise exception 'Solo una cuenta de familia puede unirse'; end if;

  foreach v_alumno in array v_inv.alumnos loop
    insert into public.apoderado_alumno (apoderado_id, alumno_id, parentesco, invitado_por)
    values (p_apoderado, v_alumno, v_inv.parentesco, v_inv.creado_por)
    on conflict (apoderado_id, alumno_id) do nothing;
    -- Su teléfono entra a la llamada automática si hay cupo y aún no está.
    if v_yo.telefono is not null and not exists (
      select 1 from public.contactos where alumno_id = v_alumno and telefono = v_yo.telefono) then
      select min(p) into v_prioridad from generate_series(1, 3) p
      where not exists (select 1 from public.contactos where alumno_id = v_alumno and prioridad = p);
      if v_prioridad is not null then
        insert into public.contactos (alumno_id, nombre, telefono, prioridad, apoderado_id)
        values (v_alumno, coalesce(v_inv.parentesco || ' · ', '') || v_yo.nombre, v_yo.telefono, v_prioridad, p_apoderado);
      end if;
    end if;
  end loop;

  -- Sin furgón todavía, toma el de sus hijos.
  update public.perfiles set empresa_id = (select empresa_id from public.alumnos where id = v_inv.alumnos[1])
  where id = p_apoderado and empresa_id is null;
  update public.invitaciones_familia set usado_por = p_apoderado where codigo = v_inv.codigo;
  select array_agg(nombre order by nombre) into v_nombres from public.alumnos where id = any (v_inv.alumnos);
  return v_nombres;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Posición exacta nunca cerca de la casa de otro niño del recorrido
-- ---------------------------------------------------------------------------
create or replace function public.cerca_de_otra_casa(p_recorrido uuid, p_lat double precision, p_lng double precision, p_apoderado uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recorrido_alumnos ra join public.domicilios d on d.id = ra.domicilio_id
    where ra.recorrido_id = p_recorrido
      and not exists (select 1 from public.apoderado_alumno aa where aa.alumno_id = ra.alumno_id and aa.apoderado_id = p_apoderado)
      and public.distancia_m(p_lat, p_lng, d.lat, d.lng) < 300
  )
$$;
revoke all on function public.cerca_de_otra_casa(uuid, double precision, double precision, uuid) from public, anon, authenticated;

create or replace function public.puede_ver_posicion(p_recorrido uuid, p_registrada_en timestamptz, p_lat double precision, p_lng double precision)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recorridos r
    where r.id = p_recorrido and r.estado = 'activo' and (
      r.conductor_id = auth.uid()
      or public.es_admin_de(r.empresa_id)
      or (exists (
        select 1 from public.recorrido_alumnos ra
        join public.apoderado_alumno aa on aa.alumno_id = ra.alumno_id
        left join public.avisos av on av.recorrido_alumno_id = ra.id
        where ra.recorrido_id = r.id and aa.apoderado_id = auth.uid() and (
          (ra.estado = 'pendiente' and av.disparado_en is not null and p_registrada_en >= av.disparado_en)
          or (public.va_a_bordo(ra.estado, r.tipo, ra.a_bordo_desde) and p_registrada_en >= ra.a_bordo_desde)
        )
      ) and not public.cerca_de_otra_casa(r.id, p_lat, p_lng, auth.uid()))
    )
  )
$$;
revoke all on function public.puede_ver_posicion(uuid, timestamptz, double precision, double precision) from public, anon;
grant execute on function public.puede_ver_posicion(uuid, timestamptz, double precision, double precision) to authenticated;

drop policy "ver posiciones (solo recorrido activo, desde el aviso)" on public.posiciones;
create policy "ver posiciones (recorrido activo, autorizado y lejos de otras casas)" on public.posiciones for select
  using (public.puede_ver_posicion(recorrido_id, registrada_en, lat, lng));

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
  -- Nunca la posición exacta cerca de la casa de otro niño del recorrido.
  v_exacta := ((v.aviso_en is not null and v.estado = 'pendiente') or v_a_bordo)
    and (v.ultima_lat is null or not public.cerca_de_otra_casa(v.recorrido_id, v.ultima_lat, v.ultima_lng, auth.uid()));
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
-- 4) Activar o desactivar al alumno es del transportista (dar_de_baja / reactivar)
-- ---------------------------------------------------------------------------
revoke update on public.alumnos from authenticated;
grant update (nombre, colegio, curso, minutos_aviso) on public.alumnos to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Licencia vigente para iniciar recorridos
-- ---------------------------------------------------------------------------
-- Cuenta la última licencia aprobada, o una sin revisar subida hace menos de 30 días (para que
-- la tía pueda seguir trabajando mientras la revisan). Las rechazadas no cuentan.
create or replace function public.validar_licencia_al_iniciar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_tiene boolean;
  v_vence date;
begin
  select exists (select 1 from public.licencias where conductor_id = new.conductor_id) into v_tiene;
  if not v_tiene then return new; end if; -- sin licencia registrada: lo maneja el administrador
  select max(vence_en) into v_vence from public.licencias
  where conductor_id = new.conductor_id
    and (estado = 'aprobada' or (estado = 'pendiente' and creado_en > now() - interval '30 days'));
  if v_vence is null then
    raise exception 'Tu licencia de conducir fue rechazada o lleva más de 30 días sin revisar. Sube la licencia al día en «Mi licencia» para iniciar recorridos.';
  elsif v_vence < v_hoy then
    raise exception 'Tu licencia de conducir venció el %. Sube la renovada en «Mi licencia» para iniciar recorridos.', to_char(v_vence, 'DD-MM-YYYY');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Eliminar la cuenta de una familia conserva los cobros del transportista
-- ---------------------------------------------------------------------------
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
revoke all on function public.eliminar_datos_de_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_datos_de_cuenta(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Paradas y rutas dentro de la misma empresa
-- ---------------------------------------------------------------------------
create or replace function public.validar_parada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.rutas r
    join public.alumnos a on a.id = new.alumno_id and a.empresa_id = r.empresa_id
    join public.domicilios d on d.id = new.domicilio_id and d.alumno_id = a.id
    where r.id = new.ruta_id
  ) then
    raise exception 'El alumno o su domicilio no corresponden a esta ruta' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger parada_de_la_empresa before insert or update on public.ruta_paradas
  for each row execute function public.validar_parada();

create or replace function public.validar_conductor_de_ruta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.conductor_id is not null and not exists (
    select 1 from public.perfiles p where p.id = new.conductor_id and p.empresa_id = new.empresa_id and p.rol in ('conductor', 'admin')
  ) then
    raise exception 'El conductor no pertenece a esta empresa' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger conductor_de_la_empresa before insert or update of conductor_id, empresa_id on public.rutas
  for each row execute function public.validar_conductor_de_ruta();
create trigger conductor_de_la_empresa before insert or update of conductor_id, empresa_id on public.furgones
  for each row execute function public.validar_conductor_de_ruta();

-- ---------------------------------------------------------------------------
-- 8) Recorrido cerrado (por la tía, el administrador o el cierre automático): sin más llamadas
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_llamadas_al_cerrar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.llamadas l set estado = 'cancelada', finalizada_en = now()
  from public.avisos av where av.id = l.aviso_id and av.recorrido_id = new.id and l.estado = 'programada';
  return new;
end $$;
create trigger sin_llamadas_al_cerrar after update of estado on public.recorridos
  for each row when (old.estado = 'activo' and new.estado <> 'activo')
  execute function public.cancelar_llamadas_al_cerrar();


-- ---------------------------------------------------------------------------
-- 9) Fechas de licencias en hora de Chile (como los avisos de vencimiento)
-- ---------------------------------------------------------------------------
create or replace function public.subir_licencia(p_numero text, p_clase text, p_vence_en date, p_foto_frente text, p_foto_reverso text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_yo public.perfiles;
  v_id uuid;
begin
  select * into v_yo from public.perfiles where id = auth.uid();
  if v_yo.rol is distinct from 'conductor' or v_yo.empresa_id is null then
    raise exception 'Solo la tía o el tío del furgón sube su licencia' using errcode = '42501';
  end if;
  if p_vence_en < (now() at time zone 'America/Santiago')::date then raise exception 'Esa licencia ya está vencida'; end if;
  if p_foto_frente is null then raise exception 'Falta la foto de la licencia'; end if;
  -- Las fotos deben estar en su carpeta del bucket.
  if split_part(p_foto_frente, '/', 1) <> auth.uid()::text
     or (p_foto_reverso is not null and split_part(p_foto_reverso, '/', 1) <> auth.uid()::text) then
    raise exception 'Foto no válida';
  end if;
  insert into public.licencias (conductor_id, empresa_id, numero, clase, vence_en, foto_frente, foto_reverso)
  values (auth.uid(), v_yo.empresa_id, upper(trim(p_numero)), upper(trim(p_clase)), p_vence_en, p_foto_frente, p_foto_reverso)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.estado_licencias()
returns table (conductor_id uuid, conductor text, licencia_id uuid, numero text, clase text, vence_en date,
               dias_restantes integer, estado text, motivo_rechazo text, revisada_en timestamptz, foto_frente text, foto_reverso text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, l.id, l.numero, l.clase, l.vence_en, (l.vence_en - (now() at time zone 'America/Santiago')::date)::integer,
    case when l.id is null then 'sin_licencia'
         when l.vence_en < (now() at time zone 'America/Santiago')::date then 'vencida'
         when l.estado = 'rechazada' then 'rechazada'
         when l.estado = 'pendiente' then 'por_verificar'
         when l.vence_en - (now() at time zone 'America/Santiago')::date <= 30 then 'por_vencer'
         else 'vigente' end,
    l.motivo_rechazo, l.revisada_en, l.foto_frente, l.foto_reverso
  from public.perfiles p
  left join lateral (
    select * from public.licencias x where x.conductor_id = p.id order by x.creado_en desc limit 1
  ) l on true
  where p.rol = 'conductor' and p.empresa_id = public.mi_empresa()
    and (p.id = auth.uid() or public.soy_admin())
  order by p.nombre
$$;
