// Implementaciones reales (Supabase) de las dependencias del flujo de aviso.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIG_DISPARO_POR_DEFECTO, type CacheEta, type ParadaPendiente } from "./core/disparo.ts";
import type { RegistroAvisos } from "./core/dedup.ts";
import type { DepsFlujo } from "./core/flujo-aviso.ts";
import { mensajeAviso, type TipoRecorrido } from "./core/mensajes.ts";
import { entorno } from "./entorno.ts";
import { proveedorDesdeEntorno } from "./proveedores-eta.ts";
import { notificarApoderados } from "./push.ts";
import { programarSiguienteLlamada } from "./servicio-llamadas.ts";

export interface ParadaConNombre extends ParadaPendiente {
  nombre: string;
}

export async function cargarParadasPendientes(sb: SupabaseClient, recorridoId: string): Promise<ParadaConNombre[]> {
  const { data, error } = await sb.rpc("paradas_pendientes", { p_recorrido: recorridoId });
  if (error) throw error;
  return (data ?? []).map((p: {
    id: string; alumno_id: string; nombre: string; lat: number; lng: number; minutos_aviso: number; avisado: boolean;
  }) => ({
    id: p.id,
    alumnoId: p.alumno_id,
    nombre: p.nombre,
    ubicacion: { lat: p.lat, lng: p.lng },
    minutosAviso: p.minutos_aviso,
    avisado: p.avisado,
  }));
}

/** Deduplicación respaldada por la restricción UNIQUE de la tabla avisos. */
export function registroAvisosPostgres(sb: SupabaseClient): RegistroAvisos {
  return {
    async registrar({ disparo }) {
      const { data, error } = await sb.rpc("registrar_aviso", {
        p_parada: disparo.paradaId,
        p_motivo: disparo.motivo,
        p_eta_seg: disparo.etaSeg,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  };
}

export function crearDepsFlujo(
  sb: SupabaseClient,
  recorrido: { id: string; tipo: TipoRecorrido },
  paradas: ParadaConNombre[],
): DepsFlujo {
  const nombres = new Map(paradas.map((p) => [p.id, p.nombre]));
  return {
    ahoraMs: () => Date.now(),
    config: CONFIG_DISPARO_POR_DEFECTO,
    proveedorEta: proveedorDesdeEntorno(),
    timeoutProveedorMs: 2500,
    registro: registroAvisosPostgres(sb),
    async guardarEtas(recorridoId, etas, cache: CacheEta | null) {
      const { error } = await sb.rpc("guardar_etas", {
        p_recorrido: recorridoId,
        p_etas: etas.map((e) => ({ id: e.paradaId, eta_seg: e.etaSeg })),
        p_cache: cache,
        p_fuente: cache ? "proveedor" : null,
      });
      if (error) throw error;
    },
    async notificar(avisoId, disparo) {
      const textos = mensajeAviso({
        tipo: recorrido.tipo,
        nombreAlumno: nombres.get(disparo.paradaId) ?? "su hijo/a",
        etaSeg: disparo.etaSeg,
        motivo: disparo.motivo,
      });
      // Push y llamada en paralelo: un fallo en uno no bloquea al otro.
      const tareas: Promise<unknown>[] = [
        notificarApoderados(sb, disparo.alumnoId, {
          tipo: "aviso",
          titulo: textos.titulo,
          cuerpo: textos.cuerpo,
          avisoId,
          recorridoAlumnoId: disparo.paradaId,
          data: { avisoId, recorridoId: recorrido.id, alumnoId: disparo.alumnoId },
        }),
      ];
      if (entorno.llamadasHabilitadas()) tareas.push(programarSiguienteLlamada(sb, avisoId));
      const resultados = await Promise.allSettled(tareas);
      const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (fallos.length) throw new Error(fallos.map((f) => String(f.reason)).join("; "));
    },
    log: (mensaje, datos) => console.warn(`[recorrido ${recorrido.id}] ${mensaje}`, datos ?? ""),
  };
}
