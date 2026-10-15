-- Destino final de cada ruta: el colegio o los colegios. En la ida son las últimas paradas (se
-- dejan los niños); en la vuelta, las primeras (se recogen). Cada niño puede ir a un colegio
-- distinto (ruta_paradas.destino_id; si no tiene, va al colegio principal de la ruta).
-- Al llegar (ida) o salir (vuelta) del colegio, la tía lo marca y las familias reciben el aviso.

create table if not exists public.ruta_destinos (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references public.rutas (id) on delete cascade,
  orden integer not null default 1,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  direccion text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  creado_en timestamptz not null default now()
);
create index if not exists ruta_destinos_ruta on public.ruta_destinos (ruta_id, orden);

alter table public.ruta_paradas add column if not exists destino_id uuid references public.ruta_destinos (id) on delete set null;

-- El colegio que ya tenían las rutas pasa a ser su primer destino.
insert into public.ruta_destinos (ruta_id, orden, nombre, lat, lng)
select r.id, 1, coalesce(nullif(trim(r.colegio_nombre), ''), 'Colegio'), r.colegio_lat, r.colegio_lng
from public.rutas r
where r.colegio_lat is not null and r.colegio_lng is not null
  and not exists (select 1 from public.ruta_destinos d where d.ruta_id = r.id);

alter table public.ruta_destinos enable row level security;
revoke all on public.ruta_destinos from anon;

create policy "ver destinos" on public.ruta_destinos for select
  using (exists (select 1 from public.rutas r where r.id = ruta_id and (r.conductor_id = auth.uid() or public.es_admin_de(r.empresa_id))));
create policy "admin gestiona destinos" on public.ruta_destinos for all
  using (exists (select 1 from public.rutas r where r.id = ruta_id and public.es_admin_de(r.empresa_id)))
  with check (exists (select 1 from public.rutas r where r.id = ruta_id and public.es_admin_de(r.empresa_id)));

/** Colegio principal: el último de la ida (donde termina) o el primero de la vuelta (donde parte). */
create or replace function public.destino_principal(p_ruta uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.id from public.ruta_destinos d join public.rutas r on r.id = d.ruta_id
  where d.ruta_id = p_ruta
  order by case when r.tipo = 'ida' then -d.orden else d.orden end, d.creado_en
  limit 1
$$;

-- rutas.colegio_* (lo usan el cálculo de llegada y el orden recomendado) sigue al colegio principal.
create or replace function public.sincronizar_colegio_ruta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ruta uuid := coalesce(new.ruta_id, old.ruta_id);
  v_d public.ruta_destinos;
begin
  select * into v_d from public.ruta_destinos where id = public.destino_principal(v_ruta);
  update public.rutas set colegio_nombre = v_d.nombre, colegio_lat = v_d.lat, colegio_lng = v_d.lng where id = v_ruta;
  return null;
end $$;

drop trigger if exists colegio_de_la_ruta on public.ruta_destinos;
create trigger colegio_de_la_ruta after insert or update or delete on public.ruta_destinos
  for each row execute function public.sincronizar_colegio_ruta();

-- El destino de un niño debe ser de su misma ruta.
create or replace function public.validar_destino_parada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.destino_id is not null and not exists (
    select 1 from public.ruta_destinos where id = new.destino_id and ruta_id = new.ruta_id
  ) then
    raise exception 'Ese colegio no es de esta ruta' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists destino_de_la_ruta on public.ruta_paradas;
create trigger destino_de_la_ruta before insert or update of destino_id, ruta_id on public.ruta_paradas
  for each row execute function public.validar_destino_parada();

-- Llegadas a cada colegio durante un recorrido.
create table if not exists public.recorrido_destinos (
  recorrido_id uuid not null references public.recorridos (id) on delete cascade,
  destino_id uuid not null references public.ruta_destinos (id) on delete cascade,
  llegado_en timestamptz not null default now(),
  primary key (recorrido_id, destino_id)
);
alter table public.recorrido_destinos enable row level security;
revoke all on public.recorrido_destinos from anon;
revoke insert, update, delete on public.recorrido_destinos from authenticated;

create policy "ver llegadas a destinos" on public.recorrido_destinos for select
  using (public.es_conductor_de_recorrido(recorrido_id)
    or public.es_admin_de((select empresa_id from public.recorridos where id = recorrido_id)));

/**
 * La tía marca que llegó a un colegio (ida) o que salió de él (vuelta). Devuelve los niños de ese
 * colegio a los que hay que avisar: en la ida, los que subieron; en la vuelta, los que van a bordo.
 * Si ya estaba marcado no devuelve a nadie (no se avisa dos veces). Con p_deshacer, lo desmarca.
 */
create or replace function public.llegar_a_destino(p_recorrido uuid, p_destino uuid, p_deshacer boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rec public.recorridos;
  v_principal uuid;
  v_nuevo boolean;
  v_destino public.ruta_destinos;
  v_alumnos jsonb;
begin
  select * into v_rec from public.recorridos where id = p_recorrido;
  if v_rec.id is null or v_rec.conductor_id is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_rec.estado <> 'activo' then raise exception 'El recorrido ya terminó'; end if;
  select * into v_destino from public.ruta_destinos where id = p_destino and ruta_id = v_rec.ruta_id;
  if v_destino.id is null then raise exception 'Ese colegio no es de esta ruta' using errcode = '42501'; end if;

  if p_deshacer then
    delete from public.recorrido_destinos where recorrido_id = p_recorrido and destino_id = p_destino;
    return jsonb_build_object('tipo', v_rec.tipo, 'destino', v_destino.nombre, 'alumnos', '[]'::jsonb);
  end if;

  insert into public.recorrido_destinos (recorrido_id, destino_id) values (p_recorrido, p_destino)
  on conflict do nothing;
  get diagnostics v_nuevo = row_count;
  if not v_nuevo then
    return jsonb_build_object('tipo', v_rec.tipo, 'destino', v_destino.nombre, 'alumnos', '[]'::jsonb);
  end if;

  v_principal := public.destino_principal(v_rec.ruta_id);
  select coalesce(jsonb_agg(jsonb_build_object('alumno_id', a.id, 'nombre', a.nombre, 'parada_id', ra.id)), '[]'::jsonb)
  into v_alumnos
  from public.recorrido_alumnos ra
  join public.alumnos a on a.id = ra.alumno_id
  left join public.ruta_paradas rp on rp.ruta_id = v_rec.ruta_id and rp.alumno_id = ra.alumno_id
  where ra.recorrido_id = p_recorrido
    and coalesce(rp.destino_id, v_principal) = p_destino
    and ra.estado = (case when v_rec.tipo = 'ida' then 'entregado' else 'pendiente' end)::public.estado_parada;

  return jsonb_build_object('tipo', v_rec.tipo, 'destino', v_destino.nombre, 'alumnos', v_alumnos);
end $$;

revoke execute on function public.llegar_a_destino(uuid, uuid, boolean) from public, anon;
grant execute on function public.llegar_a_destino(uuid, uuid, boolean) to authenticated;
revoke execute on function public.sincronizar_colegio_ruta() from public, anon, authenticated;
revoke execute on function public.validar_destino_parada() from public, anon, authenticated;

alter table public.envios_push drop constraint if exists envios_push_tipo_check;
alter table public.envios_push add constraint envios_push_tipo_check
  check (tipo in ('aviso', 'entregado', 'ausente', 'llamada', 'licencia', 'colegio'));
