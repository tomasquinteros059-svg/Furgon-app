// Aviso por WhatsApp: elige Meta o Twilio según las claves y arma el pedido con la plantilla.
import { describe, expect, it } from "vitest";
import { leerRespuestaWhatsapp, pedidoWhatsapp, proveedorWhatsapp, textoParaPlantilla } from "../supabase/functions/_shared/core/whatsapp.ts";

const env = (vars: Record<string, string>) => (n: string) => vars[n];

describe("aviso por WhatsApp", () => {
  it("sin claves no hay WhatsApp; Meta tiene prioridad sobre Twilio", () => {
    expect(proveedorWhatsapp(env({}))).toBeNull();
    expect(proveedorWhatsapp(env({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x" }))).toBeNull(); // Twilio solo para llamadas
    expect(proveedorWhatsapp(env({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_WHATSAPP_ORIGEN: "+14155238886" })))
      .toMatchObject({ tipo: "twilio", origen: "whatsapp:+14155238886" });
    expect(proveedorWhatsapp(env({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "123", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_WHATSAPP_ORIGEN: "+1" })))
      .toEqual({ tipo: "meta", token: "t", numeroId: "123", plantilla: "aviso_furgon" });
  });

  it("Meta: plantilla en el idioma de la familia, número sin «+» y el texto como variable", () => {
    const p = proveedorWhatsapp(env({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "123" }))!;
    const r = pedidoWhatsapp(p, "+56912345678", "El furgón llegará en 5 minutos.\nPor favor, que esté listo.", "es");
    expect(r.url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(r.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(r.body)).toEqual({
      messaging_product: "whatsapp", to: "56912345678", type: "template",
      template: { name: "aviso_furgon", language: { code: "es" },
        components: [{ type: "body", parameters: [{ type: "text", text: "El furgón llegará en 5 minutos. Por favor, que esté listo." }] }] },
    });
    expect(JSON.parse(pedidoWhatsapp(p, "+56912345678", "Hi", "en").body).template.language.code).toBe("en");
  });

  it("Twilio: con plantilla usa ContentSid; sin ella (sandbox) manda el texto", () => {
    const base = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_WHATSAPP_ORIGEN: "whatsapp:+14155238886" };
    const conPlantilla = new URLSearchParams(pedidoWhatsapp(proveedorWhatsapp(env({ ...base, TWILIO_WHATSAPP_CONTENT_SID: "HX9" }))!, "+56912345678", "Llega", "es").body);
    expect(Object.fromEntries(conPlantilla)).toEqual({ From: "whatsapp:+14155238886", To: "whatsapp:+56912345678", ContentSid: "HX9", ContentVariables: '{"1":"Llega"}' });
    const sandbox = pedidoWhatsapp(proveedorWhatsapp(env(base))!, "+56912345678", "Llega", "es");
    expect(sandbox.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(new URLSearchParams(sandbox.body).get("Body")).toBe("Llega");
  });

  it("limpia el texto y lee la respuesta de cada proveedor", () => {
    expect(textoParaPlantilla("  a\n\tb     c ")).toBe("a b c");
    const meta = proveedorWhatsapp(env({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1" }))!;
    expect(leerRespuestaWhatsapp(meta, true, { messages: [{ id: "wamid.1" }] })).toEqual({ id: "wamid.1", error: null });
    expect(leerRespuestaWhatsapp(meta, false, { error: { code: 132001, message: "Template name does not exist" } }))
      .toEqual({ id: null, error: "132001 Template name does not exist" });
  });
});
