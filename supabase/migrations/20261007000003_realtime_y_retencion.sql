-- =============================================================================
-- Realtime (estado de las paradas para el apoderado) y retención de datos
-- =============================================================================

-- La app del apoderado escucha cambios de estado/ETA de su hijo. Realtime respeta RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.recorrido_alumnos, public.avisos, public.posiciones;
  end if;
end $$;

-- Tareas programadas (pg_cron). Si la extensión no está disponible, se omiten.
do $$
begin
  create extension if not exists pg_cron;

  -- Privacidad: las posiciones crudas se borran a los 30 días (el historial de
  -- avisos y entregas se conserva).
  perform cron.schedule('furgon-borrar-posiciones', '15 4 * * *',
    $q$delete from public.posiciones where registrada_en < now() - interval '30 days'$q$);

  -- Nada de rastreo fuera del recorrido: si el conductor olvidó finalizar, se cierra
  -- solo tras 30 min sin posiciones (o 5 h de duración). El teléfono, al recibir
  -- "recorrido no activo", detiene el GPS.
  perform cron.schedule('furgon-cerrar-recorridos-olvidados', '*/10 * * * *',
    $q$update public.recorridos set estado = 'finalizado', finalizado_en = now(), eta_cache = null
       where estado = 'activo'
         and (coalesce(ultima_posicion_en, iniciado_en) < now() - interval '30 minutes'
              or iniciado_en < now() - interval '5 hours')$q$);
exception when others then
  raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;
