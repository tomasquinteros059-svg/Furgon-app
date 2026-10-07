import { describe, expect, it } from "vitest";
import {
  type ContactoLlamada,
  type IntentoLlamada,
  resultadoDesdeTwilio,
  siguienteLlamada,
} from "../supabase/functions/_shared/core/llamadas.ts";

const principal: ContactoLlamada = { id: "mama", telefono: "+56911111111", prioridad: 1 };
const secundario: ContactoLlamada = { id: "papa", telefono: "+56922222222", prioridad: 2 };
const contactos = [secundario, principal]; // desordenados a propósito

const intento = (contactoId: string, resultado: IntentoLlamada["resultado"]): IntentoLlamada => ({ contactoId, resultado });

describe("escalera de llamadas", () => {
  it("primero llama al contacto principal, sin espera", () => {
    expect(siguienteLlamada({ contactos, intentos: [] })).toEqual({
      tipo: "llamar", contactoId: "mama", telefono: "+56911111111", intento: 1, esperaSeg: 0,
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
