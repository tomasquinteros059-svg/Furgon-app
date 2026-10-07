// Deduplicación de avisos: un solo aviso por alumno por recorrido.
//
// La garantía real la da la base de datos (restricción UNIQUE en avisos +
// INSERT ... ON CONFLICT DO NOTHING RETURNING). Aquí se define el contrato y una
// implementación en memoria equivalente para los tests y el simulador.

import type { Disparo } from "./disparo.ts";

export interface NuevoAviso {
  recorridoId: string;
  disparo: Disparo;
}

export interface RegistroAvisos {
  /**
   * Registra el aviso de forma atómica. Devuelve el id del aviso si ESTA llamada lo
   * creó, o `null` si ya existía uno para ese alumno en ese recorrido.
   */
  registrar(aviso: NuevoAviso): Promise<string | null>;
}

/**
 * Para cada disparo, registra el aviso y ejecuta `alDisparar` solo si fue esta
 * invocación la que lo creó. Así, aunque el furgón entre y salga del radio, o
 * lleguen dos lotes de posiciones a la vez, se notifica una única vez.
 */
export async function dispararUnaVez(
  recorridoId: string,
  disparos: Disparo[],
  registro: RegistroAvisos,
  alDisparar: (avisoId: string, disparo: Disparo) => Promise<void>,
): Promise<string[]> {
  const creados: string[] = [];
  for (const disparo of disparos) {
    const avisoId = await registro.registrar({ recorridoId, disparo });
    if (avisoId === null) continue;
    creados.push(avisoId);
    await alDisparar(avisoId, disparo);
  }
  return creados;
}

/** Implementación en memoria con la misma semántica que la restricción UNIQUE. */
export class RegistroAvisosEnMemoria implements RegistroAvisos {
  readonly avisos = new Map<string, { id: string; aviso: NuevoAviso }>();
  private secuencia = 0;

  registrar(aviso: NuevoAviso): Promise<string | null> {
    const clave = `${aviso.recorridoId}:${aviso.disparo.alumnoId}`;
    if (this.avisos.has(clave)) return Promise.resolve(null);
    const id = `aviso-${++this.secuencia}`;
    this.avisos.set(clave, { id, aviso });
    return Promise.resolve(id);
  }
}
