import { describe, expect, it } from "vitest";
import {
  type CanalLlamada,
  type ContactoLlamada,
  type IntentoLlamada,
  resultadoDesdeTwilio,
  siguienteLlamada,
  vencimientoLlamadaApp,
} from "../supabase/functions/_shared/core/llamadas.ts";

const principal: ContactoLlamada = { id: "mama", telefono: "+56911111111", prioridad: 1 };
const secundario: ContactoLlamada = { id: "papa", telefono: "+56922222222", prioridad: 2 };
const contactos = [secundario, principal]; // desordenados a propósito

const intento = (contactoId: string, resultado: IntentoLlamada["resultado"]): IntentoLlamada => ({ contactoId, resultado });

describe("escalera de llamadas", () => {
  it("primero llama al contacto principal, sin espera", () => {
    expect(siguienteLlamada({ contactos, intentos: [] })).toEqual({
      tipo: "llamar", contactoId: "mama", telefono: "+56911111111", intento: 1, esperaSeg: 0, canal: "telefono",
    });
  });

  it("si el principal no contesta, reintenta una vez al principal tras 30 s", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", "no_contesto")] })).toMatchObject({
      tipo: "llamar", contactoId: "mama", intento: 2, esperaSeg: 30,
    });
  });

  it("si el reintento tampoco contesta, llama al contacto secundario", () => {
    const intentos = [intento("mama", "no_contesto"), intento("mama", "ocupado")];
    expect(siguienteLlamada({ contactos, intentos })).toMatchObject({
      tipo: "llamar", contactoId: "papa", intento: 3, esperaSeg: 0,
    });
  });

  it("termina como agotado si el secundario tampoco contesta", () => {
    const intentos = [intento("mama", "no_contesto"), intento("mama", "no_contesto"), intento("papa", "no_contesto")];
    expect(siguienteLlamada({ contactos, intentos })).toEqual({ tipo: "fin", motivo: "agotado" });
  });

  it("una confirmación (presionar 1) termina la escalera en cualquier punto", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", "confirmada")] })).toEqual({ tipo: "fin", motivo: "confirmada" });
    const intentos = [intento("mama", "no_contesto"), intento("mama", "no_contesto"), intento("papa", "confirmada")];
    expect(siguienteLlamada({ contactos, intentos })).toEqual({ tipo: "fin", motivo: "confirmada" });
  });

  it("un buzón de voz (contestó pero no presionó 1) NO cuenta como contestada", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", "sin_confirmar")] })).toMatchObject({
      tipo: "llamar", contactoId: "mama", intento: 2,
    });
  });

  it("no reintenta un número que falló (inválido): pasa directo al secundario", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", "fallida")] })).toMatchObject({
      tipo: "llamar", contactoId: "papa", intento: 2, esperaSeg: 0,
    });
  });

  it("espera mientras haya una llamada en curso", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", null)] })).toEqual({ tipo: "esperar" });
  });

  it("se detiene si el alumno ya fue entregado o el recorrido terminó", () => {
    expect(siguienteLlamada({ contactos, intentos: [intento("mama", "no_contesto")], detener: true })).toEqual({
      tipo: "fin", motivo: "detenido",
    });
  });

  it("sin contactos válidos no llama", () => {
    expect(siguienteLlamada({ contactos: [], intentos: [] })).toEqual({ tipo: "fin", motivo: "sin_contactos" });
    expect(siguienteLlamada({ contactos: [{ ...principal, telefono: " " }], intentos: [] })).toEqual({
      tipo: "fin", motivo: "sin_contactos",
    });
  });

  it("con solo un contacto: dos intentos y fin", () => {
    const solo = [principal];
    expect(siguienteLlamada({ contactos: solo, intentos: [intento("mama", "no_contesto")] })).toMatchObject({ contactoId: "mama" });
    expect(
      siguienteLlamada({ contactos: solo, intentos: [intento("mama", "no_contesto"), intento("mama", "no_contesto")] }),
    ).toEqual({ tipo: "fin", motivo: "agotado" });
  });

  it("recorre la escalera completa simulando las respuestas de Twilio", () => {
    const intentos: IntentoLlamada[] = [];
    const llamados: string[] = [];
    for (let i = 0; i < 10; i++) {
      const paso = siguienteLlamada({ contactos, intentos });
      if (paso.tipo !== "llamar") break;
      llamados.push(`${paso.contactoId}+${paso.esperaSeg}s`);
      intentos.push(intento(paso.contactoId, resultadoDesdeTwilio("no-answer", false)));
    }
    expect(llamados).toEqual(["mama+0s", "mama+30s", "papa+0s"]);
  });
});

describe("primero gratis por la app, con costo solo si no hay internet", () => {
  const mamaConApp = { ...principal, tieneApp: true };
  const abueloSinApp = { ...secundario }; // no tiene la app: solo teléfono
  const conApp = [mamaConApp, abueloSinApp];
  const i = (contactoId: string, canal: CanalLlamada, resultado: IntentoLlamada["resultado"]): IntentoLlamada => ({ contactoId, canal, resultado });

  it("si el contacto tiene la app, la primera llamada es por la app (sin costo)", () => {
    expect(siguienteLlamada({ contactos: conApp, intentos: [] })).toMatchObject({ contactoId: "mama", canal: "app", intento: 1 });
  });

  it("si la llamada por la app no llega (sin internet), llama por teléfono al instante sin gastar el reintento", () => {
    const intentos = [i("mama", "app", "sin_internet")];
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({
      contactoId: "mama", canal: "telefono", intento: 2, esperaSeg: 0,
    });
    // la telefónica tampoco contesta: el reintento sigue por teléfono (ya sabemos que no tiene internet)
    intentos.push(i("mama", "telefono", "no_contesto"));
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({
      contactoId: "mama", canal: "telefono", intento: 3, esperaSeg: 30,
    });
    intentos.push(i("mama", "telefono", "no_contesto"));
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({ contactoId: "papa", canal: "telefono" });
  });

  it("si tiene internet pero no contesta por la app, reintenta por la app y luego pasa al secundario", () => {
    const intentos = [i("mama", "app", "no_contesto")];
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({ contactoId: "mama", canal: "app", esperaSeg: 30 });
    intentos.push(i("mama", "app", "no_contesto"));
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({ contactoId: "papa", canal: "telefono", esperaSeg: 0 });
  });

  it("confirmar en la llamada por la app termina la escalera sin ninguna llamada con costo", () => {
    const intentos = [i("mama", "app", "confirmada")];
    expect(siguienteLlamada({ contactos: conApp, intentos })).toEqual({ tipo: "fin", motivo: "confirmada" });
  });

  it("un error de la llamada por la app no marca el número como malo", () => {
    const intentos = [i("mama", "app", "fallida")];
    expect(siguienteLlamada({ contactos: conApp, intentos })).toMatchObject({ contactoId: "mama", esperaSeg: 30 });
  });

  it("recorre la escalera completa de una mamá sin internet", () => {
    const intentos: IntentoLlamada[] = [];
    const pasos: string[] = [];
    for (let n = 0; n < 10; n++) {
      const paso = siguienteLlamada({ contactos: conApp, intentos });
      if (paso.tipo !== "llamar") break;
      pasos.push(`${paso.contactoId}:${paso.canal}+${paso.esperaSeg}s`);
      intentos.push(i(paso.contactoId, paso.canal, paso.canal === "app" ? "sin_internet" : "no_contesto"));
    }
    expect(pasos).toEqual(["mama:app+0s", "mama:telefono+0s", "mama:telefono+30s", "papa:telefono+0s"]);
  });

  it("vencimiento de la llamada por la app: sin acuse en 15 s es sin internet; con acuse, 30 s de timbre", () => {
    expect(vencimientoLlamadaApp({ iniciadaEnMs: 0, acuseEnMs: null, ahoraMs: 14_000 })).toBeNull();
    expect(vencimientoLlamadaApp({ iniciadaEnMs: 0, acuseEnMs: null, ahoraMs: 15_000 })).toBe("sin_internet");
    expect(vencimientoLlamadaApp({ iniciadaEnMs: 0, acuseEnMs: 2_000, ahoraMs: 30_000 })).toBeNull();
    expect(vencimientoLlamadaApp({ iniciadaEnMs: 0, acuseEnMs: 2_000, ahoraMs: 45_000 })).toBe("no_contesto");
  });
});

describe("resultadoDesdeTwilio", () => {
  it("traduce los estados finales de Twilio", () => {
    expect(resultadoDesdeTwilio("completed", true)).toBe("confirmada");
    expect(resultadoDesdeTwilio("completed", false)).toBe("sin_confirmar");
    expect(resultadoDesdeTwilio("busy", false)).toBe("ocupado");
    expect(resultadoDesdeTwilio("no-answer", false)).toBe("no_contesto");
    expect(resultadoDesdeTwilio("failed", false)).toBe("fallida");
    expect(resultadoDesdeTwilio("canceled", false)).toBe("cancelada");
    expect(resultadoDesdeTwilio("ringing", false)).toBeNull();
  });
});
