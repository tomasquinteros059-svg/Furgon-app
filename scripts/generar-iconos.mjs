// Genera, desde diseno/iconos.ts (la única fuente de los íconos):
//  1) docs/iconos.html — la hoja del set de íconos;
//  2) el bloque de íconos de las maquetas HTML (entre /* ICONOS:inicio */ y /* ICONOS:fin */).
//
//   npm run iconos

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMOJI_A_ICONO, ICONOS, svgIcono } from "../diseno/iconos.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETAS = ["docs/perfil-tia-del-furgon.html", "docs/perfil-apoderados.html", "docs/demo-interactiva.html"];

// --- 1) Bloque para las maquetas: datos + funciones que cambian emojis por íconos al dibujar.
const bloque = `/* ICONOS:inicio — generado por scripts/generar-iconos.mjs desde diseno/iconos.ts; no editar a mano */
  const ICONOS = ${JSON.stringify(ICONOS)};
  const EMOJI_A_ICONO = ${JSON.stringify(EMOJI_A_ICONO)};
  const REGEX_EMOJI = new RegExp(Object.keys(EMOJI_A_ICONO).sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/\\uFE0F/g, "").replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + "\\uFE0F?").join("|"), "gu");
  const nombreIcono = (e) => EMOJI_A_ICONO[e] ?? EMOJI_A_ICONO[e.replace(/\\uFE0F/g, "")] ?? EMOJI_A_ICONO[e + "\\uFE0F"];
  // Ícono en línea: toma el color del texto; el acento es el amarillo escolar.
  function ico(nombre, clase = "ico") {
    const i = ICONOS[nombre]; if (!i) return "";
    return '<svg class="' + clase + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + i.replace(/fill="ACENTO"/g, 'style="fill:var(--ico-acento, #F5B700)"') + "</svg>";
  }
  // Ícono con colores fijos (para dibujos SVG y marcadores de mapa, donde no hay CSS).
  function icoPlano(nombre, color, acento, tam = 24, x = 0, y = 0) {
    const i = ICONOS[nombre]; if (!i) return "";
    return '<svg x="' + x + '" y="' + y + '" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + i.replace(/ACENTO/g, acento).replace(/currentColor/g, color) + "</svg>";
  }
  // Cambia los emojis del texto (no de las etiquetas ni de sus atributos) por los íconos propios.
  function iconizar(html) {
    return html.split(/(<[^>]*>)/).map((parte) => parte.startsWith("<") ? parte
      : parte.replace(REGEX_EMOJI, (e) => { const n = nombreIcono(e); return n ? ico(n) : e; })).join("");
  }
  /* ICONOS:fin */`;

for (const archivo of MAQUETAS) {
  const ruta = join(RAIZ, archivo);
  const html = readFileSync(ruta, "utf8");
  // Función de reemplazo: así los «$&» del bloque no se interpretan como patrones.
  const nuevo = html.replace(/\/\* ICONOS:inicio[\s\S]*\/\* ICONOS:fin \*\//, () => bloque.trim());
  if (nuevo === html && !html.includes("ICONOS:inicio")) { console.warn(`  ⚠ ${archivo}: sin marcador ICONOS`); continue; }
  writeFileSync(ruta, nuevo);
  console.log(`✓ ${archivo}`);
}

// --- 2) Hoja del set de íconos.
const GRUPOS = [
  ["Transporte y recorrido", ["furgon", "auto", "brujula", "mapa", "ruta", "pin", "gps", "meta"]],
  ["Lugares y tramos", ["casa", "colegio", "ida"]],
  ["Personas", ["persona", "personas", "familia", "alumno", "subio", "conductora", "admin", "conexion"]],
  ["Estados", ["check", "confirmado", "error", "cerrar", "alerta", "pendiente", "prohibido", "candado", "calendario", "historial", "reloj"]],
  ["Avisos y comunicación", ["campana", "telefono", "celular", "llamada_app", "mensaje", "voz", "parlante", "senal", "sin_senal"]],
  ["Administración y documentos", ["licencia", "tarjeta", "camara", "galeria", "lapiz", "chispa", "celebrar", "pulgar", "menu", "estacionado", "play", "pausa"]],
];
const faltan = Object.keys(ICONOS).filter((n) => !GRUPOS.some(([, l]) => l.includes(n)));
if (faltan.length) throw new Error(`Íconos sin grupo en la hoja: ${faltan.join(", ")}`);
const reemplaza = (n) => Object.entries(EMOJI_A_ICONO).filter(([, v]) => v === n).map(([e]) => e).filter((e, i, a) => a.indexOf(e) === i && !a.includes(`${e}️`));
const NOMBRES = {
  furgon: "Furgón escolar", auto: "Waze / auto", brujula: "Navegar", mapa: "Mapa", ruta: "Ruta", pin: "Ubicación", gps: "GPS", meta: "Fin del recorrido",
  casa: "Hogar · vuelta", colegio: "Colegio", ida: "Ida · mañana", persona: "Persona", personas: "Familias", familia: "Familia compartida",
  alumno: "Alumno", subio: "Ya subió", conductora: "Tía o tío", admin: "Administración", conexion: "Conexión",
  check: "Hecho", confirmado: "Confirmado", error: "No", cerrar: "Cerrar", alerta: "Atención", pendiente: "Por verificar", prohibido: "Ausente",
  candado: "Privacidad", calendario: "Hoy no va", historial: "Historial", reloj: "Hora",
  campana: "Aviso", telefono: "Llamada con costo", celular: "Celular", llamada_app: "Llamada gratis", mensaje: "Solicitudes", voz: "Mensaje de voz",
  parlante: "Alarma sonora", senal: "Con señal", sin_senal: "Sin señal",
  licencia: "Licencia", tarjeta: "Cobros", camara: "Cámara", galeria: "Galería", lapiz: "Editar", chispa: "Recomendar", celebrar: "Todo al día", pulgar: "Bien", menu: "Menú", estacionado: "Detenida en la casa", play: "Iniciar", pausa: "Pausar",
};
const tile = (n) => `<figure class="ico-tile"><div class="muestra">${svgIcono(n, { tam: 40, acento: "var(--acento)" })}</div>
  <figcaption><b>${NOMBRES[n] ?? n}</b><code>${n}</code><span class="antes" title="Emoji que reemplaza">${reemplaza(n).join(" ") || "nuevo"}</span></figcaption></figure>`;
const muestra = (n, t) => svgIcono(n, { tam: t, acento: "var(--acento)" });

const hoja = `<title>Íconos Furgón Escolar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Hoja técnica del set: grilla de fichas por familia de uso, con la medida real de 24 px como referencia. */
:root {
  --bg: #E7EBEF; --surface: #FFFFFF; --surface-2: #EEF1F4; --ink: #15202B; --muted: #5A6573; --line: #D3D9E0;
  --acento: #F5B700; --acento-suave: #FFF4CC; --navy: #16324F; --navy-ink: #FFFFFF; --ok: #1D7F45;
  --font-display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif;
  --font-body: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #090D11; --surface: #17212A; --surface-2: #1E2933; --ink: #E7ECF1; --muted: #95A2B0; --line: #2B3743;
  --acento: #F7C21A; --acento-suave: #3A3010; --navy: #8DB8E6; --navy-ink: #0B1622; --ok: #4DC47F; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #090D11; --surface: #17212A; --surface-2: #1E2933; --ink: #E7ECF1; --muted: #95A2B0; --line: #2B3743;
  --acento: #F7C21A; --acento-suave: #3A3010; --navy: #8DB8E6; --navy-ink: #0B1622; --ok: #4DC47F; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 15px; line-height: 1.5; padding: 32px 20px 56px; }
main { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 36px; }
h1, h2 { font-family: var(--font-display); font-weight: 700; letter-spacing: .01em; text-wrap: balance; margin: 0; }
h1 { font-size: clamp(34px, 6vw, 54px); line-height: 1; }
h2 { font-size: 24px; }
p { margin: 0; max-width: 64ch; }
.cab { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 22px; align-items: center; }
.cab .grande { color: var(--ink); background: var(--acento-suave); border-radius: 22px; padding: 14px; line-height: 0; }
.bajada { color: var(--muted); margin-top: 8px; }
.reglas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.regla { font-family: var(--font-mono); font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; color: var(--muted); background: var(--surface); }
section { display: flex; flex-direction: column; gap: 14px; }
.grupo-cab { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid var(--ink); padding-bottom: 6px; }
.grupo-cab span { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.ico-tile { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.muestra { height: 64px; display: grid; place-items: center; border-radius: 8px; color: var(--ink);
  background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 10px 10px; background-position: center; background-color: var(--surface-2); }
figcaption { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 8px; font-size: 13px; }
figcaption b { grid-column: 1; }
figcaption code { grid-column: 1; font-family: var(--font-mono); font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
.antes { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-size: 16px; opacity: .55; text-decoration: line-through; text-decoration-thickness: 1px; }
.uso { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tamanos { display: flex; align-items: flex-end; gap: 18px; color: var(--ink); }
.tamanos figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
.chip { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); }
.chip.ok { color: var(--ok); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: inherit; font-weight: 700; min-height: 46px; padding: 8px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.btn.navy { background: var(--navy); color: var(--navy-ink); border-color: transparent; }
.btn.navy svg { --acento: rgba(255, 255, 255, .35); }
.parada { border: 2px solid var(--acento); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.parada .num { font-family: var(--font-display); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-size: 13px; }
.parada b { font-size: 19px; }
.nota { color: var(--muted); font-size: 13px; }
</style>
<main>
  <header class="cab">
    <div class="grande">${muestra("furgon", 96)}</div>
    <div>
      <h1>Íconos Furgón Escolar</h1>
      <p class="bajada">El set propio que reemplaza a los emojis genéricos en la app de la tía, la de las familias y el panel de administración. Cada ícono indica a la derecha, tachado, el emoji que reemplaza.</p>
      <div class="reglas"><span class="regla">grilla 24 × 24</span><span class="regla">trazo 2 px redondeado</span><span class="regla">color del texto</span><span class="regla">un acento: amarillo escolar</span><span class="regla">${Object.keys(ICONOS).length} íconos</span></div>
    </div>
  </header>
  ${GRUPOS.map(([titulo, lista]) => `<section aria-label="${titulo}"><div class="grupo-cab"><h2>${titulo}</h2><span>${lista.length}</span></div><div class="grilla">${lista.map(tile).join("")}</div></section>`).join("\n  ")}
  <section aria-label="En uso"><div class="grupo-cab"><h2>En uso</h2><span>tamaños y contextos reales</span></div>
    <div class="uso">
      <div class="panel"><b>Tamaños</b>
        <div class="tamanos">${[16, 20, 24, 32, 48].map((t) => `<figure>${muestra("campana", t)}<figcaption>${t}</figcaption></figure>`).join("")}</div>
        <p class="nota">16 px en chips y textos, 20 px en botones, 24 px en pestañas y títulos.</p></div>
      <div class="panel"><div class="parada"><span class="num">Parada 1 · llegada en ~4 min</span><b>Sofía Pérez</b>
        <div class="fila"><span class="chip ok">${muestra("subio", 16)} Su familia confirmó que subió</span><span class="chip">${muestra("campana", 16)} Avisado 16:34</span></div>
        <div class="fila"><span class="btn">${muestra("brujula", 20)} Google Maps</span><span class="btn">${muestra("auto", 20)} Waze</span></div>
        <div class="fila"><span class="btn navy">${muestra("casa", 20)} En su hogar</span></div></div></div>
      <div class="panel"><b>Familia</b>
        <div class="fila"><span class="btn">${muestra("familia", 20)} Entrar con código de familia</span></div>
        <div class="fila"><span class="chip">${muestra("candado", 16)} Protege tu cuenta</span><span class="chip">${muestra("calendario", 16)} Hoy no va</span><span class="chip">${muestra("licencia", 16)} Licencia vence en 24 días</span></div>
        <p class="nota">Las notificaciones del teléfono no admiten íconos propios: ahí el texto va sin emojis y se reconoce por el ícono de la app.</p></div>
    </div>
  </section>
</main>
`;
writeFileSync(join(RAIZ, "docs", "iconos.html"), hoja);
console.log(`✓ docs/iconos.html (${Object.keys(ICONOS).length} íconos)`);
