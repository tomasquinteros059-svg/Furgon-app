// Aviso por WhatsApp (sin SDK): arma el pedido para la API de WhatsApp de Meta (Cloud API) o para
// Twilio. WhatsApp solo deja escribir primero con una PLANTILLA aprobada; la nuestra tiene una sola
// variable ({{1}}) con el texto del aviso, el mismo de la notificación.

import type { Idioma } from "./mensajes.ts";

export type ProveedorWhatsapp =
  | { tipo: "meta"; token: string; numeroId: string; plantilla: string }
  | { tipo: "twilio"; sid: string; token: string; origen: string; contentSid?: string };

/** Elige el proveedor según las variables que existan; null si WhatsApp no está configurado. */
export function proveedorWhatsapp(env: (nombre: string) => string | undefined): ProveedorWhatsapp | null {
  const token = env("WHATSAPP_TOKEN"), numeroId = env("WHATSAPP_PHONE_ID");
  if (token && numeroId) return { tipo: "meta", token, numeroId, plantilla: env("WHATSAPP_PLANTILLA") ?? "aviso_furgon" };
  const sid = env("TWILIO_ACCOUNT_SID"), tw = env("TWILIO_AUTH_TOKEN"), origen = env("TWILIO_WHATSAPP_ORIGEN");
  if (sid && tw && origen) return { tipo: "twilio", sid, token: tw, origen: aWhatsappTwilio(origen), contentSid: env("TWILIO_WHATSAPP_CONTENT_SID") };
  return null;
}

const aWhatsappTwilio = (tel: string) => (tel.startsWith("whatsapp:") ? tel : `whatsapp:${tel.startsWith("+") ? tel : `+${tel}`}`);

/** WhatsApp no acepta saltos de línea, tabulaciones ni más de 4 espacios seguidos dentro de una variable. */
export function textoParaPlantilla(texto: string): string {
  return texto.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 1000);
}

/** Pedido HTTP listo para enviar con fetch. */
export interface PedidoWhatsapp { url: string; headers: Record<string, string>; body: string }

export function pedidoWhatsapp(p: ProveedorWhatsapp, telefonoE164: string, texto: string, idioma: Idioma): PedidoWhatsapp {
  const variable = textoParaPlantilla(texto);
  if (p.tipo === "meta") {
    return {
      url: `https://graph.facebook.com/v21.0/${encodeURIComponent(p.numeroId)}/messages`,
      headers: { Authorization: `Bearer ${p.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefonoE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: p.plantilla,
          language: { code: idioma === "en" ? "en" : "es" },
          components: [{ type: "body", parameters: [{ type: "text", text: variable }] }],
        },
      }),
    };
  }
  const form = new URLSearchParams({ From: p.origen, To: aWhatsappTwilio(telefonoE164) });
  // Con plantilla aprobada (Content SID) se puede escribir primero; sin ella solo sirve para el
  // sandbox de pruebas de Twilio.
  if (p.contentSid) {
    form.set("ContentSid", p.contentSid);
    form.set("ContentVariables", JSON.stringify({ 1: variable }));
  } else {
    form.set("Body", variable);
  }
  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(p.sid)}/Messages.json`,
    headers: { Authorization: `Basic ${btoa(`${p.sid}:${p.token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  };
}

/** Lee la respuesta de Meta o Twilio: el id del mensaje o el error en palabras. */
export function leerRespuestaWhatsapp(p: ProveedorWhatsapp, ok: boolean, datos: unknown): { id: string | null; error: string | null } {
  const d = (datos ?? {}) as { messages?: { id?: string }[]; error?: { message?: string; code?: number }; sid?: string; message?: string; code?: number };
  if (p.tipo === "meta") {
    const id = d.messages?.[0]?.id ?? null;
    return ok && id ? { id, error: null } : { id: null, error: `${d.error?.code ?? ""} ${d.error?.message ?? "respuesta inválida"}`.trim() };
  }
  return ok && d.sid ? { id: d.sid, error: null } : { id: null, error: `${d.code ?? ""} ${d.message ?? "respuesta inválida"}`.trim() };
}
