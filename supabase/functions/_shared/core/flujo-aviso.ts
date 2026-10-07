// Orquestación de una evaluación: posición nueva → ETA → disparos → avisos únicos.
//
// Sin E/S directa: todo lo externo (proveedor de mapas, base de datos, push,
// llamadas) llega inyectado en `DepsFlujo`. La Edge Function `posiciones` lo usa
// con implementaciones reales; los tests y el simulador, con dobles en memoria.

import {
  combinarEtas,
  decidirConsultaEta,
  type CacheEta,
  type ConfigDisparo,
  type DecisionEta,
  type Disparo,
  etasDesdeCache,
  etasDesdeTramos,
  etasRespaldo,
  evaluarDisparos,
  type ParadaPendiente,
  posicionVigente,
} from "./disparo.ts";
import { dispararUnaVez, type RegistroAvisos } from "./dedup.ts";
import type { LatLng } from "./geo.ts";

export interface ProveedorEta {
  readonly nombre: string;
  /**
   * Duración con tráfico de cada tramo de la ruta origen → d1 → d2 → ... (en segundos).
   * Debe devolver exactamente `destinos.length` valores.
   */
  duracionesTramos(origen: LatLng, destinos: LatLng[]): Promise<number[]>;
}

export interface DepsFlujo {
  ahoraMs(): number;
  config: ConfigDisparo;
  proveedorEta: ProveedorEta | null;
  timeoutProveedorMs: number;
  registro: RegistroAvisos;
  /** Persiste el ETA por parada (para mostrarlo) y el cache del proveedor (null = no cambió). */
  guardarEtas(recorridoId: string, etas: { paradaId: string; etaSeg: number }[], cache: CacheEta | null): Promise<void>;
  /** Envía push y programa la llamada. Solo se invoca una vez por aviso. */
  notificar(avisoId: string, disparo: Disparo): Promise<void>;
  log?(mensaje: string, datos?: unknown): void;
}

export interface EntradaEvaluacion {
  recorridoId: string;
  posicion: LatLng & { registradaEnMs: number };
  /** Paradas aún pendientes, en orden de ruta. */
  paradas: ParadaPendiente[];
  cache: CacheEta | null;
}

export interface ResultadoEvaluacion {
  vigente: boolean;
  decision: DecisionEta | null;
  fuente: "eta" | "geocerca" | null;
  etasSeg: number[];
  disparos: Disparo[];
  avisosCreados: string[];
  errorProveedor?: string;
}

export async function evaluarPosicion(deps: DepsFlujo, entrada: EntradaEvaluacion): Promise<ResultadoEvaluacion> {
  const { config } = deps;
  const ahora = deps.ahoraMs();
  const { posicion, paradas, recorridoId } = entrada;
  const vacio: ResultadoEvaluacion = {
    vigente: false, decision: null, fuente: null, etasSeg: [], disparos: [], avisosCreados: [],
  };

  if (!posicionVigente(posicion.registradaEnMs, ahora, config)) return vacio;
  if (paradas.length === 0) return { ...vacio, vigente: true };

  const respaldo = etasRespaldo(posicion, paradas, config);
  const decision = decidirConsultaEta({ posicion, ahoraMs: ahora, paradas, cache: entrada.cache, config });

  let etasSeg = respaldo;
  let fuente: "eta" | "geocerca" = "geocerca";
  let nuevoCache: CacheEta | null = null;
  let errorProveedor: string | undefined;

  if (decision === "reusar_cache" && entrada.cache) {
    etasSeg = combinarEtas(etasDesdeCache(entrada.cache, ahora), respaldo);
    fuente = "eta";
  } else if (decision === "consultar" && deps.proveedorEta) {
    const consultadas = paradas.slice(0, config.maxParadasConsulta);
    try {
      const tramos = await conTimeout(
        deps.proveedorEta.duracionesTramos(posicion, consultadas.map((p) => p.ubicacion)),
        deps.timeoutProveedorMs,
      );
      if (tramos.length !== consultadas.length || tramos.some((t) => !Number.isFinite(t) || t < 0)) {
        throw new Error(`respuesta inválida del proveedor (${tramos.length} tramos)`);
      }
      const proveedor = etasDesdeTramos(tramos, config);
      nuevoCache = {
        calculadaEnMs: ahora,
        origen: { lat: posicion.lat, lng: posicion.lng },
        paradaIds: consultadas.map((p) => p.id),
        etasSeg: proveedor,
      };
      etasSeg = combinarEtas(proveedor, respaldo);
      fuente = "eta";
    } catch (e) {
      // La API falló o tardó demasiado: se usa la geocerca de respaldo.
      errorProveedor = e instanceof Error ? e.message : String(e);
      deps.log?.("proveedor ETA falló, usando respaldo", errorProveedor);
    }
  }

  await deps.guardarEtas(
    recorridoId,
    paradas.map((p, i) => ({ paradaId: p.id, etaSeg: Math.round(etasSeg[i]) })),
    nuevoCache,
  );

  const disparos = evaluarDisparos({ posicion, paradas, etasSeg, fuente, config });
  const avisosCreados = await dispararUnaVez(recorridoId, disparos, deps.registro, (avisoId, d) =>
    deps.notificar(avisoId, d).catch((e) => {
      // El aviso ya quedó registrado: un fallo de push no debe impedir el resto.
      deps.log?.(`error notificando aviso ${avisoId}`, e instanceof Error ? e.message : e);
    })
  );

  return { vigente: true, decision, fuente, etasSeg, disparos, avisosCreados, errorProveedor };
}

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`timeout de ${ms} ms`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}
