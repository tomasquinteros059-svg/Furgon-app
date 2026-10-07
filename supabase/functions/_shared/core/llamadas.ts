// Escalera de llamadas automáticas al apoderado.
//
// Plan por defecto: principal → (si no confirma) reintento al principal a los 30 s →
// (si no confirma) contacto secundario. Una llamada solo cuenta como "contestada"
// si la persona presiona 1: así un buzón de voz no corta la escalera.
//
// Canales:
//   - "app"      llamada por internet dentro de la app (sin costo: push + voz generada
//                en el propio teléfono). Se usa si el contacto tiene la app instalada.
//   - "telefono" llamada telefónica normal con Twilio (con costo).
// Si la llamada por la app no llega (el teléfono no acusa recibo: sin internet), se
// llama de inmediato por teléfono al mismo contacto, sin gastar un reintento, y el
// resto de la escalera para ese contacto sigue por teléfono.

export type CanalLlamada = "app" | "telefono";

export type ResultadoLlamada =
  | "confirmada" // contestó y presionó 1
  | "sin_confirmar" // se conectó pero nadie presionó 1 (posible buzón de voz)
  | "no_contesto"
  | "ocupado"
  | "fallida" // número inválido, error del operador, etc.
  | "cancelada"
  | "sin_internet"; // llamada por la app que no llegó al teléfono

export interface ContactoLlamada {
  id: string;
  telefono: string;
  /** 1 = principal, 2 = secundario, ... */
  prioridad: number;
  /** El contacto tiene la app con notificaciones activas (puede recibir la llamada gratis). */
  tieneApp?: boolean;
}

export interface IntentoLlamada {
  contactoId: string;
  /** Por defecto "telefono". */
  canal?: CanalLlamada;
  /** null mientras la llamada está programada o en curso */
  resultado: ResultadoLlamada | null;
}

export interface ConfigLlamadas {
  /** Reintentos adicionales al contacto principal antes de pasar al siguiente. */
  reintentosPrincipal: number;
  /** Reintentos adicionales a los demás contactos. */
  reintentosOtros: number;
  /** Espera antes de volver a llamar al mismo número. */
  esperaReintentoSeg: number;
  /** Espera antes de pasar a otro contacto. */
  esperaSiguienteContactoSeg: number;
  /** Plazo para que el teléfono acuse recibo de la llamada por la app; si no, "sin internet". */
  esperaAcuseAppSeg: number;
  /** Tiempo que suena la llamada por la app antes de contar como no contestada. */
  timbreAppSeg: number;
}

export const CONFIG_LLAMADAS_POR_DEFECTO: ConfigLlamadas = {
  reintentosPrincipal: 1,
  reintentosOtros: 0,
  esperaReintentoSeg: 30,
  esperaSiguienteContactoSeg: 0,
  esperaAcuseAppSeg: 15,
  timbreAppSeg: 30,
};

export type PasoLlamada =
  | { tipo: "llamar"; contactoId: string; telefono: string; intento: number; esperaSeg: number; canal: CanalLlamada }
  | { tipo: "esperar" } // hay una llamada en curso
  | { tipo: "fin"; motivo: "confirmada" | "sin_contactos" | "agotado" | "detenido" };

const canalDe = (i: IntentoLlamada): CanalLlamada => i.canal ?? "telefono";

/**
 * Decide el próximo paso de la escalera a partir de los intentos ya hechos.
 * @param detener true si el aviso ya no es necesario (alumno entregado, recorrido terminado).
 */
export function siguienteLlamada(params: {
  contactos: ContactoLlamada[];
  intentos: IntentoLlamada[];
  detener?: boolean;
  config?: ConfigLlamadas;
}): PasoLlamada {
  const { contactos, intentos, detener = false, config = CONFIG_LLAMADAS_POR_DEFECTO } = params;

  if (intentos.some((i) => i.resultado === "confirmada")) return { tipo: "fin", motivo: "confirmada" };
  if (detener) return { tipo: "fin", motivo: "detenido" };
  if (intentos.some((i) => i.resultado === null)) return { tipo: "esperar" };

  const ordenados = contactos
    .filter((c) => c.telefono.trim() !== "")
    .sort((a, b) => a.prioridad - b.prioridad);
  if (ordenados.length === 0) return { tipo: "fin", motivo: "sin_contactos" };

  const ultimo = intentos.at(-1);

  // La llamada gratis no llegó: se llama por teléfono al mismo contacto, sin esperar.
  if (ultimo && canalDe(ultimo) === "app" && ultimo.resultado === "sin_internet") {
    const c = ordenados.find((x) => x.id === ultimo.contactoId);
    if (c) {
      return { tipo: "llamar", contactoId: c.id, telefono: c.telefono, intento: intentos.length + 1, esperaSeg: 0, canal: "telefono" };
    }
  }

  for (const [pos, contacto] of ordenados.entries()) {
    const propios = intentos.filter((i) => i.contactoId === contacto.id);
    // Una llamada por la app que no llegó no cuenta como ronda: la reemplazó la telefónica.
    const rondas = propios.filter((i) => i.resultado !== "sin_internet");
    const maximo = 1 + (pos === 0 ? config.reintentosPrincipal : config.reintentosOtros);
    // Un número que falló (inválido, fuera de servicio) no se reintenta.
    const numeroMalo = propios.some((i) => i.resultado === "fallida" && canalDe(i) === "telefono");
    if (rondas.length >= maximo || numeroMalo) continue;

    // Si ya sabemos que no tiene internet, no se pierde tiempo con la app.
    const sinInternet = propios.some((i) => i.resultado === "sin_internet");
    const canal: CanalLlamada = contacto.tieneApp && !sinInternet ? "app" : "telefono";
    const mismoNumero = ultimo?.contactoId === contacto.id;
    return {
      tipo: "llamar",
      contactoId: contacto.id,
      telefono: contacto.telefono,
      intento: intentos.length + 1,
      esperaSeg: ultimo === undefined ? 0 : mismoNumero ? config.esperaReintentoSeg : config.esperaSiguienteContactoSeg,
      canal,
    };
  }
  return { tipo: "fin", motivo: "agotado" };
}

/** Traduce el estado final que reporta Twilio (StatusCallback) a nuestro resultado. */
export function resultadoDesdeTwilio(callStatus: string, confirmada: boolean): ResultadoLlamada | null {
  if (confirmada) return "confirmada";
  switch (callStatus) {
    case "completed":
      return "sin_confirmar";
    case "busy":
      return "ocupado";
    case "no-answer":
      return "no_contesto";
    case "failed":
      return "fallida";
    case "canceled":
      return "cancelada";
    default:
      return null; // queued, ringing, in-progress: aún no termina
  }
}

/**
 * Estado de una llamada por la app que sigue en curso, según el tiempo transcurrido:
 * sin acuse dentro del plazo → "sin_internet"; con acuse pero sin respuesta al terminar
 * el timbre → "no_contesto"; si no, sigue en curso (null).
 */
export function vencimientoLlamadaApp(params: {
  iniciadaEnMs: number;
  acuseEnMs: number | null;
  ahoraMs: number;
  config?: ConfigLlamadas;
}): "sin_internet" | "no_contesto" | null {
  const { iniciadaEnMs, acuseEnMs, ahoraMs, config = CONFIG_LLAMADAS_POR_DEFECTO } = params;
  const seg = (ahoraMs - iniciadaEnMs) / 1000;
  if (acuseEnMs === null) return seg >= config.esperaAcuseAppSeg ? "sin_internet" : null;
  return seg >= config.esperaAcuseAppSeg + config.timbreAppSeg ? "no_contesto" : null;
}
