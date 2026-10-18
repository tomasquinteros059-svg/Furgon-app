// Textos de los avisos (push y voz) en el idioma de cada persona: español o inglés.
// (El mismo idioma que elige en la app; se guarda en perfiles.idioma.)

export type TipoRecorrido = "ida" | "vuelta";
export type Idioma = "es" | "en";
export const idiomaValido = (v: unknown): Idioma => (v === "en" ? "en" : "es");

export function minutosLegibles(etaSeg: number): number {
  return Math.max(1, Math.round(etaSeg / 60));
}

function enMinutos(etaSeg: number, motivo: string, idioma: Idioma = "es"): string {
  const m = minutosLegibles(etaSeg);
  if (idioma === "en") {
    if (motivo === "proximidad" || etaSeg < 90) return "is about to arrive";
    return `will arrive in about ${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  if (motivo === "proximidad" || etaSeg < 90) return "está por llegar";
  return `llegará en aproximadamente ${m} ${m === 1 ? "minuto" : "minutos"}`;
}

export function mensajeAviso(p: { tipo: TipoRecorrido; nombreAlumno: string; etaSeg: number; motivo: string; idioma?: Idioma }) {
  const cuando = enMinutos(p.etaSeg, p.motivo, p.idioma);
  if (p.idioma === "en") {
    return p.tipo === "ida"
      ? {
        titulo: `School van on its way to pick up ${p.nombreAlumno}`,
        cuerpo: `The school van ${cuando} to pick up ${p.nombreAlumno}. Please have them ready.`,
        voz: `Hello. This is a message about the school van. The van ${cuando} to pick up ${p.nombreAlumno}.`,
      }
      : {
        titulo: `${p.nombreAlumno} is almost home`,
        cuerpo: `The school van ${cuando} with ${p.nombreAlumno}. Please make sure someone is waiting at home.`,
        voz: `Hello. This is a message about the school van. The van ${cuando} with ${p.nombreAlumno}. Please make sure someone is waiting at home.`,
      };
  }
  if (p.tipo === "ida") {
    return {
      titulo: `Furgón en camino a buscar a ${p.nombreAlumno}`,
      cuerpo: `El furgón ${cuando} a buscar a ${p.nombreAlumno}. Por favor, que esté listo.`,
      voz: `Hola. Le avisamos del furgón escolar. El furgón ${cuando} a buscar a ${p.nombreAlumno}.`,
    };
  }
  return {
    titulo: `${p.nombreAlumno} llega pronto a casa`,
    cuerpo: `El furgón ${cuando} con ${p.nombreAlumno}. Por favor, que alguien esté esperando en casa.`,
    voz: `Hola. Le avisamos del furgón escolar. El furgón ${cuando} con ${p.nombreAlumno}. Por favor, que alguien esté esperando en casa.`,
  };
}

export function mensajeEstadoParada(p: { tipo: TipoRecorrido; nombreAlumno: string; estado: "entregado" | "ausente"; hora: string; idioma?: Idioma }) {
  if (p.idioma === "en") {
    if (p.estado === "ausente") {
      return { titulo: `${p.nombreAlumno}: marked absent`, cuerpo: `The driver marked ${p.nombreAlumno} as absent at ${p.hora}.` };
    }
    return p.tipo === "ida"
      ? { titulo: `${p.nombreAlumno} got on the van`, cuerpo: `${p.nombreAlumno} got on the school van at ${p.hora}.` }
      : { titulo: `${p.nombreAlumno} is home`, cuerpo: `${p.nombreAlumno} has been home since ${p.hora}.` };
  }
  if (p.estado === "ausente") {
    return {
      titulo: `${p.nombreAlumno}: marcado ausente`,
      cuerpo: `El conductor marcó a ${p.nombreAlumno} como ausente a las ${p.hora}.`,
    };
  }
  return p.tipo === "ida"
    ? { titulo: `${p.nombreAlumno} subió al furgón`, cuerpo: `${p.nombreAlumno} subió al furgón a las ${p.hora}.` }
    : { titulo: `${p.nombreAlumno} está en su hogar`, cuerpo: `${p.nombreAlumno} está en su hogar desde las ${p.hora}.` };
}

/** Llegada al colegio (ida) o salida del colegio con el niño a bordo (vuelta). */
export function mensajeColegio(p: { tipo: TipoRecorrido; nombreAlumno: string; colegio: string; hora: string; idioma?: Idioma }) {
  if (p.idioma === "en") {
    return p.tipo === "ida"
      ? { titulo: `${p.nombreAlumno} arrived at school`, cuerpo: `${p.nombreAlumno} arrived at ${p.colegio} at ${p.hora}.` }
      : { titulo: `${p.nombreAlumno} is on the way home`, cuerpo: `The van left ${p.colegio} with ${p.nombreAlumno} at ${p.hora}.` };
  }
  return p.tipo === "ida"
    ? { titulo: `${p.nombreAlumno} llegó al colegio`, cuerpo: `${p.nombreAlumno} llegó a ${p.colegio} a las ${p.hora}.` }
    : { titulo: `${p.nombreAlumno} va camino a casa`, cuerpo: `El furgón salió de ${p.colegio} con ${p.nombreAlumno} a las ${p.hora}.` };
}

/** Hora local de Chile en formato HH:MM. */
export function horaChile(fecha: Date, zona = "America/Santiago"): string {
  return new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona }).format(fecha);
}

/** Aviso a la tía de que su licencia de conducir vence (o venció). */
export function mensajeVencimientoLicencia(p: { nombre: string; dias: number; venceEn: string; idioma?: Idioma }) {
  const [a, m, d] = p.venceEn.split("-");
  const fecha = `${d}-${m}-${a}`;
  const nombre = p.nombre.split(" ")[0];
  if (p.idioma === "en") {
    if (p.dias < 0) {
      return { titulo: "Your license has expired", cuerpo: `${nombre}, your driver's license expired on ${fecha}. Upload the renewed one in “My license” to keep starting trips.` };
    }
    if (p.dias === 0) {
      return { titulo: "Your license expires today", cuerpo: `${nombre}, your driver's license expires today (${fecha}). From tomorrow you won't be able to start trips until you upload the renewed one.` };
    }
    return {
      titulo: `Your license expires in ${p.dias} day${p.dias === 1 ? "" : "s"}`,
      cuerpo: `${nombre}, your driver's license expires on ${fecha}. Schedule the renewal and upload it in “My license”.`,
    };
  }
  if (p.dias < 0) {
    return { titulo: "Tu licencia venció", cuerpo: `${nombre}, tu licencia de conducir venció el ${fecha}. Sube la renovada en «Mi licencia» para seguir iniciando recorridos.` };
  }
  if (p.dias === 0) {
    return { titulo: "Tu licencia vence hoy", cuerpo: `${nombre}, tu licencia de conducir vence hoy (${fecha}). Desde mañana no podrás iniciar recorridos hasta subir la renovada.` };
  }
  return {
    titulo: `Tu licencia vence en ${p.dias} día${p.dias === 1 ? "" : "s"}`,
    cuerpo: `${nombre}, tu licencia de conducir vence el ${fecha}. Agenda la renovación y súbela en «Mi licencia».`,
  };
}

const NOMBRES_DOCUMENTO: Record<string, { es: string; en: string }> = {
  padron: { es: "el padrón del furgón", en: "the vehicle registration" },
  permiso_circulacion: { es: "el permiso de circulación", en: "the road permit" },
  revision_tecnica: { es: "la revisión técnica", en: "the technical inspection" },
  soap: { es: "el SOAP", en: "the mandatory insurance (SOAP)" },
  registro_escolar: { es: "el registro de transporte escolar", en: "the school transport registry" },
  seguro_pasajeros: { es: "el seguro de pasajeros", en: "the passenger insurance" },
  antecedentes: { es: "el certificado de antecedentes", en: "the criminal record certificate" },
  inhabilidades: { es: "el certificado de inhabilidades", en: "the clearance to work with minors" },
};

/** Aviso a la tía de que un documento del furgón (o suyo) vence o venció. */
export function mensajeVencimientoDocumento(p: { tipo: string; dias: number; venceEn: string; patente?: string | null; idioma?: Idioma }) {
  const [a, m, d] = p.venceEn.split("-");
  const fecha = `${d}-${m}-${a}`;
  const n = NOMBRES_DOCUMENTO[p.tipo] ?? { es: p.tipo, en: p.tipo };
  if (p.idioma === "en") {
    const doc = n.en + (p.patente ? ` (${p.patente})` : "");
    const Doc = doc[0].toUpperCase() + doc.slice(1);
    if (p.dias < 0) return { titulo: `${Doc} has expired`, cuerpo: `${Doc} expired on ${fecha}. Upload the current one in “Van documents” to keep starting trips.` };
    if (p.dias === 0) return { titulo: `${Doc} expires today`, cuerpo: `${Doc} expires today (${fecha}). From tomorrow you won't be able to start trips until you upload the new one.` };
    return { titulo: `${Doc} expires in ${p.dias} day${p.dias === 1 ? "" : "s"}`, cuerpo: `${Doc} expires on ${fecha}. Renew it and upload it in “Van documents”.` };
  }
  const doc = n.es + (p.patente ? ` (${p.patente})` : "");
  const Doc = doc[0].toUpperCase() + doc.slice(1);
  if (p.dias < 0) return { titulo: `${Doc} venció`, cuerpo: `${Doc} venció el ${fecha}. Sube el vigente en «Documentos del furgón» para seguir iniciando recorridos.` };
  if (p.dias === 0) return { titulo: `${Doc} vence hoy`, cuerpo: `${Doc} vence hoy (${fecha}). Desde mañana no podrás iniciar recorridos hasta subir el nuevo.` };
  return { titulo: `${Doc} vence en ${p.dias} día${p.dias === 1 ? "" : "s"}`, cuerpo: `${Doc} vence el ${fecha}. Renuévalo y súbelo en «Documentos del furgón».` };
}
