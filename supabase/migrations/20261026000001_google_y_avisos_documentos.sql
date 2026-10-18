-- =============================================================================
-- 1) Entrar con Google: quien entra con Google por primera vez no trae datos de registro (código,
--    teléfono). completar_registro() crea su perfil: como familia sin código, con un código de
--    familia, o con un código de invitación de la empresa (tía, tío o familia).
-- 2) Avisos de vencimiento de los documentos del furgón y de quien conduce, como los de la
--    licencia: a los 30, 15, 7 y 1 días, y el día que vence. Uno por umbral.
-- =============================================================================

create or replace function public.completar_registro(p_nombre text, p_telefono text default null, p_codigo text default null)
returns public.rol_usuario language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := auth.uid();
  v_codigo text := nullif(upper(trim(coalesce(p_codigo, ''))), '');
  v_tel text := nullif(trim(coalesce(p_telefono, '')), '');
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_inv public.invitaciones;
begin
  if v_yo is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  if exists (select 1 from public.perfiles where id = v_yo) then raise exception 'Tu cuenta ya está registrada'; end if;
  if length(v_nombre) < 2 then raise exception 'Escribe tu nombre'; end if;
  if v_tel is not null and v_tel !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Teléfono no válido'; end if;

  if v_codigo is null then
    insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (v_yo, null, 'apoderado', v_nombre, v_tel);
    return 'apoderado';
  end if;
  -- Código de familia (el papá o la mamá comparte a los hijos).
  if exists (select 1 from public.invitaciones_familia where codigo = v_codigo) then
    insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (v_yo, null, 'apoderado', v_nombre, v_tel);
    perform public.vincular_familia(v_codigo, v_yo);
    return 'apoderado';
  end if;
  -- Código de invitación de la empresa.
  select * into v_inv from public.invitaciones where codigo = v_codigo for update;
  if v_inv.codigo is null or v_inv.usos_restantes <= 0 or (v_inv.expira_en is not null and v_inv.expira_en < now()) then
    raise exception 'Código de invitación inválido o vencido';
  end if;
  update public.invitaciones set usos_restantes = usos_restantes - 1 where codigo = v_inv.codigo;
  insert into public.perfiles (id, empresa_id, rol, nombre, telefono) values (v_yo, v_inv.empresa_id, v_inv.rol, v_nombre, v_tel);
  if v_inv.alumno_id is not null then
    insert into public.apoderado_alumno (apoderado_id, alumno_id) values (v_yo, v_inv.alumno_id) on conflict do nothing;
  end if;
  return v_inv.rol;
end $$;

revoke execute on function public.completar_registro(text, text, text) from public, anon;
grant execute on function public.completar_registro(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
create table if not exists public.avisos_documento (
  documento_id uuid not null references public.documentos (id) on delete cascade,
  umbral_dias smallint not null,
  enviado_en timestamptz not null default now(),
  primary key (documento_id, umbral_dias)
);
alter table public.avisos_documento enable row level security;
revoke all on public.avisos_documento from anon, authenticated;

-- Documentos que llegan hoy a un umbral y aún no se avisaron; los marca como avisados.
-- Se avisa a quien tiene el furgón a cargo (documentos del vehículo) o a la persona (los suyos).
create or replace function public.documentos_para_avisar()
returns table (documento_id uuid, tipo text, conductor_id uuid, conductor text, patente text, vence_en date, dias integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with ultimos as (
    select distinct on (d.tipo, coalesce(d.furgon_id, d.conductor_id)) d.*
    from public.documentos d
    order by d.tipo, coalesce(d.furgon_id, d.conductor_id), d.creado_en desc
  ), candidatos as (
    select u.id, u.tipo, coalesce(u.conductor_id, f.conductor_id) as a_quien, f.patente, u.vence_en,
      (u.vence_en - (now() at time zone 'America/Santiago')::date)::integer as dias
    from ultimos u left join public.furgones f on f.id = u.furgon_id
    where u.estado <> 'rechazada' and u.vence_en is not null and (u.furgon_id is null or f.activo)
  ), umbrales as (
    select c.*, p.nombre, x.umbral from candidatos c
    join public.perfiles p on p.id = c.a_quien
    cross join lateral (select min(v) as umbral from unnest(array[30, 15, 7, 1, 0]) v where v >= c.dias) x
    where x.umbral is not null and c.dias >= -1
  ), nuevos as (
    insert into public.avisos_documento (documento_id, umbral_dias)
    select id, umbral from umbrales on conflict do nothing
    returning documento_id
  )
  select u.id, u.tipo, u.a_quien, u.nombre, u.patente, u.vence_en, u.dias
  from umbrales u join nuevos n on n.documento_id = u.id;
end $$;

revoke execute on function public.documentos_para_avisar() from public, anon, authenticated;
grant execute on function public.documentos_para_avisar() to service_role;

alter table public.envios_push drop constraint if exists envios_push_tipo_check;
alter table public.envios_push add constraint envios_push_tipo_check
  check (tipo in ('aviso', 'entregado', 'ausente', 'llamada', 'licencia', 'colegio', 'documento'));
