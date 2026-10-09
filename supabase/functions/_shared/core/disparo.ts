// Lógica del disparo del aviso "el furgón llega en N minutos".
//
// Todo es puro y determinista: recibe la posición, las paradas pendientes (en el
// orden de la ruta) y, si existen, las duraciones por tramo entregadas por el
// proveedor de mapas. No hace E/S. La E/S vive en `flujo-aviso.ts`.

import { distanciaM, distanciasAcumuladasM, type LatLng } from "./geo.ts";

export interface ConfigDisparo {
  /** Holgura sumada a la ventana de aviso para cubrir la latencia de push/llamada. */
  margenSeg: number;
  /** Posiciones más antiguas que esto se guardan pero no disparan avisos. */
  antiguedadMaxPosicionSeg: number;
  /** Velocidad urbana promedio usada por el respaldo (geocerca) cuando falla la API. */
  velocidadRespaldoKmh: number;
  /** Multiplicador línea recta → distancia por calles, usado por el respaldo. */
  factorCalles: number;
  /** Tiempo estimado detenido en cada parada intermedia. */
  tiempoPorParadaSeg: number;
  /** Velocidad máxima realista; define la cota inferior del ETA para no gastar llamadas a la API. */
  velocidadMaxKmh: number;
  /** Red de seguridad: si el furgón está a menos de esto de una casa, se avisa sí o sí. */
  radioProximidadM: number;
  /** Un ETA del proveedor se reutiliza durante este tiempo... */
  vigenciaEtaSeg: number;
  /** ...siempre que el furgón no se haya movido más que esto desde que se calculó. */
  desplazamientoRecalculoM: number;
  /** Máximo de paradas enviadas al proveedor en una consulta (las siguientes se extrapolan). */
  maxParadasConsulta: number;
}

export const CONFIG_DISPARO_POR_DEFECTO: ConfigDisparo = {
  margenSeg: 30,
  antiguedadMaxPosicionSeg: 60,
  velocidadRespaldoKmh: 20,
  factorCalles: 1.3,
  tiempoPorParadaSeg: 60,
  velocidadMaxKmh: 90,
  radioProximidadM: 300,
  vigenciaEtaSeg: 60,
  desplazamientoRecalculoM: 300,
  maxParadasConsulta: 10,
};

/** Parada aún no atendida del recorrido, en el orden de la ruta. */
export interface ParadaPendiente {
  /** id de recorrido_alumnos */
  id: string;
  alumnoId: string;
  ubicacion: LatLng;
  minutosAviso: number;
  /** Ya se disparó su aviso en este recorrido (sigue en la ruta, pero no se vuelve a avisar). */
  avisado: boolean;
}

export type MotivoAviso = "eta" | "geocerca" | "proximidad";

export interface Disparo {
  paradaId: string;
  alumnoId: string;
  motivo: MotivoAviso;
  etaSeg: number;
}

/** Cache del último ETA del proveedor, guardado en el recorrido. */
export interface CacheEta {
  calculadaEnMs: number;
  origen: LatLng;
  /** ids de las paradas en el orden en que se consultaron */
  paradaIds: string[];
  etasSeg: number[];
}

const kmhAMs = (kmh: number) => kmh / 3.6;

export function ventanaSeg(parada: ParadaPendiente, config: ConfigDisparo): number {
  return parada.minutosAviso * 60 + config.margenSeg;
}

/** ¿La posición es lo bastante reciente como para disparar avisos? */
export function posicionVigente(registradaEnMs: number, ahoraMs: number, config: ConfigDisparo): boolean {
  const edadSeg = (ahoraMs - registradaEnMs) / 1000;
  // Se tolera un pequeño desfase de reloj hacia el futuro.
  return edadSeg <= config.antiguedadMaxPosicionSeg && edadSeg >= -config.antiguedadMaxPosicionSeg;
}

/**
 * Convierte duraciones por tramo (origen→p1, p1→p2, ...) en ETA acumulado por parada,
 * sumando el tiempo detenido en cada parada intermedia.
 */
export function etasDesdeTramos(tramosSeg: number[], config: ConfigDisparo): number[] {
  const res: number[] = [];
  let total = 0;
  tramosSeg.forEach((t, i) => {
    total += t;
    res.push(total + i * config.tiempoPorParadaSeg);
  });
  return res;
}

/** ETA de respaldo (geocerca): distancia acumulada × factor de calles a velocidad urbana. */
export function etasRespaldo(origen: LatLng, paradas: ParadaPendiente[], config: ConfigDisparo): number[] {
  const v = kmhAMs(config.velocidadRespaldoKmh);
  return distanciasAcumuladasM(origen, paradas.map((p) => p.ubicacion)).map(
    (d, i) => (d * config.factorCalles) / v + i * config.tiempoPorParadaSeg,
  );
}

/**
 * Radio de la geocerca equivalente para una ventana dada: útil para documentar/mostrar
 * qué significa el respaldo (5 min ≈ 1,4 km en línea recta con la config por defecto).
 */
export function radioGeocercaM(minutosAviso: number, config: ConfigDisparo): number {
  return ((minutosAviso * 60 + config.margenSeg) * kmhAMs(config.velocidadRespaldoKmh)) / config.factorCalles;
}

/**
 * Cota inferior del ETA: distancia acumulada en línea recta a velocidad máxima, sin
 * detenciones. Si incluso así no entra en la ventana, es imposible que el ETA real entre.
 */
export function cotasInferiores(origen: LatLng, paradas: ParadaPendiente[], config: ConfigDisparo): number[] {
  const v = kmhAMs(config.velocidadMaxKmh);
  return distanciasAcumuladasM(origen, paradas.map((p) => p.ubicacion)).map((d) => d / v);
}

/** ¿Alguna parada sin aviso podría estar dentro de su ventana? Si no, no vale la pena consultar la API. */
export function hayParadasEnZona(origen: LatLng, paradas: ParadaPendiente[], config: ConfigDisparo): boolean {
  const cotas = cotasInferiores(origen, paradas, config);
  return paradas.some((p, i) => !p.avisado && cotas[i] <= ventanaSeg(p, config));
}

export type DecisionEta = "consultar" | "reusar_cache" | "no_necesario";

export function decidirConsultaEta(params: {
  posicion: LatLng;
  ahoraMs: number;
  paradas: ParadaPendiente[];
  cache: CacheEta | null;
  config: ConfigDisparo;
}): DecisionEta {
  const { posicion, ahoraMs, paradas, cache, config } = params;
  if (!paradas.some((p) => !p.avisado)) return "no_necesario";
  if (!hayParadasEnZona(posicion, paradas, config)) return "no_necesario";
  if (
    cache &&
    (ahoraMs - cache.calculadaEnMs) / 1000 < config.vigenciaEtaSeg &&
    distanciaM(cache.origen, posicion) < config.desplazamientoRecalculoM &&
    mismasParadas(cache.paradaIds, paradas.slice(0, config.maxParadasConsulta).map((p) => p.id))
  ) {
    return "reusar_cache";
  }
  return "consultar";
}

function mismasParadas(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** ETA vigente a partir del cache, descontando el tiempo transcurrido. */
export function etasDesdeCache(cache: CacheEta, ahoraMs: number): number[] {
  const transcurrido = (ahoraMs - cache.calculadaEnMs) / 1000;
  return cache.etasSeg.map((e) => Math.max(0, e - transcurrido));
}

/**
 * Completa los ETA de las paradas que no se enviaron al proveedor extrapolando con el
 * respaldo a partir de la última parada consultada.
 */
export function combinarEtas(proveedor: number[], respaldo: number[]): number[] {
  if (proveedor.length === 0) return respaldo.slice();
  const ultimo = proveedor.length - 1;
  return respaldo.map((r, i) => (i <= ultimo ? proveedor[i] : proveedor[ultimo] + (r - respaldo[ultimo])));
}

/**
 * Decide qué paradas deben avisarse ahora.
 * @param etasSeg ETA por parada, alineado con `paradas`.
 * @param fuente  "eta" si viene del proveedor con tráfico, "geocerca" si es el respaldo.
 */
export function evaluarDisparos(params: {
  posicion: LatLng;
  paradas: ParadaPendiente[];
  etasSeg: number[];
  fuente: "eta" | "geocerca";
  config: ConfigDisparo;
}): Disparo[] {
  const { posicion, paradas, etasSeg, fuente, config } = params;
  const disparos: Disparo[] = [];
  paradas.forEach((p, i) => {
    if (p.avisado) return;
    const eta = Math.max(0, Math.round(etasSeg[i] ?? Infinity));
    // Red de seguridad por cercanía: solo para la próxima parada de la ruta (o una cuyo ETA ya
    // esté cerca de su ventana). Si el furgón pasa junto a una casa que viene mucho después, no avisa.
    const cercaDeVerdad = i === 0 || eta <= 2 * ventanaSeg(p, config);
    if (cercaDeVerdad && distanciaM(posicion, p.ubicacion) <= config.radioProximidadM) {
      disparos.push({ paradaId: p.id, alumnoId: p.alumnoId, motivo: "proximidad", etaSeg: Number.isFinite(eta) ? eta : 0 });
    } else if (eta <= ventanaSeg(p, config)) {
      disparos.push({ paradaId: p.id, alumnoId: p.alumnoId, motivo: fuente, etaSeg: eta });
    }
  });
  return disparos;
}
