import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AlmacenColaEnMemoria, type PosicionGps, vaciarCola } from "../supabase/functions/_shared/core/cola.ts";
import { mensajeAviso } from "../supabase/functions/_shared/core/mensajes.ts";
import { formatearTelefono, normalizarTelefono } from "../supabase/functions/_shared/core/telefono.ts";
import { firmaTwilio, twimlAviso, validarFirmaTwilio } from "../supabase/functions/_shared/core/twilio.ts";

describe("normalizarTelefono", () => {
  it.each([
    ["+56 9 1234 5678", "+56912345678"],
    ["56912345678", "+56912345678"],
    ["912345678", "+56912345678"],
    ["9-1234-5678", "+56912345678"],
    ["(2) 2345 6789", "+56223456789"],
    ["0056912345678", "+56912345678"],
    ["+1 415 555 0100", "+14155550100"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it.each(["", "abc", "1234", "+56 9 1234 567"])("rechaza %j", (entrada) => {
    expect(normalizarTelefono(entrada)).toBeNull();
  });

  it("formatea para mostrar", () => {
    expect(formatearTelefono("+56912345678")).toBe("+56 9 1234 5678");
  });
});

describe("Twilio", () => {
  const params = { CallSid: "CA123", Digits: "1", From: "+56900000000", To: "+56912345678" };
  const url = "https://ejemplo.supabase.co/functions/v1/twilio-webhook?accion=confirmar&llamada=abc";

  it("calcula la firma igual que la especificación de Twilio (HMAC-SHA1)", async () => {
    const datos = url + Object.keys(params).sort().map((k) => k + params[k as keyof typeof params]).join("");
    const esperada = createHmac("sha1", "token-secreto").update(datos).digest("base64");
    expect(await firmaTwilio("token-secreto", url, params)).toBe(esperada);
  });

  it("valida firmas correctas y rechaza las alteradas", async () => {
    const firma = await firmaTwilio("token-secreto", url, params);
    expect(await validarFirmaTwilio("token-secreto", firma, url, params)).toBe(true);
    expect(await validarFirmaTwilio("token-secreto", firma, url, { ...params, Digits: "2" })).toBe(false);
    expect(await validarFirmaTwilio("otro-token", firma, url, params)).toBe(false);
    expect(await validarFirmaTwilio("token-secreto", null, url, params)).toBe(false);
  });

  it("genera TwiML en español con confirmación y escapa el contenido", () => {
    const xml = twimlAviso("El furgón llegará con Tomás & Ana <3", "https://x/conf?a=1&b=2");
    expect(xml).toContain('language="es-MX"');
    expect(xml).toContain("Tomás &amp; Ana &lt;3");
    expect(xml).toContain('action="https://x/conf?a=1&amp;b=2"');
    expect(xml).toContain('numDigits="1"');
  });
});

describe("mensajes", () => {
  it("adapta el texto a ida y vuelta", () => {
    expect(mensajeAviso({ tipo: "vuelta", nombreAlumno: "Sofía", etaSeg: 300, motivo: "eta" }).cuerpo).toBe(
      "El furgón llegará en aproximadamente 5 minutos con Sofía. Por favor, que alguien esté esperando en casa.",
    );
    expect(mensajeAviso({ tipo: "ida", nombreAlumno: "Sofía", etaSeg: 240, motivo: "eta" }).cuerpo).toContain(
      "4 minutos a buscar a Sofía",
    );
    expect(mensajeAviso({ tipo: "ida", nombreAlumno: "Sofía", etaSeg: 30, motivo: "proximidad" }).cuerpo).toContain(
      "está por llegar",
    );
  });
});

describe("cola de posiciones sin señal", () => {
  const pos = (i: number, recorridoId = "r1"): PosicionGps => ({
    clientId: `c${i}`, recorridoId, registradaEnMs: i * 1000, lat: -33, lng: -70, precisionM: 5, velocidadMs: 8, rumbo: 0,
  });

  it("conserva las posiciones si no hay señal y las reenvía en orden al recuperarla", async () => {
    const cola = new AlmacenColaEnMemoria();
    await cola.agregar([pos(1), pos(2), pos(3)]);
    const recibidas: string[] = [];
    let haySenal = false;
    const enviar = (_r: string, lote: PosicionGps[]) => {
      if (!haySenal) return Promise.resolve({ ok: false as const, reintentable: true, error: "sin red" });
      recibidas.push(...lote.map((p) => p.clientId));
      return Promise.resolve({ ok: true as const });
    };

    expect(await vaciarCola(cola, enviar)).toMatchObject({ enviadas: 0, pendientes: 3, error: "sin red" });
    await cola.agregar([pos(4)]);
    haySenal = true;
    expect(await vaciarCola(cola, enviar, 2)).toEqual({ enviadas: 4, pendientes: 0 });
    expect(recibidas).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("descarta lotes con error no reintentable (recorrido ya finalizado) y sigue con el resto", async () => {
    const cola = new AlmacenColaEnMemoria();
    await cola.agregar([pos(1, "viejo"), pos(2, "nuevo")]);
    const r = await vaciarCola(cola, (recorridoId) =>
      Promise.resolve(recorridoId === "viejo" ? { ok: false, reintentable: false, error: "finalizado" } : { ok: true }));
    expect(r).toEqual({ enviadas: 1, pendientes: 0 });
  });

  it("no duplica posiciones ya encoladas", async () => {
    const cola = new AlmacenColaEnMemoria();
    await cola.agregar([pos(1)]);
    await cola.agregar([pos(1)]);
    expect(await cola.contar()).toBe(1);
  });
});
