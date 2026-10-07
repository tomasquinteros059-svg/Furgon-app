-- =============================================================================
-- Perfil de familia compartido (dúo): la mamá comparte a sus hijos con el papá (o al revés).
-- Ambos ven a los mismos hijos, reciben la alarma, pueden seguir el furgón, confirmar el
-- aviso, tocar «Ya subió» y marcar «hoy no viaja». Cada uno entra con su propia cuenta.
--
-- Se comparte con un código de un solo uso (válido 7 días):
--  * si el otro aún no tiene cuenta, lo escribe al registrarse;
--  * si ya tiene cuenta, lo escribe en «Familia → Tengo un código».
-- Al unirse, si hay un cupo libre en los teléfonos de la llamada automática, se agrega su
-- teléfono: así la escalera de llamadas también lo llama a él (gratis por la app).
-- =============================================================================

alter table public.apoderado_alumno
  add column invitado_por uuid references public.perfiles (id) on delete set null,
  add column creado_en timestamptz not null default now();

-- Teléfono agregado automáticamente al unirse (se quita si deja de compartir).
alter table public.contactos add column apoderado_id uuid references public.perfiles (id) on delete set null;

create table public.invitaciones_familia (
  codigo text primary key check (length(codigo) >= 6),
  creado_por uuid not null references public.perfiles (id) on delete cascade,
  alumnos uuid[] not null check (cardinality(alumnos) > 0),
  parentesco text,
  usado_por uuid references public.perfiles (id) on delete set null,
  expira_en timestamptz not null default now() + interval '7 days',
  creado_en timestamptz not null default now()
);
alter table public.invitaciones_familia enable row level security;
create policy "ver mis códigos de familia" on public.invitaciones_familia for select using (creado_por = auth.uid());

-- La familia ve quién más es apoderado de sus hijos (sin teléfonos de otras familias).
create policy "ver co-apoderados de mis hijos" on public.apoderado_alumno for select
  using (public.es_apoderado_de(alumno_id));

-- Crea el código para compartir. Sin lista de alumnos, comparte a todos los hijos activos.
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
  v_codigo := 'F' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
  insert into public.invitaciones_familia (codigo, creado_por, alumnos, parentesco)
  values (v_codigo, auth.uid(), v_alumnos, nullif(trim(p_parentesco), ''));
  return v_codigo;
end $$;

-- Vincula a un apoderado con los hijos del código (uso interno).
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

-- Quien ya tiene cuenta escribe el código para unirse.
create or replace function public.unirse_familia(p_codigo text)
returns text[] language plpgsql security definer set search_path = '' as $$
begin
  return public.vincular_familia(p_codigo, auth.uid());
end $$;

-- Al registrarse, el código puede ser de la empresa (invitaciones) o de una familia.
create or replace function public.validar_invitacion(p_codigo text)
returns table (rol public.rol_usuario, empresa text)
language sql stable security definer set search_path = '' as $$
  select i.rol, e.nombre from public.invitaciones i join public.empresas e on e.id = i.empresa_id
  where i.codigo = upper(trim(p_codigo)) and i.usos_restantes > 0 and (i.expira_en is null or i.expira_en > now())
  union all
  select 'apoderado'::public.rol_usuario, 'la familia de ' || p.nombre || ' (' ||
    (select string_agg(a.nombre, ', ' order by a.nombre) from public.alumnos a where a.id = any (f.alumnos)) || ')'
  from public.invitaciones_familia f join public.perfiles p on p.id = f.creado_por
  where f.codigo = upper(trim(p_codigo)) and f.usado_por is null and f.expira_en > now()
$$;

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
  -- Código de familia: se crea la cuenta del otro apoderado y se une a los mismos hijos.
  if exists (select 1 from public.invitaciones_familia where codigo = v_codigo) then
    insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (new.id, null, 'apoderado', v_nombre, v_tel);
    perform public.vincular_familia(v_codigo, new.id);
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

-- Quiénes son apoderados de cada uno de mis hijos (para la pantalla «Familia»).
create or replace function public.mi_familia()
returns table (alumno_id uuid, alumno text, apoderado_id uuid, apoderado text, parentesco text, soy_yo boolean, lo_invite boolean, desde timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.nombre, p.id, p.nombre, aa.parentesco, p.id = auth.uid(), coalesce(aa.invitado_por = auth.uid(), false), aa.creado_en
  from public.apoderado_alumno mio
  join public.alumnos a on a.id = mio.alumno_id and a.activo
  join public.apoderado_alumno aa on aa.alumno_id = a.id
  join public.perfiles p on p.id = aa.apoderado_id
  where mio.apoderado_id = auth.uid()
  order by a.nombre, aa.creado_en
$$;

-- Dejar de compartir: cada uno puede salirse, y quien invitó puede quitar a quien invitó.
-- Un hijo nunca queda sin apoderado.
create or replace function public.dejar_de_compartir(p_alumno uuid, p_apoderado uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_vinculo public.apoderado_alumno;
begin
  select * into v_vinculo from public.apoderado_alumno where alumno_id = p_alumno and apoderado_id = p_apoderado;
  if v_vinculo.apoderado_id is null then raise exception 'No encontrado'; end if;
  if not (p_apoderado = auth.uid() or (coalesce(v_vinculo.invitado_por = auth.uid(), false) and public.es_apoderado_de(p_alumno))) then
    raise exception 'Solo puedes quitar a quien tú invitaste' using errcode = '42501';
  end if;
  if (select count(*) from public.apoderado_alumno where alumno_id = p_alumno) <= 1 then
    raise exception 'Eres el único apoderado: no puedes dejarlo sin nadie a cargo';
  end if;
  delete from public.apoderado_alumno where alumno_id = p_alumno and apoderado_id = p_apoderado;
  delete from public.contactos where alumno_id = p_alumno and apoderado_id = p_apoderado;
end $$;

revoke execute on function public.compartir_familia(uuid[], text) from public, anon;
revoke execute on function public.vincular_familia(text, uuid) from public, anon, authenticated;
revoke execute on function public.unirse_familia(text) from public, anon;
revoke execute on function public.mi_familia() from public, anon;
revoke execute on function public.dejar_de_compartir(uuid, uuid) from public, anon;
grant execute on function public.compartir_familia(uuid[], text) to authenticated;
grant execute on function public.unirse_familia(text) to authenticated;
grant execute on function public.mi_familia() to authenticated;
grant execute on function public.dejar_de_compartir(uuid, uuid) to authenticated;
grant execute on function public.validar_invitacion(text) to anon, authenticated;
