// Junta en un solo HTML las tres partes de Furgón Escolar para revisarlas sin instalar nada:
// la app de la tía, la app de las familias y el panel web (demostraciones con datos de ejemplo).
//
//   npm run app-completa   →  docs/furgon-escolar-app.html
//
// Cada parte va dentro de su propio marco (srcdoc), así sus estilos y su código no se mezclan.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const srcdoc = (html) => html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const icono = readFileSync(join(RAIZ, "apps/movil/assets/favicon.png")).toString("base64");

const PARTES = [
  { id: "tia", nombre: "App de la tía", en: "Driver app", archivo: "docs/perfil-tia-del-furgon.html" },
  { id: "familias", nombre: "App de familias", en: "Family app", archivo: "docs/perfil-apoderados.html" },
  { id: "panel", nombre: "Panel web", en: "Web panel", archivo: "docs/app-administracion.html" },
];

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Furgón Escolar</title>
<link rel="icon" href="data:image/png;base64,${icono}">
<style>
  :root { --fondo: #F3F4F6; --barra: #FFFFFF; --borde: #E3E5E8; --texto: #14181F; --suave: #5F6672; --amarillo: #F5B700; --sobre: #1F1A00; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fondo: #0B0E12; --barra: #161A21; --borde: #2A313B; --texto: #F3F4F6; --suave: #9AA3AE; --amarillo: #F7C21A; --sobre: #1A1500; color-scheme: dark; } }
  :root[data-theme="dark"] { --fondo: #0B0E12; --barra: #161A21; --borde: #2A313B; --texto: #F3F4F6; --suave: #9AA3AE; --amarillo: #F7C21A; --sobre: #1A1500; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; background: var(--fondo); color: var(--texto); font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 16px; background: var(--barra); border-bottom: 1px solid var(--borde); }
  .marca { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 17px; margin-right: auto; }
  .marca img { width: 28px; height: 28px; border-radius: 7px; }
  nav { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--fondo); border: 1px solid var(--borde); flex-wrap: wrap; }
  nav button { border: 0; background: transparent; color: var(--suave); font: 700 14px system-ui, sans-serif; padding: 8px 14px; border-radius: 9px; cursor: pointer; }
  nav button[aria-selected="true"] { background: var(--amarillo); color: var(--sobre); }
  nav button:focus-visible { outline: 2px solid var(--amarillo); outline-offset: 2px; }
  .nota { width: 100%; margin: 0; color: var(--suave); font-size: 13px; }
  main { flex: 1; min-height: 0; position: relative; }
  iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--fondo); }
  iframe[hidden] { display: none; }
  @media (max-width: 600px) { .nota { display: none; } header { padding: 8px 12px; gap: 8px; } nav button { padding: 7px 10px; font-size: 13px; } }
</style>
</head>
<body>
<header>
  <div class="marca"><img src="data:image/png;base64,${icono}" alt="">Furgón Escolar</div>
  <nav role="tablist" aria-label="Partes de la app">
    ${PARTES.map((p, i) => `<button role="tab" id="t-${p.id}" aria-selected="${i === 0}" aria-controls="m-${p.id}" data-id="${p.id}">${p.nombre}</button>`).join("\n    ")}
  </nav>
  <p class="nota">Demostración con datos de ejemplo. En la app de la tía y en la de familias, el idioma (Español / English) y el tema se cambian en «Perfil»; en el panel, abajo a la izquierda.</p>
</header>
<main>
  ${PARTES.map((p, i) => `<iframe id="m-${p.id}" title="${p.nombre}" ${i === 0 ? "" : "hidden"} data-src="${srcdoc(leer(p.archivo))}"></iframe>`).join("\n  ")}
</main>
<script>
  // Cada parte se carga recién la primera vez que se abre (así la demostración de una no corre por detrás).
  const marcos = [...document.querySelectorAll("iframe")];
  const abrir = (id) => {
    for (const m of marcos) {
      const activo = m.id === "m-" + id;
      m.hidden = !activo;
      if (activo && !m.srcdoc) m.srcdoc = m.dataset.src;
    }
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    try { localStorage.setItem("furgon-parte", id); } catch {}
  };
  document.querySelector("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) abrir(b.dataset.id); });
  let inicial = "tia";
  try { inicial = localStorage.getItem("furgon-parte") || "tia"; } catch {}
  abrir(marcos.some((m) => m.id === "m-" + inicial) ? inicial : "tia");
</script>
</body>
</html>
`;
writeFileSync(join(RAIZ, "docs/furgon-escolar-app.html"), html);
console.log(`✓ docs/furgon-escolar-app.html (${Math.round(html.length / 1024)} KB)`);
