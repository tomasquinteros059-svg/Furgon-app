// Las dos apps quedan completas en inglés: cada t("…") tiene traducción con las mismas
// variables, y no quedan textos en español sin t() en las pantallas (scripts/revisar-idiomas.mjs).
import { describe, expect, it } from "vitest";
import { crearTraductor, idiomaDeLocale, interpolar } from "../idiomas/index.ts";
import { revisar } from "../scripts/revisar-idiomas.mjs";
import { EN_COMUN } from "../idiomas/en/comun.ts";
import { EN_ERRORES } from "../idiomas/en/errores.ts";
import { EN_MOVIL_CONDUCTOR } from "../idiomas/en/movil-conductor.ts";
import { EN_MOVIL_FAMILIAS } from "../idiomas/en/movil-familias.ts";

describe("idiomas", () => {
  it("traduce con variables y vuelve al español si falta una traducción", () => {
    let i: "es" | "en" = "en";
    const t = crearTraductor({ en: { "Hola, {nombre}": "Hi, {nombre}" } }, () => i);
    expect(t("Hola, {nombre}", { nombre: "Ana" })).toBe("Hi, Ana");
    expect(t("Sin traducir")).toBe("Sin traducir");
    i = "es";
    expect(t("Hola, {nombre}", { nombre: "Ana" })).toBe("Hola, Ana");
    expect(interpolar("{a} y {b}", { a: 1 })).toBe("1 y {b}");
    expect([idiomaDeLocale("en-GB"), idiomaDeLocale("es-CL"), idiomaDeLocale("pt-BR"), idiomaDeLocale(undefined)]).toEqual(["en", "es", "es", "es"]);
  });

  it("un mismo texto no tiene dos traducciones distintas en la app (el último diccionario taparía al otro)", () => {
    const vistos = new Map<string, string>();
    const choques: string[] = [];
    for (const d of [EN_COMUN, EN_ERRORES, EN_MOVIL_FAMILIAS, EN_MOVIL_CONDUCTOR]) {
      for (const [k, v] of Object.entries(d)) {
        if (vistos.has(k) && vistos.get(k) !== v) choques.push(`${k}: «${vistos.get(k)}» / «${v}»`);
        vistos.set(k, v);
      }
    }
    expect(choques).toEqual([]);
  });

  for (const r of revisar()) {
    it(`${r.nombre}: todos los textos están traducidos al inglés`, () => {
      expect(r.faltan.map((x) => `${x.archivo}: ${x.texto}`)).toEqual([]);
      expect(r.variables.map((x) => `${x.archivo}: ${x.texto}`)).toEqual([]);
    });
    it(`${r.nombre}: no quedan textos en español sin t()`, () => {
      expect(r.sueltos.map((x) => `${x.archivo}: ${x.texto}`)).toEqual([]);
    });
  }
});
