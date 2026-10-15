-- Documentos obligatorios para iniciar un recorrido: no basta con que no estén vencidos, deben
-- estar subidos. Cuenta el último de cada tipo si está aprobado o enviado y en revisión (para no
-- frenar a la tía mientras la empresa lo revisa); uno rechazado o vencido no cuenta.
-- Cada empresa puede desactivarlo en Configuración (empresas.exige_documentos), por ejemplo
-- mientras junta los documentos; los vencidos bloquean siempre.

alter table public.empresas add column if not exists exige_documentos boolean not null default true;
grant update (exige_documentos) on public.empresas to authenticated;
create or replace function public.validar_documentos_al_iniciar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_furgon uuid;
  v_falta text;
  v_estado text;
  v_exige boolean;
begin
  select exige_documentos into v_exige from public.empresas where id = new.empresa_id;
  v_furgon := coalesce(new.furgon_id, (select furgon_id from public.rutas where id = new.ruta_id),
    (select id from public.furgones where conductor_id = new.conductor_id and activo order by creado_en desc limit 1));
  if v_furgon is null and coalesce(v_exige, true) then
    raise exception 'La ruta no tiene un furgón asignado. Pídele a la empresa que te asigne el furgón para iniciar recorridos.';
  end if;
  select t.tipo,
    case when x.id is null then 'falta' when x.estado = 'rechazada' then 'rechazado' else 'vencido' end
  into v_falta, v_estado
  from public.tipos_documento() t
  left join lateral (
    select * from public.documentos z
    where z.tipo = t.tipo and (case when t.de = 'furgon' then z.furgon_id = v_furgon else z.conductor_id = new.conductor_id end)
    order by z.creado_en desc limit 1
  ) x on true
  where t.obligatorio and (x.vence_en < v_hoy
    or (coalesce(v_exige, true) and (x.id is null or x.estado = 'rechazada')))
  order by t.orden
  limit 1;
  if v_falta is not null then
    raise exception 'Falta un documento obligatorio al día (%: %). Súbelo en «Documentos del furgón» para iniciar recorridos.',
      replace(v_falta, '_', ' '), v_estado;
  end if;
  return new;
end $$;
revoke execute on function public.validar_documentos_al_iniciar() from public, anon, authenticated;
