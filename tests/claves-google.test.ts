// Antes de activar «Continuar con Google» se revisa la forma de las claves (sin mostrarlas).
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sin tipos
import { problemaClavesGoogle } from "../scripts/claves-google.mjs";

const ID = "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com";
const SECRETO = "GOCSPX-AbCdEf_123-xyz";

describe("claves de Google", () => {
  it("acepta un ID y un secreto bien copiados", () => {
    expect(problemaClavesGoogle(ID, SECRETO)).toBeNull();
  });
  it("detecta las claves al revés, incompletas o con espacios", () => {
    expect(problemaClavesGoogle(SECRETO, ID)).toMatch(/al revés/);
    expect(problemaClavesGoogle(ID, ID)).toMatch(/al revés/);
    expect(problemaClavesGoogle("123456789012-abc", SECRETO)).toMatch(/apps\.googleusercontent\.com/);
    expect(problemaClavesGoogle("tu-furgon", SECRETO)).toMatch(/ID de cliente/);
    expect(problemaClavesGoogle(`${ID} x`, SECRETO)).toMatch(/espacios/);
    expect(problemaClavesGoogle(ID, "abc")).toMatch(/GOCSPX-/);
  });
});
