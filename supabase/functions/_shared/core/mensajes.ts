// Textos en español de los avisos (push y voz).

export type TipoRecorrido = "ida" | "vuelta";

export function minutosLegibles(etaSeg: number): number {
  return Math.max(1, Math.round(etaSeg / 60));
}

function enMinutos(etaSeg: number, motivo: string): string {
  if (motivo === "proximidad" || etaSeg < 90) return "está por llegar";
  const m = minutosLegibles(etaSeg);
  return `llegará en aproximadamente ${m} ${m === 1 ? "minuto" : "minutos"}`;
}

export function mensajeAviso(p: { tipo: TipoRecorrido; nombreAlumno: string; etaSeg: number; motivo: string }) {
  const cuando = enMinutos(p.etaSeg, p.motivo);
  if (p.tipo === "ida") {
    return {
      titulo: `🚐 Furgón en camino a buscar a ${p.nombreAlumno}`,
      cuerpo: `El furgón ${cuando} a buscar a ${p.nombreAlumno}. Por favor, que esté listo.`,
      voz: `Hola. Le avisamos del furgón escolar. El furgón ${cuando} a buscar a ${p.nombreAlumno}.`,
    };
  }
  return {
    titulo: `🚐 ${p.nombreAlumno} llega pronto a casa`,
    cuerpo: `El furgón ${cuando} con ${p.nombreAlumno}. Por favor, que alguien esté esperando en casa.`,
    voz: `Hola. Le avisamos del furgón escolar. El furgón ${cuando} con ${p.nombreAlumno}. Por favor, que alguien esté esperando en casa.`,
  };
}

export function mensajeEstadoParada(p: { tipo: TipoRecorrido; nombreAlumno: string; estado: "entregado" | "ausente"; hora: string }) {
  if (p.estado === "ausente") {
    return {
      titulo: `${p.nombreAlumno}: marcado ausente`,
      cuerpo: `El conductor marcó a ${p.nombreAlumno} como ausente a las ${p.hora}.`,
    };
  }
  return p.tipo === "ida"
    ? { titulo: `✅ ${p.nombreAlumno} subió al furgón`, cuerpo: `${p.nombreAlumno} subió al furgón a las ${p.hora}.` }
    : { titulo: `🏠 ${p.nombreAlumno} está en su hogar`, cuerpo: `${p.nombreAlumno} está en su hogar desde las ${p.hora}.` };
}

/** Hora local de Chile en formato HH:MM. */
export function horaChile(fecha: Date, zona = "America/Santiago"): string {
  return new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona }).format(fecha);
}

/** Aviso a la tía de que su licencia de conducir vence (o venció). */
export function mensajeVencimientoLicencia(p: { nombre: string; dias: number; venceEn: string }) {
  const [a, m, d] = p.venceEn.split("-");
  const fecha = `${d}-${m}-${a}`;
  const nombre = p.nombre.split(" ")[0];
  if (p.dias < 0) {
    return { titulo: "🪪 Tu licencia venció", cuerpo: `${nombre}, tu licencia de conducir venció el ${fecha}. Sube la renovada en «Mi licencia» para seguir iniciando recorridos.` };
  }
  if (p.dias === 0) {
    return { titulo: "🪪 Tu licencia vence hoy", cuerpo: `${nombre}, tu licencia de conducir vence hoy (${fecha}). Desde mañana no podrás iniciar recorridos hasta subir la renovada.` };
  }
  return {
    titulo: `🪪 Tu licencia vence en ${p.dias} día${p.dias === 1 ? "" : "s"}`,
    cuerpo: `${nombre}, tu licencia de conducir vence el ${fecha}. Agenda la renovación y súbela en «Mi licencia».`,
  };
}
