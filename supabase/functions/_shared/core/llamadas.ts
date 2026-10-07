// Escalera de llamadas automáticas al apoderado.
//
// Plan por defecto: principal → (si no confirma) reintento al principal a los 30 s →
// (si no confirma) contacto secundario. Una llamada solo cuenta como "contestada"
// si la persona presiona 1: así un buzón de voz no corta la escalera.

export type ResultadoLlamada =
  | "confirmada" // contestó y presionó 1
  | "sin_confirmar" // se conectó pero nadie presionó 1 (posible buzón de voz)
  | "no_contesto"
  | "ocupado"
  | "fallida" // número inválido, error del operador, etc.
  | "cancelada";

export interface ContactoLlamada {
  id: string;
  telefono: string;
  /** 1 = principal, 2 = secundario, ... */
  prioridad: number;
}

export interface IntentoLlamada {
  contactoId: string;
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
}

export const CONFIG_LLAMADAS_POR_DEFECTO: ConfigLlamadas = {
  reintentosPrincipal: 1,
  reintentosOtros: 0,
  esperaReintentoSeg: 30,
  esperaSiguienteContactoSeg: 0,
};

export type PasoLlamada =
  | { tipo: "llamar"; contactoId: string; telefono: string; intento: number; esperaSeg: number }
  | { tipo: "esperar" } // hay una llamada en curso
  | { tipo: "fin"; motivo: "confirmada" | "sin_contactos" | "agotado" | "detenido" };

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
  for (const [pos, contacto] of ordenados.entries()) {
    const hechos = intentos.filter((i) => i.contactoId === contacto.id);
    const maximo = 1 + (pos === 0 ? config.reintentosPrincipal : config.reintentosOtros);
    // Un número que falló (inválido, fuera de servicio) no se reintenta.
    const numeroMalo = hechos.some((i) => i.resultado === "fallida");
    if (hechos.length >= maximo || numeroMalo) continue;

    const mismoNumero = ultimo?.contactoId === contacto.id;
    return {
      tipo: "llamar",
      contactoId: contacto.id,
      telefono: contacto.telefono,
      intento: intentos.length + 1,
      esperaSeg: ultimo === undefined ? 0 : mismoNumero ? config.esperaReintentoSeg : config.esperaSiguienteContactoSeg,
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
