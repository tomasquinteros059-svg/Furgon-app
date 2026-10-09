// Alarmas, notificaciones, llamadas por voz y avisos de licencia en el idioma de cada persona.
import { describe, expect, it } from "vitest";
import { idiomaValido, mensajeAviso, mensajeEstadoParada, mensajeVencimientoLicencia } from "../supabase/functions/_shared/core/mensajes.ts";
import { twimlAviso, twimlRespuestaConfirmacion, VOZ_INGLES } from "../supabase/functions/_shared/core/twilio.ts";

describe("mensajes por idioma", () => {
  it("el aviso de llegada sale en inglés para quien eligió English, y en español por defecto", () => {
    const en = mensajeAviso({ tipo: "ida", nombreAlumno: "Sofía", etaSeg: 300, motivo: "eta", idioma: "en" });
    expect(en.titulo).toBe("School van on its way to pick up Sofía");
    expect(en.cuerpo).toContain("will arrive in about 5 minutes");
    const es = mensajeAviso({ tipo: "vuelta", nombreAlumno: "Sofía", etaSeg: 60, motivo: "eta" });
    expect(es.titulo).toBe("Sofía llega pronto a casa");
    expect(es.cuerpo).toContain("está por llegar");
    expect(mensajeAviso({ tipo: "vuelta", nombreAlumno: "Tomás", etaSeg: 60, motivo: "eta", idioma: "en" }).cuerpo).toContain("is about to arrive");
  });

  it("estado de la parada y licencia en inglés", () => {
    expect(mensajeEstadoParada({ tipo: "vuelta", nombreAlumno: "Sofía", estado: "entregado", hora: "16:42", idioma: "en" }).titulo).toBe("Sofía is home");
    expect(mensajeVencimientoLicencia({ nombre: "Marcela Fuentes", dias: 1, venceEn: "2026-10-10", idioma: "en" }).titulo).toBe("Your license expires in 1 day");
    expect(mensajeVencimientoLicencia({ nombre: "Marcela Fuentes", dias: -2, venceEn: "2026-10-07" }).titulo).toBe("Tu licencia venció");
  });

  it("la llamada telefónica usa voz e instrucciones en inglés", () => {
    const xml = twimlAviso("The van is about to arrive.", "https://x/confirmar", VOZ_INGLES);
    expect(xml).toContain('language="en-US"');
    expect(xml).toContain("press 1");
    expect(twimlRespuestaConfirmacion(true, VOZ_INGLES)).toContain("Message confirmed");
    expect(twimlRespuestaConfirmacion(true)).toContain("Aviso confirmado");
  });

  it("un idioma desconocido o vacío se trata como español", () => {
    expect([idiomaValido("en"), idiomaValido("fr"), idiomaValido(null)]).toEqual(["en", "es", "es"]);
  });
});
