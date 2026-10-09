// Cada mensaje de error de la base de datos (raise exception en las migraciones) tiene traducción al inglés.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EN_ERRORES, EN_ERRORES_PATRONES } from "../idiomas/en/errores.ts";
import { traducirConPatrones } from "../idiomas/index.ts";

const carpeta = join(__dirname, "..", "supabase", "migrations");
const mensajes = new Set<string>();
for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith(".sql"))) {
  const sql = readFileSync(join(carpeta, archivo), "utf8");
  for (const m of sql.matchAll(/raise\s+exception\s+'((?:[^']|'')*)'/gi)) mensajes.add(m[1].replace(/''/g, "'"));
}
const exactos = [...mensajes].filter((m) => !m.includes("%"));
const conDatos = [...mensajes].filter((m) => m.includes("%"));

describe("errores de la base de datos en inglés", () => {
  it("encuentra mensajes en las migraciones", () => {
    expect(exactos.length).toBeGreaterThan(0);
  });
  it("cada mensaje sin datos variables está en EN_ERRORES", () => {
    expect(exactos.filter((m) => !(m in EN_ERRORES))).toEqual([]);
  });
  it("cada mensaje con datos variables calza con un patrón", () => {
    const ejemplos = conDatos.map((m) => m.replace(/%/g, "05-03-2027"));
    expect(ejemplos.filter((m) => traducirConPatrones(m, EN_ERRORES_PATRONES) === null)).toEqual([]);
  });
  it("traduce la licencia vencida con su fecha", () => {
    expect(
      traducirConPatrones(
        "Tu licencia de conducir venció el 05-03-2027. Sube la renovada en «Mi licencia» para iniciar recorridos.",
        EN_ERRORES_PATRONES,
      ),
    ).toBe("Your driver's license expired on 05-03-2027. Upload the renewed one in “My license” to start trips.");
    expect(traducirConPatrones("Otro texto", EN_ERRORES_PATRONES)).toBeNull();
  });
  it("cada patrón traduce al menos un mensaje", () => {
    for (const [re] of EN_ERRORES_PATRONES) {
      expect(conDatos.some((m) => re.test(m.replace(/%/g, "05-03-2027")))).toBe(true);
    }
  });
});
