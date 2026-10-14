-- Aviso por WhatsApp: cuando el furgón está a pocos minutos, además de la alarma en la app (y la
-- llamada), la familia que lo pidió recibe un WhatsApp. WhatsApp exige que la persona lo acepte,
-- así que viene apagado y cada familia lo activa en «Mi perfil» (necesita su teléfono).

alter table public.perfiles add column if not exists aviso_whatsapp boolean not null default false;
grant update (aviso_whatsapp) on public.perfiles to authenticated;

-- Registro de cada WhatsApp enviado: uno por aviso y familia (la restricción única evita repetirlo
-- si la función se reintenta). Solo lo escribe el servidor; la administración lo puede revisar.
create table if not exists public.envios_whatsapp (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  apoderado_id uuid not null references public.perfiles (id) on delete cascade,
  proveedor text,
  mensaje_id text,
  estado text not null default 'enviando' check (estado in ('enviando', 'enviado', 'fallido')),
  error text,
  creado_en timestamptz not null default now(),
  unique (aviso_id, apoderado_id)
);

alter table public.envios_whatsapp enable row level security;
revoke all on public.envios_whatsapp from anon, authenticated;
grant select on public.envios_whatsapp to authenticated;

create policy "admin ve envíos whatsapp" on public.envios_whatsapp for select
  using (exists (select 1 from public.avisos av join public.recorridos r on r.id = av.recorrido_id
    where av.id = aviso_id and public.es_admin_de(r.empresa_id)));
