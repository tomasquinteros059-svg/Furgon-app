// Envío de notificaciones push mediante el servicio de Expo (FCM en Android, APNs en iOS).

import type { SupabaseClient } from "@supabase/supabase-js";
import { entorno } from "./entorno.ts";

/** Debe coincidir con los canales creados en la app (apps/movil/src/notificaciones.ts). */
export const CANAL_ALARMA = "aviso-furgon";
export const CANAL_GENERAL = "general";
export const SONIDO_ALARMA = "alarma.wav";

/** Categoría con botones "Confirmar" / "No puedo" (definida en la app). */
export const CATEGORIA_LLAMADA = "llamada-furgon";

interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string | null;
  channelId: string;
  priority: "default" | "normal" | "high";
  interruptionLevel?: "active" | "critical" | "passive" | "time-sensitive";
  ttl?: number;
  categoryId?: string;
  /** iOS: despierta la app en segundo plano para que acuse recibo. */
  _contentAvailable?: boolean;
}

type TicketExpo = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

export interface Notificacion {
  tipo: "aviso" | "entregado" | "ausente" | "llamada";
  titulo: string;
  cuerpo: string;
  data: Record<string, unknown>;
  avisoId?: string;
  recorridoAlumnoId?: string;
}

/** Envía la notificación a todos los dispositivos de los apoderados del alumno. */
export async function notificarApoderados(sb: SupabaseClient, alumnoId: string, n: Notificacion): Promise<number> {
  const { data: vinculos, error } = await sb
    .from("apoderado_alumno")
    .select("apoderado_id, perfiles!inner(dispositivos(id, expo_push_token))")
    .eq("alumno_id", alumnoId);
  if (error) throw error;

  const dispositivos = (vinculos ?? []).flatMap((v) => {
    const perfil = v.perfiles as unknown as { dispositivos: { id: string; expo_push_token: string }[] };
    return perfil?.dispositivos ?? [];
  });
  if (dispositivos.length === 0) return 0;

  return enviar(sb, dispositivos, n);
}

/**
 * Llamada gratis por internet: push de alta prioridad con categoría de llamada a los
 * teléfonos del contacto. Devuelve cuántos dispositivos la aceptaron (0 = no hay a quién).
 */
export async function enviarLlamadaApp(sb: SupabaseClient, contactoId: string, n: Notificacion): Promise<number> {
  const { data, error } = await sb.rpc("dispositivos_de_contacto", { p_contacto: contactoId });
  if (error) throw error;
  const dispositivos = (data ?? []) as { id: string; expo_push_token: string }[];
  if (dispositivos.length === 0) return 0;
  return enviar(sb, dispositivos, n);
}

async function enviar(sb: SupabaseClient, dispositivos: { id: string; expo_push_token: string }[], n: Notificacion): Promise<number> {
  const esAlarma = n.tipo === "aviso" || n.tipo === "llamada";
  const mensajes: MensajeExpo[] = dispositivos.map((d) => ({
    to: d.expo_push_token,
    title: n.titulo,
    body: n.cuerpo,
    data: { ...n.data, tipo: n.tipo },
    sound: esAlarma ? SONIDO_ALARMA : "default",
    channelId: esAlarma ? CANAL_ALARMA : CANAL_GENERAL,
    priority: "high",
    // iOS 15+: atraviesa el modo Concentración. "critical" requiere permiso especial de Apple.
    interruptionLevel: esAlarma ? "time-sensitive" : "active",
    // Un aviso de "llega en 5 min" no sirve de nada si llega 10 min tarde; una llamada, menos.
    ttl: n.tipo === "llamada" ? 30 : esAlarma ? 300 : 3600,
    ...(n.tipo === "llamada" ? { categoryId: CATEGORIA_LLAMADA, _contentAvailable: true } : {}),
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = entorno.expoAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(mensajes),
  });
  const cuerpo = await resp.json().catch(() => ({})) as { data?: TicketExpo[] };
  const tickets = cuerpo.data ?? [];

  const registros = dispositivos.map((d, i) => {
    const t = tickets[i];
    return {
      aviso_id: n.avisoId ?? null,
      recorrido_alumno_id: n.recorridoAlumnoId ?? null,
      dispositivo_id: d.id,
      tipo: n.tipo,
      ticket_id: t?.status === "ok" ? t.id : null,
      estado: t?.status ?? `http_${resp.status}`,
      error: t?.status === "error" ? t.message : null,
    };
  });
  await sb.from("envios_push").insert(registros);

  // Tokens que ya no existen (app desinstalada): se eliminan.
  const invalidos = dispositivos.filter((_, i) => {
    const t = tickets[i];
    return t?.status === "error" && t.details?.error === "DeviceNotRegistered";
  });
  if (invalidos.length) await sb.from("dispositivos").delete().in("id", invalidos.map((d) => d.id));

  return registros.filter((r) => r.estado === "ok").length;
}
