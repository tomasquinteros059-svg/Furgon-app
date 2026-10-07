// Situación de la licencia de conducir de la tía (rpc estado_licencias), en palabras.

export interface EstadoLic {
  estado: "sin_licencia" | "por_verificar" | "rechazada" | "vigente" | "por_vencer" | "vencida";
  numero: string | null; clase: string | null; vence_en: string | null; dias_restantes: number | null; motivo_rechazo: string | null;
}
/** aaaa-mm-dd → dd-mm-aaaa */
export const aFecha = (iso: string) => iso.split("-").reverse().join("-");

export function textoLicencia(l: EstadoLic | null): { txt: string; tono: "exito" | "error" | "info" } {
  if (!l) return { txt: "…", tono: "info" };
  switch (l.estado) {
    case "vigente": return { txt: `✓ Vigente hasta el ${aFecha(l.vence_en!)}`, tono: "exito" };
    case "por_vencer": return { txt: `⚠ Vence en ${l.dias_restantes} día${l.dias_restantes === 1 ? "" : "s"} (${aFecha(l.vence_en!)}). Sube la renovada apenas la tengas.`, tono: "error" };
    case "vencida": return { txt: `✗ Venció el ${aFecha(l.vence_en!)}. No puedes iniciar recorridos hasta subir la renovada.`, tono: "error" };
    case "por_verificar": return { txt: "⏳ Enviada: la empresa la está verificando.", tono: "info" };
    case "rechazada": return { txt: `La empresa la rechazó: ${l.motivo_rechazo ?? "revisa los datos"}. Súbela de nuevo.`, tono: "error" };
    default: return { txt: "Aún no subes tu licencia. Es obligatoria para transportar niños.", tono: "error" };
  }
}
