import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMOJI_A_ICONO, ICONOS, iconoDeEmoji, REGEX_EMOJI, svgIcono } from "../diseno/iconos.ts";

const RAIZ = join(__dirname, "..");
const archivos = (dir: string, ext: RegExp): string[] => readdirSync(dir).flatMap((f) => {
  const r = join(dir, f);
  return statSync(r).isDirectory() ? archivos(r, ext) : ext.test(f) ? [r] : [];
});
// Emojis y pictogramas que una interfaz podría mostrar.
const PICTOGRAMA = /[\u{1F17F}\u{1F300}-\u{1FAFF}☀-➿⏳⏸▶]️?(‍[\u{1F300}-\u{1FAFF}☀-➿]️?)*/gu;

describe("íconos propios", () => {
  it("cada emoji apunta a un ícono que existe", () => {
    for (const [e, n] of Object.entries(EMOJI_A_ICONO)) expect(ICONOS, `${e} → ${n}`).toHaveProperty(n);
  });

  it("cada ícono es un SVG bien formado de 24×24 con un solo color de acento", () => {
    for (const n of Object.keys(ICONOS) as (keyof typeof ICONOS)[]) {
      const svg = svgIcono(n, { color: "#111111", acento: "#F5B700" });
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 24 24"[^>]*>.*<\/svg>$/s);
      expect(svg).not.toContain("ACENTO");
      // Etiquetas equilibradas (cada etiqueta que se abre se cierra o es autocerrada).
      const abiertas = (svg.match(/<(svg|g)\b[^>]*[^/]>/g) ?? []).length;
      expect(abiertas, n).toBe((svg.match(/<\/(svg|g)>/g) ?? []).length);
      const colores = new Set((svg.match(/(fill|stroke)="(#[0-9A-Fa-f]{6})"/g) ?? []).map((x) => x.split('"')[1].toUpperCase()));
      for (const c of colores) expect(["#111111", "#F5B700"], `${n}: ${c}`).toContain(c);
    }
  });

  it("encuentra emojis compuestos completos y con o sin selector de variación", () => {
    const texto = "👨‍👩‍👧 Familia · ⚠️ alerta · ⚠ sin selector · 🗺 mapa · 🧑‍✈️ tía";
    const hallados = [...texto.matchAll(REGEX_EMOJI)].map((m) => iconoDeEmoji(m[0]));
    expect(hallados).toEqual(["familia", "alerta", "alerta", "mapa", "conductora"]);
  });

  it("ninguna pantalla de las apps muestra un emoji sin su ícono propio", () => {
    const fuentes = [...archivos(join(RAIZ, "apps/movil/src"), /\.tsx?$/), ...archivos(join(RAIZ, "apps/admin/src"), /\.tsx?$/)];
    const sinIcono: string[] = [];
    for (const f of fuentes) {
      for (const m of readFileSync(f, "utf8").matchAll(PICTOGRAMA)) {
        if (!iconoDeEmoji(m[0])) sinIcono.push(`${f.replace(RAIZ, "")}: ${m[0]}`);
      }
    }
    expect(sinIcono).toEqual([]);
  });

  it("las notificaciones del teléfono van sin emojis (no admiten íconos propios)", () => {
    const servidor = archivos(join(RAIZ, "supabase/functions"), /\.ts$/).map((f) => readFileSync(f, "utf8")).join("\n");
    const titulos = servidor.match(/titulo: [`"][^`"]*[`"]/g) ?? [];
    expect(titulos.length).toBeGreaterThan(5);
    for (const t of titulos) expect(t).not.toMatch(PICTOGRAMA);
  });
});
