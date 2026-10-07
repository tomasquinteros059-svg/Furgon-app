-- =============================================================================
-- Furgones (vista principal del administrador) y licencias de conducir verificadas.
--
--  * Cada furgón tiene patente, modelo, capacidad y su tía o tío a cargo.
--  * La tía sube su licencia (número, clase, vencimiento y fotos); el administrador la
--    revisa y la aprueba o rechaza. Queda el registro de quién la revisó y cuándo.
--  * Se avisa a la tía (push) y al administrador (panel) a los 60, 30, 15, 7 y 1 días
--    del vencimiento. Con la licencia vencida no se puede iniciar un recorrido.
-- =============================================================================

alter table public.furgones
  add column modelo text,
  add column capacidad smallint check (capacidad is null or capacidad between 1 and 60),
  add column conductor_id uuid references public.perfiles (id) on delete set null,
  add column activo boolean not null default true,
  add column creado_en timestamptz not null default now();

create type public.estado_licencia as enum ('pendiente', 'aprobada', 'rechazada');

create table public.licencias (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null references public.perfiles (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero text not null check (length(trim(numero)) between 3 and 30),
  clase text not null check (clase in ('A1', 'A2', 'A3', 'A4', 'A5', 'B')),
  vence_en date not null,
  foto_frente text,   -- ruta en el bucket privado «licencias»
  foto_reverso text,
  estado public.estado_licencia not null default 'pendiente',
  motivo_rechazo text,
  revisada_por uuid references public.perfiles (id) on delete set null,
  revisada_en timestamptz,
  creado_en timestamptz not null default now()
);
create index on public.licencias (empresa_id, vence_en);
create index on public.licencias (conductor_id, creado_en desc);

-- Avisos de vencimiento ya enviados (uno por licencia y umbral).
create table public.avisos_licencia (
  licencia_id uuid not null references public.licencias (id) on delete cascade,
  umbral_dias smallint not null,
  enviado_en timestamptz not null default now(),
  primary key (licencia_id, umbral_dias)
);

alter table public.licencias enable row level security;
alter table public.avisos_licencia enable row level security;
create policy "ver licencias" on public.licencias for select
  using (conductor_id = auth.uid() or public.es_admin_de(empresa_id));
-- Escrituras solo por las funciones de abajo.

-- La tía sube (o renueva) su licencia. Queda pendiente de verificación.
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
  if p_vence_en < current_date then raise exception 'Esa licencia ya está vencida'; end if;
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

-- El administrador aprueba o rechaza (con motivo) la licencia.
create or replace function public.revisar_licencia(p_licencia uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  if not p_aprobar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indica el motivo del rechazo para que la tía pueda corregirlo';
  end if;
  update public.licencias set
    estado = case when p_aprobar then 'aprobada'::public.estado_licencia else 'rechazada'::public.estado_licencia end,
    motivo_rechazo = case when p_aprobar then null else trim(p_motivo) end,
    revisada_por = auth.uid(), revisada_en = now()
  where id = p_licencia and empresa_id = v_empresa and conductor_id <> auth.uid(); -- nadie aprueba la propia
  if not found then raise exception 'Licencia no encontrada'; end if;
end $$;

-- Licencia vigente (la más reciente) de cada conductora, con su situación.
create or replace function public.estado_licencias()
returns table (conductor_id uuid, conductor text, licencia_id uuid, numero text, clase text, vence_en date,
               dias_restantes integer, estado text, motivo_rechazo text, revisada_en timestamptz, foto_frente text, foto_reverso text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, l.id, l.numero, l.clase, l.vence_en, (l.vence_en - current_date)::integer,
    case when l.id is null then 'sin_licencia'
         when l.vence_en < current_date then 'vencida'
         when l.estado = 'rechazada' then 'rechazada'
         when l.estado = 'pendiente' then 'por_verificar'
         when l.vence_en - current_date <= 30 then 'por_vencer'
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

-- Con la licencia vencida no se puede iniciar un recorrido.
create or replace function public.validar_licencia_al_iniciar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_vence date;
begin
  select vence_en into v_vence from public.licencias
  where conductor_id = new.conductor_id order by creado_en desc limit 1;
  if v_vence is not null and v_vence < (now() at time zone 'America/Santiago')::date then
    raise exception 'Tu licencia de conducir venció el %. Sube la renovada en «Mi licencia» para iniciar recorridos.', to_char(v_vence, 'DD-MM-YYYY');
  end if;
  return new;
end $$;
create trigger licencia_vigente before insert on public.recorridos
  for each row execute function public.validar_licencia_al_iniciar();

-- Licencias que llegan hoy a un umbral de aviso y aún no se avisaron (para la función
-- programada «avisos-licencias»). Marca el aviso como enviado al devolverlo.
create or replace function public.licencias_para_avisar()
returns table (licencia_id uuid, conductor_id uuid, conductor text, empresa_id uuid, vence_en date, dias integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with candidatas as (
    select distinct on (l.conductor_id) l.id, l.conductor_id, p.nombre, l.empresa_id, l.vence_en,
      (l.vence_en - (now() at time zone 'America/Santiago')::date)::integer as dias
    from public.licencias l join public.perfiles p on p.id = l.conductor_id
    where l.estado <> 'rechazada'
    order by l.conductor_id, l.creado_en desc
  ), umbrales as (
    select c.*, u.umbral from candidatas c
    -- El umbral es el menor que todavía cubre los días que faltan (25 días → aviso de 30).
    cross join lateral (select min(x) as umbral from unnest(array[60, 30, 15, 7, 1, 0]) x where x >= c.dias) u
    where u.umbral is not null and c.dias >= -1
  ), nuevos as (
    insert into public.avisos_licencia (licencia_id, umbral_dias)
    select id, umbral from umbrales on conflict do nothing
    returning licencia_id
  )
  select u.id, u.conductor_id, u.nombre, u.empresa_id, u.vence_en, u.dias
  from umbrales u join nuevos n on n.licencia_id = u.id;
end $$;

-- Furgones de la empresa con su tía, rutas, alumnos y situación de la licencia.
create or replace function public.resumen_furgones()
returns table (id uuid, patente text, modelo text, descripcion text, capacidad smallint, activo boolean,
               conductor_id uuid, conductor text, rutas text[], alumnos integer, licencia text, licencia_vence date)
language sql stable security definer set search_path = '' as $$
  select f.id, f.patente, f.modelo, f.descripcion, f.capacidad, f.activo, f.conductor_id, p.nombre,
    (select coalesce(array_agg(r.nombre order by r.hora_salida), '{}') from public.rutas r where r.furgon_id = f.id and r.activa),
    (select count(distinct rp.alumno_id)::integer from public.rutas r join public.ruta_paradas rp on rp.ruta_id = r.id
       join public.alumnos a on a.id = rp.alumno_id and a.activo where r.furgon_id = f.id and r.activa),
    el.estado, el.vence_en
  from public.furgones f
  left join public.perfiles p on p.id = f.conductor_id
  left join lateral (select * from public.estado_licencias() e where e.conductor_id = f.conductor_id) el on true
  where f.empresa_id = public.requiere_admin()
  order by f.activo desc, f.patente
$$;

-- Crear o editar un furgón (y asignarle sus rutas).
create or replace function public.guardar_furgon(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := public.requiere_admin();
  v_id uuid := nullif(p_datos ->> 'id', '')::uuid;
  v_conductor uuid := nullif(p_datos ->> 'conductor_id', '')::uuid;
begin
  if coalesce(trim(p_datos ->> 'patente'), '') = '' then raise exception 'Falta la patente'; end if;
  if v_conductor is not null and not exists (
    select 1 from public.perfiles where id = v_conductor and empresa_id = v_empresa and rol = 'conductor') then
    raise exception 'Conductora no encontrada';
  end if;
  if v_id is null then
    insert into public.furgones (empresa_id, patente, modelo, descripcion, capacidad, conductor_id)
    values (v_empresa, upper(trim(p_datos ->> 'patente')), p_datos ->> 'modelo', p_datos ->> 'descripcion',
      nullif(p_datos ->> 'capacidad', '')::smallint, v_conductor)
    returning id into v_id;
  else
    update public.furgones set patente = upper(trim(p_datos ->> 'patente')), modelo = p_datos ->> 'modelo',
      descripcion = p_datos ->> 'descripcion', capacidad = nullif(p_datos ->> 'capacidad', '')::smallint,
      conductor_id = v_conductor, activo = coalesce((p_datos ->> 'activo')::boolean, activo)
    where id = v_id and empresa_id = v_empresa;
    if not found then raise exception 'Furgón no encontrado'; end if;
  end if;
  if p_datos ? 'ruta_ids' then
    update public.rutas set furgon_id = null where furgon_id = v_id and empresa_id = v_empresa
      and not (id = any (array(select jsonb_array_elements_text(p_datos -> 'ruta_ids')::uuid)));
    update public.rutas set furgon_id = v_id
    where empresa_id = v_empresa and id = any (array(select jsonb_array_elements_text(p_datos -> 'ruta_ids')::uuid));
  end if;
  return v_id;
end $$;

-- Bucket privado para las fotos de las licencias (solo en Supabase; en las pruebas no existe).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('licencias', 'licencias', false) on conflict (id) do nothing;
    execute $p$create policy "tia sube su licencia" on storage.objects for insert to authenticated
      with check (bucket_id = 'licencias' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "ver fotos de licencias" on storage.objects for select to authenticated
      using (bucket_id = 'licencias' and ((storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.perfiles p where p.id::text = (storage.foldername(name))[1]
                   and public.es_admin_de(p.empresa_id))))$p$;
  end if;
end $$;

revoke execute on function public.subir_licencia(text, text, date, text, text) from public, anon;
revoke execute on function public.revisar_licencia(uuid, boolean, text) from public, anon;
revoke execute on function public.estado_licencias() from public, anon;
revoke execute on function public.licencias_para_avisar() from public, anon, authenticated;
revoke execute on function public.resumen_furgones() from public, anon;
revoke execute on function public.guardar_furgon(jsonb) from public, anon;
revoke execute on function public.validar_licencia_al_iniciar() from public, anon, authenticated;
grant execute on function public.subir_licencia(text, text, date, text, text) to authenticated;
grant execute on function public.revisar_licencia(uuid, boolean, text) to authenticated;
grant execute on function public.estado_licencias() to authenticated;
grant execute on function public.licencias_para_avisar() to service_role;
grant execute on function public.resumen_furgones() to authenticated;
grant execute on function public.guardar_furgon(jsonb) to authenticated;

-- Las notificaciones de vencimiento de licencia también quedan registradas.
alter table public.envios_push drop constraint if exists envios_push_tipo_check;
alter table public.envios_push add constraint envios_push_tipo_check
  check (tipo in ('aviso', 'entregado', 'ausente', 'llamada', 'licencia'));
