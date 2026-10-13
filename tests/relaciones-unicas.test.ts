// Relaciones «uno a uno» de Supabase: si la clave foránea es única, PostgREST entrega la relación
// embebida como objeto o null, no como lista. Tratarla como lista cerró la app al iniciar una ruta
// (`p.avisos.length` sobre null). Cada archivo que embebe avisos desde recorrido_alumnos debe
// pasarlos por comoLista().
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "apps", "movil", "src");
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.tsx?$/.test(f) ? [ruta] : [];
  });

describe("relaciones únicas embebidas", () => {
  it("los avisos de una parada siempre se normalizan con comoLista()", () => {
    const sinNormalizar = archivos(RAIZ).filter((ruta) => {
      const src = readFileSync(ruta, "utf8");
      return /from\("recorrido_alumnos"\)[\s\S]{0,400}avisos\(/.test(src) && !src.includes("comoLista(");
    });
    expect(sinNormalizar).toEqual([]);
  });
});
