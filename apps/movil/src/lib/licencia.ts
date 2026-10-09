// Situación de la licencia de conducir de la tía (rpc estado_licencias), en palabras.
import { t } from "./idioma";

export interface EstadoLic {
  estado: "sin_licencia" | "por_verificar" | "rechazada" | "vigente" | "por_vencer" | "vencida";
  numero: string | null; clase: string | null; vence_en: string | null; dias_restantes: number | null; motivo_rechazo: string | null;
}
/** aaaa-mm-dd → dd-mm-aaaa */
export const aFecha = (iso: string) => iso.split("-").reverse().join("-");

export function textoLicencia(l: EstadoLic | null): { txt: string; tono: "exito" | "error" | "info" } {
  if (!l) return { txt: "…", tono: "info" };
  switch (l.estado) {
    case "vigente": return { txt: t("✓ Vigente hasta el {fecha}", { fecha: aFecha(l.vence_en!) }), tono: "exito" };
    case "por_vencer": return { txt: l.dias_restantes === 1
      ? t("⚠ Vence en 1 día ({fecha}). Sube la renovada apenas la tengas.", { fecha: aFecha(l.vence_en!) })
      : t("⚠ Vence en {dias} días ({fecha}). Sube la renovada apenas la tengas.", { dias: l.dias_restantes, fecha: aFecha(l.vence_en!) }), tono: "error" };
    case "vencida": return { txt: t("✗ Venció el {fecha}. No puedes iniciar recorridos hasta subir la renovada.", { fecha: aFecha(l.vence_en!) }), tono: "error" };
    case "por_verificar": return { txt: t("⏳ Enviada: la empresa la está verificando."), tono: "info" };
    case "rechazada": return { txt: t("La empresa la rechazó: {motivo}. Súbela de nuevo.", { motivo: l.motivo_rechazo ?? t("revisa los datos") }), tono: "error" };
    default: return { txt: t("Aún no subes tu licencia. Es obligatoria para transportar niños."), tono: "error" };
  }
}
