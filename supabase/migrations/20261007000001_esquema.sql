-- =============================================================================
-- Furgón escolar: esquema principal
-- =============================================================================

create type public.rol_usuario as enum ('admin', 'conductor', 'apoderado');
create type public.tipo_recorrido as enum ('ida', 'vuelta');
create type public.estado_recorrido as enum ('activo', 'finalizado', 'cancelado');
create type public.estado_parada as enum ('pendiente', 'entregado', 'ausente', 'no_viaja');
create type public.motivo_aviso as enum ('eta', 'geocerca', 'proximidad');
create type public.estado_llamada as enum (
  'programada', 'en_curso', 'confirmada', 'sin_confirmar', 'no_contesto', 'ocupado', 'fallida', 'cancelada'
);

-- ---------------------------------------------------------------------------
-- Organización y usuarios
-- ---------------------------------------------------------------------------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona_horaria text not null default 'America/Santiago',
  creado_en timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid references public.empresas (id) on delete set null,
  rol public.rol_usuario not null,
  nombre text not null,
  telefono text check (telefono is null or telefono ~ '^\+[1-9][0-9]{7,14}$'),
  creado_en timestamptz not null default now()
);
create index on public.perfiles (empresa_id);

-- Códigos que el administrador entrega a apoderados y conductores para registrarse.
create table public.invitaciones (
  codigo text primary key check (length(codigo) >= 6),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  rol public.rol_usuario not null check (rol <> 'admin'),
  usos_restantes integer not null default 100 check (usos_restantes >= 0),
  expira_en timestamptz,
  creado_en timestamptz not null default now()
);

create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  expo_push_token text not null unique,
  plataforma text,
  actualizado_en timestamptz not null default now()
);
create index on public.dispositivos (perfil_id);

-- ---------------------------------------------------------------------------
-- Flota, alumnos y rutas
-- ---------------------------------------------------------------------------

create table public.furgones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  patente text not null,
  descripcion text,
  unique (empresa_id, patente)
);

create table public.alumnos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  colegio text,
  curso text,
  minutos_aviso smallint not null default 5 check (minutos_aviso between 1 and 30),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index on public.alumnos (empresa_id);

create table public.apoderado_alumno (
  apoderado_id uuid not null references public.perfiles (id) on delete cascade,
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  parentesco text,
  primary key (apoderado_id, alumno_id)
);
create index on public.apoderado_alumno (alumno_id);

create table public.domicilios (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  direccion text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  indicaciones text,
  principal boolean not null default true,
  creado_en timestamptz not null default now()
);
create index on public.domicilios (alumno_id);

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  nombre text not null,
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  prioridad smallint not null check (prioridad between 1 and 3),
  unique (alumno_id, prioridad)
);

create table public.rutas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  tipo public.tipo_recorrido not null,
  furgon_id uuid references public.furgones (id) on delete set null,
  conductor_id uuid references public.perfiles (id) on delete set null,
  colegio_nombre text,
  colegio_lat double precision,
  colegio_lng double precision,
  hora_salida time,
  activa boolean not null default true
);
create index on public.rutas (empresa_id);
create index on public.rutas (conductor_id);

create table public.ruta_paradas (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references public.rutas (id) on delete cascade,
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  domicilio_id uuid not null references public.domicilios (id) on delete cascade,
  orden integer not null,
  unique (ruta_id, alumno_id)
);

-- "Hoy no viaja"
create table public.inasistencias (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('ida', 'vuelta', 'ambos')),
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (alumno_id, fecha, tipo)
);

-- ---------------------------------------------------------------------------
-- Recorridos (una ejecución de una ruta en un día)
-- ---------------------------------------------------------------------------

create table public.recorridos (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references public.rutas (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  conductor_id uuid not null references public.perfiles (id),
  furgon_id uuid references public.furgones (id) on delete set null,
  tipo public.tipo_recorrido not null,
  estado public.estado_recorrido not null default 'activo',
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  ultima_lat double precision,
  ultima_lng double precision,
  ultima_posicion_en timestamptz,
  -- Cache del último ETA del proveedor de mapas (ver core/disparo.ts: CacheEta).
  eta_cache jsonb,
  eta_fuente text
);
create unique index recorridos_un_activo_por_ruta on public.recorridos (ruta_id) where estado = 'activo';
create index on public.recorridos (conductor_id, estado);
create index on public.recorridos (empresa_id, iniciado_en desc);

create table public.recorrido_alumnos (
  id uuid primary key default gen_random_uuid(),
  recorrido_id uuid not null references public.recorridos (id) on delete cascade,
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  domicilio_id uuid not null references public.domicilios (id),
  orden integer not null,
  estado public.estado_parada not null default 'pendiente',
  eta_seg integer,
  eta_actualizada_en timestamptz,
  marcado_en timestamptz,
  unique (recorrido_id, alumno_id)
);
create index on public.recorrido_alumnos (alumno_id);

create table public.posiciones (
  id bigint generated always as identity primary key,
  recorrido_id uuid not null references public.recorridos (id) on delete cascade,
  client_id uuid not null,
  registrada_en timestamptz not null,
  recibida_en timestamptz not null default now(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precision_m real,
  velocidad_ms real,
  rumbo real,
  unique (recorrido_id, client_id)
);
create index on public.posiciones (recorrido_id, registrada_en desc);

-- Un aviso por alumno por recorrido: la restricción UNIQUE es la deduplicación.
create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  recorrido_id uuid not null references public.recorridos (id) on delete cascade,
  recorrido_alumno_id uuid not null unique references public.recorrido_alumnos (id) on delete cascade,
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  motivo public.motivo_aviso not null,
  eta_seg integer,
  disparado_en timestamptz not null default now(),
  confirmado_en timestamptz,
  unique (recorrido_id, alumno_id)
);
create index on public.avisos (alumno_id, disparado_en desc);

create table public.envios_push (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid references public.avisos (id) on delete cascade,
  recorrido_alumno_id uuid references public.recorrido_alumnos (id) on delete cascade,
  dispositivo_id uuid references public.dispositivos (id) on delete set null,
  tipo text not null check (tipo in ('aviso', 'entregado', 'ausente')),
  ticket_id text,
  estado text not null,
  error text,
  creado_en timestamptz not null default now()
);

create table public.llamadas (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos (id) on delete cascade,
  contacto_id uuid references public.contactos (id) on delete set null,
  telefono text not null,
  intento smallint not null,
  estado public.estado_llamada not null default 'programada',
  programada_para timestamptz not null default now(),
  iniciada_en timestamptz,
  finalizada_en timestamptz,
  twilio_sid text unique,
  duracion_seg integer,
  error text,
  unique (aviso_id, intento)
);
create index llamadas_programadas on public.llamadas (programada_para) where estado = 'programada';
