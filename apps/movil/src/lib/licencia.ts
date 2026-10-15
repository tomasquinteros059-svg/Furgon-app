// Situación de la licencia de conducir de la tía (rpc estado_licencias), en palabras.
import { t } from "./idioma";

export interface EstadoLic {
  estado: "sin_licencia" | "por_verificar" | "rechazada" | "vigente" | "por_vencer" | "vencida";
  numero: string | null; clase: string | null; vence_en: string | null; dias_restantes: number | null; motivo_rechazo: string | null;
  foto_rostro?: string | null; rostro_resultado?: string | null; rostro_similitud?: number | null;
}

/** Resultado de comparar la cara con la foto de la licencia, en palabras (null si no aplica). */
export function textoRostro(l: EstadoLic | null): string | null {
  if (!l?.rostro_resultado) return null;
  const pct = l.rostro_similitud != null ? ` (${Math.round(l.rostro_similitud)} %)` : "";
  switch (l.rostro_resultado) {
    case "coincide": return t("✓ Tu cara coincide con la foto de la licencia") + pct;
    case "dudoso": return t("La comparación no fue clara: la empresa revisará las fotos") + pct;
    case "no_coincide": return t("Tu cara no coincide con la foto de la licencia. Sube una foto más nítida.") + pct;
    case "sin_rostro": return t("No se ve bien una cara en las fotos. Toma la selfie de frente y con buena luz.");
    case "pendiente": return t("Comparando tu cara con la licencia…");
    default: return t("La empresa comparará tu cara con la licencia.");
  }
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
