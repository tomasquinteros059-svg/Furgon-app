// Recomendación del orden de las paradas de una ruta, con las direcciones de los alumnos.
//
// Es el "problema del vendedor viajero" con camino abierto:
//  - Ida (casas → colegio): el recorrido termina en el colegio y puede empezar en cualquier casa.
//  - Vuelta (colegio → casas): empieza en el colegio y termina en la última casa.
// Hasta 8 paradas se prueban todas las combinaciones (resultado óptimo). Con más, se construyen
// varias soluciones por "vecino más cercano" y se mejoran con 2-opt y reubicación de tramos.
// Sin dependencias: corre igual en el servidor, en la app y en el panel web.

import { distanciaM, type LatLng } from "./geo.ts";

/** Relación típica en ciudad entre la distancia por calles y la distancia en línea recta. */
export const FACTOR_CALLES = 1.3;
/** Con hasta este número de paradas se prueban todas las combinaciones. */
const MAXIMO_EXACTO = 8;
/** Diferencias menores no justifican cambiarle el orden a la tía. */
const AHORRO_MINIMO_M = 50;

export interface ParadaRuta extends LatLng {
  id: string;
}

export interface ExtremosRuta {
  /** Punto fijo de partida (por ejemplo, el colegio en la vuelta). */
  inicio?: LatLng | null;
  /** Punto fijo de llegada (por ejemplo, el colegio en la ida). */
  fin?: LatLng | null;
}

export interface Recomendacion {
  /** Ids de las paradas en el orden recomendado. */
  orden: string[];
  /** Largo aproximado por calles del orden recomendado, en metros. */
  metros: number;
  /** Largo aproximado por calles del orden actual, en metros. */
  metrosActual: number;
  /** Metros que se ahorran con la recomendación (0 si no conviene cambiar). */
  ahorroM: number;
  /** true si el orden recomendado es distinto del actual. */
  cambia: boolean;
}

/** Extremos fijos según el tipo de ruta: la ida termina en el colegio y la vuelta parte de él. */
export function extremosDeRuta(tipo: "ida" | "vuelta", colegio: LatLng | null): ExtremosRuta {
  if (!colegio) return {};
  return tipo === "ida" ? { fin: colegio } : { inicio: colegio };
}

/** Largo aproximado por calles (metros) de recorrer las paradas en el orden dado. */
export function largoRutaM(paradas: LatLng[], extremos: ExtremosRuta = {}): number {
  const puntos = [extremos.inicio, ...paradas, extremos.fin].filter((p): p is LatLng => !!p);
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaM(puntos[i - 1], puntos[i]);
  return total * FACTOR_CALLES;
}

/**
 * Recomienda el orden de las paradas que minimiza el largo del recorrido.
 * `paradas` viene en el orden actual; si el ahorro es menor a 50 m, se conserva ese orden.
 */
export function recomendarRuta(paradas: ParadaRuta[], extremos: ExtremosRuta = {}): Recomendacion {
  const n = paradas.length;
  const actual = paradas.map((_, i) => i);
  const costo = crearCosto(paradas, extremos);
  const costoActual = costo(actual);

  let mejor = actual;
  if (n >= 2) mejor = n <= MAXIMO_EXACTO ? exacto(n, costo) : heuristico(paradas, extremos, costo);

  const ahorro = costoActual - costo(mejor);
  if (ahorro * FACTOR_CALLES < AHORRO_MINIMO_M) mejor = actual;
  const metros = costo(mejor) * FACTOR_CALLES;
  const metrosActual = costoActual * FACTOR_CALLES;
  return {
    orden: mejor.map((i) => paradas[i].id),
    metros,
    metrosActual,
    ahorroM: Math.max(0, metrosActual - metros),
    cambia: mejor.some((v, i) => v !== i),
  };
}

// ---------------------------------------------------------------------------

type Costo = (orden: number[]) => number;

/** Costo en línea recta de un orden (índices), incluyendo los extremos fijos. */
function crearCosto(paradas: LatLng[], ext: ExtremosRuta): Costo {
  const n = paradas.length;
  const d = paradas.map((a) => paradas.map((b) => distanciaM(a, b)));
  const desdeInicio = paradas.map((p) => (ext.inicio ? distanciaM(ext.inicio, p) : 0));
  const hastaFin = paradas.map((p) => (ext.fin ? distanciaM(p, ext.fin) : 0));
  const costo = (orden: number[]) => {
    if (orden.length === 0) return ext.inicio && ext.fin ? distanciaM(ext.inicio, ext.fin) : 0;
    let c = desdeInicio[orden[0]] + hastaFin[orden[orden.length - 1]];
    for (let i = 1; i < orden.length; i++) c += d[orden[i - 1]][orden[i]];
    return c;
  };
  return Object.assign(costo, { d, desdeInicio, hastaFin, n });
}

/** Prueba todas las combinaciones, descartando ramas que ya superan a la mejor encontrada. */
function exacto(n: number, costo: Costo): number[] {
  const { d, desdeInicio, hastaFin } = costo as Costo & { d: number[][]; desdeInicio: number[]; hastaFin: number[] };
  let mejor: number[] = [];
  let mejorCosto = Infinity;
  const camino: number[] = [];
  const usado = new Array<boolean>(n).fill(false);
  const buscar = (acumulado: number) => {
    if (acumulado >= mejorCosto) return;
    if (camino.length === n) {
      const total = acumulado + hastaFin[camino[n - 1]];
      if (total < mejorCosto - 1e-9) { mejorCosto = total; mejor = [...camino]; }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (usado[i]) continue;
      const paso = camino.length === 0 ? desdeInicio[i] : d[camino[camino.length - 1]][i];
      usado[i] = true; camino.push(i);
      buscar(acumulado + paso);
      camino.pop(); usado[i] = false;
    }
  };
  buscar(0);
  return mejor;
}

function heuristico(paradas: LatLng[], ext: ExtremosRuta, costo: Costo): number[] {
  const n = paradas.length;
  const { d } = costo as Costo & { d: number[][] };
  const vecinoMasCercano = (primero: number) => {
    const orden = [primero];
    const usado = new Set(orden);
    while (orden.length < n) {
      const ultimo = orden[orden.length - 1];
      let sig = -1;
      for (let i = 0; i < n; i++) if (!usado.has(i) && (sig < 0 || d[ultimo][i] < d[ultimo][sig])) sig = i;
      orden.push(sig); usado.add(sig);
    }
    return orden;
  };
  const masCercanoA = (p: LatLng) => paradas.reduce((m, q, i) => (distanciaM(p, q) < distanciaM(p, paradas[m]) ? i : m), 0);

  // Puntos de partida: el más cercano al inicio fijo; o, si solo el final es fijo, se arma
  // desde el final y se invierte; sin extremos, se prueba partir de cada parada.
  const candidatos: number[][] = [];
  if (ext.inicio) candidatos.push(vecinoMasCercano(masCercanoA(ext.inicio)));
  else if (ext.fin) candidatos.push(vecinoMasCercano(masCercanoA(ext.fin)).reverse());
  else for (let i = 0; i < n; i++) candidatos.push(vecinoMasCercano(i));
  candidatos.push(paradas.map((_, i) => i)); // el orden actual también se mejora

  let mejor = candidatos[0];
  for (const c of candidatos) {
    const m = mejorar(c, costo);
    if (costo(m) < costo(mejor)) mejor = m;
  }
  return mejor;
}

/** Mejora local: invierte tramos (2-opt) y reubica tramos de 1 a 3 paradas hasta que nada mejore. */
function mejorar(inicial: number[], costo: Costo): number[] {
  let orden = [...inicial];
  let actual = costo(orden);
  for (let vuelta = 0, hubo = true; hubo && vuelta < 100; vuelta++) {
    hubo = false;
    for (let i = 0; i < orden.length - 1; i++) {
      for (let j = i + 1; j < orden.length; j++) {
        const prueba = [...orden.slice(0, i), ...orden.slice(i, j + 1).reverse(), ...orden.slice(j + 1)];
        const c = costo(prueba);
        if (c < actual - 1e-6) { orden = prueba; actual = c; hubo = true; }
      }
    }
    for (let largo = 1; largo <= 3; largo++) {
      for (let i = 0; i + largo <= orden.length; i++) {
        const tramo = orden.slice(i, i + largo);
        const resto = [...orden.slice(0, i), ...orden.slice(i + largo)];
        for (let k = 0; k <= resto.length; k++) {
          if (k === i) continue;
          const prueba = [...resto.slice(0, k), ...tramo, ...resto.slice(k)];
          const c = costo(prueba);
          if (c < actual - 1e-6) { orden = prueba; actual = c; hubo = true; break; }
        }
      }
    }
  }
  return orden;
}
