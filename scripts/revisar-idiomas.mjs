// Revisa las traducciones: textos t("…") sin traducción al inglés, variables {x} que no
// coinciden y textos en español que quedaron sin t() en las pantallas.
//
//   npm run idiomas            → resumen
//   npm run idiomas -- --todo  → lista completa
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { EN_ADMIN } from "../idiomas/en/admin.ts";
import { EN_MOVIL } from "../idiomas/en/movil.ts";
import { variablesDe } from "../idiomas/index.ts";

const RAIZ = join(import.meta.dirname, "..");
const archivos = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
});

/** Textos de las llamadas t("…") o t(`…`) (sin ${} dentro). */
export function clavesDe(codigo) {
  const claves = [];
  for (const m of codigo.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g)) {
    claves.push(JSON.parse(`"${(m[1] ?? m[2]).replace(/"/g, '\\"').replace(/\\`/g, "`")}"`));
  }
  return claves;
}

/** Textos en español fuera de t(): JSX y literales con letras propias del español. */
export function sinTraducir(codigo) {
  // Una línea con el comentario «i18n-ignorar» (o la anterior) queda fuera: nombres propios, datos.
  const lineas = codigo.split("\n");
  const ignorar = new Set(lineas.flatMap((l, i) => (/i18n-ignorar/.test(l) ? [i, i + 1] : [])));
  const limpio = codigo.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
  const hallazgos = [];
  limpio.forEach((linea, i) => {
    if (ignorar.has(i)) return;
    if (/^\s*import |console\.(warn|error|log)|throw new Error\(|errcode|\.rpc\(|\.from\(|\.select\(|\.eq\(/.test(linea)) return;
    const sinT = linea.replace(/\bt\(\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, "t(");
    const jsx = [...sinT.matchAll(/>([^<>{}]*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}[^<>{}]*)</g)].map((m) => m[1].trim()).filter((x) => x && !/^[\w.]+$/.test(x) || /[áéíóúñ¿¡]/i.test(x));
    const literales = [...sinT.matchAll(/"([^"]*[áéíóúñ¿¡][^"]*)"|`([^`]*[áéíóúñ¿¡][^`]*)`|'([^']*[áéíóúñ¿¡][^']*)'/gi)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const x of [...jsx, ...literales]) hallazgos.push({ linea: i + 1, texto: x.slice(0, 80) });
  });
  return hallazgos;
}

export function revisar() {
  const grupos = [
    { nombre: "app móvil", dir: join(RAIZ, "apps/movil/src"), dic: EN_MOVIL },
    { nombre: "panel web", dir: join(RAIZ, "apps/admin/src"), dic: EN_ADMIN, excluir: /datos\/demo\.ts$/ },
  ];
  return grupos.map((g) => {
    const faltan = [], variables = [], sueltos = [];
    let total = 0;
    for (const f of archivos(g.dir)) {
      if (g.excluir?.test(f)) continue;
      const codigo = readFileSync(f, "utf8");
      const rel = relative(RAIZ, f);
      for (const k of clavesDe(codigo)) {
        total++;
        if (!(k in g.dic)) faltan.push({ archivo: rel, texto: k });
        else if (variablesDe(k).join() !== variablesDe(g.dic[k]).join()) variables.push({ archivo: rel, texto: k });
      }
      for (const h of sinTraducir(codigo)) sueltos.push({ archivo: `${rel}:${h.linea}`, texto: h.texto });
    }
    return { ...g, total, faltan, variables, sueltos };
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const todo = process.argv.includes("--todo");
  for (const r of revisar()) {
    console.log(`\n${r.nombre}: ${r.total} textos con t() · ${r.faltan.length} sin traducción · ${r.variables.length} con variables distintas · ${r.sueltos.length} posibles textos sin t()`);
    const mostrar = (titulo, xs) => { if (xs.length) { console.log(`  ${titulo}:`); for (const x of todo ? xs : xs.slice(0, 15)) console.log(`   - ${x.archivo}: ${x.texto}`); } };
    mostrar("Sin traducción", r.faltan);
    mostrar("Variables distintas", r.variables);
    mostrar("Posibles textos sin t()", r.sueltos);
  }
}
