// Cola de posiciones para funcionar con mala señal.
//
// Toda posición se guarda primero en almacenamiento local y luego se envía en
// lotes. Si el envío falla, queda en la cola y se reintenta en el próximo ciclo.
// Cada posición lleva un `clientId` único: el servidor ignora duplicados, así que
// reenviar un lote que sí llegó (pero cuya respuesta se perdió) es inofensivo.

export interface PosicionGps {
  clientId: string;
  recorridoId: string;
  /** epoch ms del GPS */
  registradaEnMs: number;
  lat: number;
  lng: number;
  precisionM: number | null;
  velocidadMs: number | null;
  rumbo: number | null;
}

export interface AlmacenCola {
  agregar(posiciones: PosicionGps[]): Promise<void>;
  /** Las `n` más antiguas, en orden cronológico. */
  tomar(n: number): Promise<PosicionGps[]>;
  eliminar(clientIds: string[]): Promise<void>;
  contar(): Promise<number>;
}

export type ResultadoEnvio = { ok: true } | { ok: false; reintentable: boolean; error: string };

export interface ResumenVaciado {
  enviadas: number;
  pendientes: number;
  error?: string;
}

/**
 * Envía la cola en lotes (agrupados por recorrido) hasta vaciarla o hasta el primer
 * error. Un error no reintentable (p. ej. recorrido ya finalizado) descarta el lote.
 */
export async function vaciarCola(
  almacen: AlmacenCola,
  enviar: (recorridoId: string, lote: PosicionGps[]) => Promise<ResultadoEnvio>,
  tamanoLote = 50,
  maxLotes = 20,
): Promise<ResumenVaciado> {
  let enviadas = 0;
  for (let n = 0; n < maxLotes; n++) {
    const pendientes = await almacen.tomar(tamanoLote);
    if (pendientes.length === 0) break;
    const recorridoId = pendientes[0].recorridoId;
    const lote = pendientes.filter((p) => p.recorridoId === recorridoId);
    const r = await enviar(recorridoId, lote);
    if (!r.ok && r.reintentable) {
      return { enviadas, pendientes: await almacen.contar(), error: r.error };
    }
    await almacen.eliminar(lote.map((p) => p.clientId));
    if (r.ok) enviadas += lote.length;
  }
  return { enviadas, pendientes: await almacen.contar() };
}

/** Implementación en memoria (simulador y tests). */
export class AlmacenColaEnMemoria implements AlmacenCola {
  private items: PosicionGps[] = [];

  agregar(posiciones: PosicionGps[]): Promise<void> {
    const existentes = new Set(this.items.map((p) => p.clientId));
    this.items.push(...posiciones.filter((p) => !existentes.has(p.clientId)));
    this.items.sort((a, b) => a.registradaEnMs - b.registradaEnMs);
    return Promise.resolve();
  }
  tomar(n: number): Promise<PosicionGps[]> {
    return Promise.resolve(this.items.slice(0, n));
  }
  eliminar(clientIds: string[]): Promise<void> {
    const set = new Set(clientIds);
    this.items = this.items.filter((p) => !set.has(p.clientId));
    return Promise.resolve();
  }
  contar(): Promise<number> {
    return Promise.resolve(this.items.length);
  }
}
