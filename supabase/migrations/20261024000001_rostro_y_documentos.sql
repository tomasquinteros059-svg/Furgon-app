-- =============================================================================
-- Seguridad de los niños: identidad de quien conduce y documentos del furgón.
--
--  * Con la licencia, la tía o el tío sube una foto de su cara (selfie). El servidor la compara con
--    la foto de la licencia (función comparar-rostro, AWS Rekognition si está configurado) y la
--    empresa ve el resultado junto a las fotos al aprobarla. Es un dato biométrico: se pide su
--    consentimiento expreso y la foto queda en el bucket privado «licencias».
--  * Documentos obligatorios: del furgón (padrón, permiso de circulación, revisión técnica, SOAP,
--    inscripción en el registro de transporte escolar) y de quien conduce (certificado de
--    antecedentes e inhabilidades para trabajar con menores). La empresa los aprueba o rechaza.
--  * Con un documento obligatorio vencido no se puede iniciar un recorrido.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Foto de la cara junto a la licencia
-- ---------------------------------------------------------------------------
alter table public.licencias
  add column if not exists foto_rostro text,
  add column if not exists consentimiento_biometrico_en timestamptz,
  add column if not exists rostro_resultado text
    check (rostro_resultado in ('pendiente', 'coincide', 'dudoso', 'no_coincide', 'sin_rostro', 'sin_servicio', 'error')),
  add column if not exists rostro_similitud real check (rostro_similitud between 0 and 100),
  add column if not exists rostro_comparado_en timestamptz;

drop function if exists public.subir_licencia(text, text, date, text, text);
create or replace function public.subir_licencia(p_numero text, p_clase text, p_vence_en date, p_foto_frente text,
  p_foto_reverso text, p_foto_rostro text default null, p_consiento boolean default false)
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
  if p_foto_rostro is null then raise exception 'Falta la foto de tu cara'; end if;
  if not coalesce(p_consiento, false) then
    raise exception 'Para verificar tu identidad necesitamos tu autorización para comparar tu cara con la licencia';
  end if;
  -- Las fotos deben estar en su carpeta del bucket.
  if split_part(p_foto_frente, '/', 1) <> auth.uid()::text
     or split_part(p_foto_rostro, '/', 1) <> auth.uid()::text
     or (p_foto_reverso is not null and split_part(p_foto_reverso, '/', 1) <> auth.uid()::text) then
    raise exception 'Foto no válida';
  end if;
  insert into public.licencias (conductor_id, empresa_id, numero, clase, vence_en, foto_frente, foto_reverso,
    foto_rostro, consentimiento_biometrico_en, rostro_resultado)
  values (auth.uid(), v_yo.empresa_id, upper(trim(p_numero)), upper(trim(p_clase)), p_vence_en, p_foto_frente, p_foto_reverso,
    p_foto_rostro, now(), 'pendiente')
  returning id into v_id;
  return v_id;
end $$;

-- Resultado de la comparación (solo la función del servidor).
create or replace function public.guardar_comparacion_rostro(p_licencia uuid, p_resultado text, p_similitud real)
returns void language sql security definer set search_path = '' as $$
  update public.licencias set rostro_resultado = p_resultado, rostro_similitud = p_similitud, rostro_comparado_en = now()
  where id = p_licencia
$$;

drop function if exists public.estado_licencias();
create or replace function public.estado_licencias()
returns table (conductor_id uuid, conductor text, licencia_id uuid, numero text, clase text, vence_en date,
               dias_restantes integer, estado text, motivo_rechazo text, revisada_en timestamptz, foto_frente text, foto_reverso text,
               foto_rostro text, rostro_resultado text, rostro_similitud real)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, l.id, l.numero, l.clase, l.vence_en, (l.vence_en - (now() at time zone 'America/Santiago')::date)::integer,
    case when l.id is null then 'sin_licencia'
         when l.vence_en < (now() at time zone 'America/Santiago')::date then 'vencida'
         when l.estado = 'rechazada' then 'rechazada'
         when l.estado = 'pendiente' then 'por_verificar'
         when l.vence_en - (now() at time zone 'America/Santiago')::date <= 30 then 'por_vencer'
         else 'vigente' end,
    l.motivo_rechazo, l.revisada_en, l.foto_frente, l.foto_reverso, l.foto_rostro, l.rostro_resultado, l.rostro_similitud
  from public.perfiles p
  left join lateral (
    select * from public.licencias x where x.conductor_id = p.id order by x.creado_en desc limit 1
  ) l on true
  where p.rol = 'conductor' and p.empresa_id = public.mi_empresa()
    and (p.id = auth.uid() or public.soy_admin())
  order by p.nombre
$$;

-- ---------------------------------------------------------------------------
-- 2) Documentos del furgón y de quien conduce
-- ---------------------------------------------------------------------------
-- Catálogo: qué documentos se piden, de quién son y si vencen.
create or replace function public.tipos_documento()
returns table (tipo text, de text, obligatorio boolean, vence boolean, orden integer)
language sql immutable set search_path = '' as $$
  values
    ('padron', 'furgon', true, false, 1),
    ('permiso_circulacion', 'furgon', true, true, 2),
    ('revision_tecnica', 'furgon', true, true, 3),
    ('soap', 'furgon', true, true, 4),
    ('registro_escolar', 'furgon', true, false, 5),
    ('seguro_pasajeros', 'furgon', false, true, 6),
    ('antecedentes', 'conductor', true, true, 7),
    ('inhabilidades', 'conductor', true, false, 8)
$$;

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null,
  furgon_id uuid references public.furgones (id) on delete cascade,
  conductor_id uuid references public.perfiles (id) on delete cascade,
  archivo text not null,       -- ruta en el bucket privado «documentos»
  vence_en date,
  estado public.estado_licencia not null default 'pendiente',
  motivo_rechazo text,
  subido_por uuid references public.perfiles (id) on delete set null,
  revisada_por uuid references public.perfiles (id) on delete set null,
  revisada_en timestamptz,
  creado_en timestamptz not null default now(),
  check ((furgon_id is null) <> (conductor_id is null))
);
create index if not exists documentos_furgon on public.documentos (furgon_id, tipo, creado_en desc);
create index if not exists documentos_conductor on public.documentos (conductor_id, tipo, creado_en desc);

alter table public.documentos enable row level security;
revoke all on public.documentos from anon;
revoke insert, update, delete on public.documentos from authenticated;
create policy "ver documentos" on public.documentos for select
  using (conductor_id = auth.uid() or subido_por = auth.uid() or public.es_admin_de(empresa_id)
    or exists (select 1 from public.furgones f where f.id = furgon_id and f.conductor_id = auth.uid()));

-- La tía o el tío sube un documento suyo o del furgón que tiene a cargo.
create or replace function public.subir_documento(p_tipo text, p_archivo text, p_vence_en date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_yo public.perfiles;
  v_tipo record;
  v_furgon uuid;
  v_id uuid;
begin
  select * into v_yo from public.perfiles where id = auth.uid();
  if v_yo.rol is distinct from 'conductor' or v_yo.empresa_id is null then
    raise exception 'Solo la tía o el tío del furgón sube estos documentos' using errcode = '42501';
  end if;
  select * into v_tipo from public.tipos_documento() t where t.tipo = p_tipo;
  if v_tipo.tipo is null then raise exception 'Documento no válido'; end if;
  if p_archivo is null or split_part(p_archivo, '/', 1) <> auth.uid()::text then raise exception 'Archivo no válido'; end if;
  if v_tipo.vence and p_vence_en is null then raise exception 'Falta la fecha de vencimiento del documento'; end if;
  if p_vence_en is not null and p_vence_en < (now() at time zone 'America/Santiago')::date then
    raise exception 'Ese documento ya está vencido';
  end if;
  if v_tipo.de = 'furgon' then
    select id into v_furgon from public.furgones
    where conductor_id = auth.uid() and empresa_id = v_yo.empresa_id and activo order by creado_en desc limit 1;
    if v_furgon is null then raise exception 'Aún no tienes un furgón asignado: pídele a la empresa que te lo asigne'; end if;
  end if;
  insert into public.documentos (empresa_id, tipo, furgon_id, conductor_id, archivo, vence_en, subido_por)
  values (v_yo.empresa_id, p_tipo, v_furgon, case when v_furgon is null then auth.uid() end, p_archivo,
    case when v_tipo.vence then p_vence_en end, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- El administrador aprueba o rechaza (con motivo). Nadie aprueba lo que subió.
create or replace function public.revisar_documento(p_documento uuid, p_aprobar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := public.requiere_admin();
begin
  if not p_aprobar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indica el motivo del rechazo para que la tía pueda corregirlo';
  end if;
  update public.documentos set
    estado = case when p_aprobar then 'aprobada'::public.estado_licencia else 'rechazada'::public.estado_licencia end,
    motivo_rechazo = case when p_aprobar then null else trim(p_motivo) end,
    revisada_por = auth.uid(), revisada_en = now()
  where id = p_documento and empresa_id = v_empresa and subido_por is distinct from auth.uid();
  if not found then raise exception 'Documento no encontrado'; end if;
end $$;

-- Situación de cada documento: para la tía, los suyos y los de su furgón; para el administrador,
-- los de toda la empresa.
create or replace function public.estado_documentos()
returns table (tipo text, de text, obligatorio boolean, vence boolean, orden integer,
               conductor_id uuid, conductor text, furgon_id uuid, patente text,
               documento_id uuid, archivo text, vence_en date, dias_restantes integer, estado text, motivo_rechazo text)
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'America/Santiago')::date as d),
  duenos as (
    select 'conductor'::text as de, p.id as conductor_id, p.nombre as conductor, null::uuid as furgon_id, null::text as patente
    from public.perfiles p
    where p.rol = 'conductor' and p.empresa_id = public.mi_empresa() and (p.id = auth.uid() or public.soy_admin())
    union all
    select 'furgon', f.conductor_id, c.nombre, f.id, f.patente
    from public.furgones f left join public.perfiles c on c.id = f.conductor_id
    where f.empresa_id = public.mi_empresa() and f.activo and (f.conductor_id = auth.uid() or public.soy_admin())
  )
  select t.tipo, t.de, t.obligatorio, t.vence, t.orden, d.conductor_id, d.conductor, d.furgon_id, d.patente,
    x.id, x.archivo, x.vence_en, (x.vence_en - (select d from hoy))::integer,
    case when x.id is null then 'sin_documento'
         when x.vence_en < (select d from hoy) then 'vencido'
         when x.estado = 'rechazada' then 'rechazado'
         when x.estado = 'pendiente' then 'por_verificar'
         when x.vence_en - (select d from hoy) <= 30 then 'por_vencer'
         else 'vigente' end,
    x.motivo_rechazo
  from duenos d
  join public.tipos_documento() t on t.de = d.de
  left join lateral (
    select * from public.documentos z
    where z.tipo = t.tipo and (case when d.de = 'furgon' then z.furgon_id = d.furgon_id else z.conductor_id = d.conductor_id end)
    order by z.creado_en desc limit 1
  ) x on true
  order by d.de desc, d.patente nulls first, d.conductor, t.orden
$$;

-- Con un documento obligatorio vencido (o rechazado, sin otro al día) no se inicia un recorrido.
create or replace function public.validar_documentos_al_iniciar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_furgon uuid;
  v_vencido text;
begin
  v_furgon := coalesce(new.furgon_id, (select furgon_id from public.rutas where id = new.ruta_id),
    (select id from public.furgones where conductor_id = new.conductor_id and activo order by creado_en desc limit 1));
  select t.tipo into v_vencido
  from public.tipos_documento() t
  join lateral (
    select * from public.documentos z
    where z.tipo = t.tipo and z.estado <> 'rechazada'
      and (case when t.de = 'furgon' then z.furgon_id = v_furgon else z.conductor_id = new.conductor_id end)
    order by z.creado_en desc limit 1
  ) x on true
  where t.obligatorio and t.vence and x.vence_en < v_hoy
  limit 1;
  if v_vencido is not null then
    raise exception 'Un documento obligatorio está vencido (%). Sube el vigente en «Documentos» para iniciar recorridos.', replace(v_vencido, '_', ' ');
  end if;
  return new;
end $$;
drop trigger if exists documentos_al_dia on public.recorridos;
create trigger documentos_al_dia before insert on public.recorridos
  for each row execute function public.validar_documentos_al_iniciar();

-- Bucket privado para los documentos (solo en Supabase; en las pruebas no existe).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
    execute $p$drop policy if exists "tia sube sus documentos" on storage.objects$p$;
    execute $p$create policy "tia sube sus documentos" on storage.objects for insert to authenticated
      with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$drop policy if exists "ver documentos" on storage.objects$p$;
    execute $p$create policy "ver documentos" on storage.objects for select to authenticated
      using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.perfiles p where p.id::text = (storage.foldername(name))[1]
                   and public.es_admin_de(p.empresa_id))))$p$;
  end if;
end $$;

revoke execute on function public.subir_licencia(text, text, date, text, text, text, boolean) from public, anon;
grant execute on function public.subir_licencia(text, text, date, text, text, text, boolean) to authenticated;
revoke execute on function public.guardar_comparacion_rostro(uuid, text, real) from public, anon, authenticated;
grant execute on function public.guardar_comparacion_rostro(uuid, text, real) to service_role;
revoke execute on function public.estado_licencias() from public, anon;
grant execute on function public.estado_licencias() to authenticated;
revoke execute on function public.subir_documento(text, text, date) from public, anon;
grant execute on function public.subir_documento(text, text, date) to authenticated;
revoke execute on function public.revisar_documento(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_documento(uuid, boolean, text) to authenticated;
revoke execute on function public.estado_documentos() from public, anon;
grant execute on function public.estado_documentos() to authenticated;
revoke execute on function public.validar_documentos_al_iniciar() from public, anon, authenticated;
