// Documentos del furgón y de quien conduce (ver supabase/migrations/20261024000001_rostro_y_documentos.sql).
import { t } from "./idioma";

export type EstadoDoc = "sin_documento" | "por_verificar" | "rechazado" | "vigente" | "por_vencer" | "vencido";

export interface Documento {
  tipo: string; de: "furgon" | "conductor"; obligatorio: boolean; vence: boolean; orden: number;
  conductor_id: string | null; conductor: string | null; furgon_id: string | null; patente: string | null;
  documento_id: string | null; archivo: string | null; vence_en: string | null; dias_restantes: number | null;
  estado: EstadoDoc; motivo_rechazo: string | null;
}

/** Nombre y una línea de ayuda de cada documento (en el idioma de la app). */
export function infoDocumento(tipo: string): { nombre: string; ayuda: string } {
  switch (tipo) {
    case "padron": return { nombre: t("Padrón del furgón"), ayuda: t("Certificado de inscripción del vehículo (Registro Civil).") };
    case "permiso_circulacion": return { nombre: t("Permiso de circulación"), ayuda: t("El del año en curso, pagado en tu municipalidad.") };
    case "revision_tecnica": return { nombre: t("Revisión técnica"), ayuda: t("Certificado vigente de la planta de revisión técnica.") };
    case "soap": return { nombre: t("SOAP"), ayuda: t("Seguro obligatorio de accidentes personales, vigente.") };
    case "registro_escolar": return { nombre: t("Registro de transporte escolar"), ayuda: t("Inscripción del furgón en el Registro Nacional de Transporte Escolar (MTT).") };
    case "seguro_pasajeros": return { nombre: t("Seguro de pasajeros"), ayuda: t("Opcional: seguro de accidentes para los niños que llevas.") };
    case "antecedentes": return { nombre: t("Certificado de antecedentes"), ayuda: t("Del Registro Civil, para fines especiales.") };
    case "inhabilidades": return { nombre: t("Inhabilidades para trabajar con menores"), ayuda: t("Certificado del Registro Civil que confirma que puedes trabajar con niños.") };
    default: return { nombre: tipo, ayuda: "" };
  }
}

/** Estado en palabras y su tono. */
export function textoDocumento(d: Documento): { txt: string; tono: "exito" | "error" | "info" } {
  const fecha = d.vence_en ? d.vence_en.split("-").reverse().join("-") : "";
  switch (d.estado) {
    case "vigente": return { txt: d.vence_en ? t("✓ Al día · vence el {fecha}", { fecha }) : t("✓ Al día"), tono: "exito" };
    case "por_vencer": return { txt: d.dias_restantes === 1 ? t("⚠ Vence mañana ({fecha})", { fecha }) : t("⚠ Vence en {dias} días ({fecha})", { dias: d.dias_restantes, fecha }), tono: "error" };
    case "vencido": return { txt: t("✗ Venció el {fecha}", { fecha }), tono: "error" };
    case "por_verificar": return { txt: t("⏳ Enviado: la empresa lo está revisando"), tono: "info" };
    case "rechazado": return { txt: t("Rechazado: {motivo}", { motivo: d.motivo_rechazo ?? "" }), tono: "error" };
    default: return { txt: d.obligatorio ? t("Falta subirlo") : t("Opcional · no subido"), tono: d.obligatorio ? "error" : "info" };
  }
}

/** Documentos obligatorios que faltan, vencen pronto, vencieron o fueron rechazados. */
export const documentosConProblema = (docs: Documento[]) =>
  docs.filter((d) => d.obligatorio && ["sin_documento", "rechazado", "vencido", "por_vencer"].includes(d.estado));
