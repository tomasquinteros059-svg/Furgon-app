import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const fallos = new Set(); let medidos = 0;
for (const esquema of ["light", "dark"]) {
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: esquema, reducedMotion: "reduce" })).newPage();
  await page.goto("file:///home/user/Furgon-app/docs/rediseno/Furgon_Escolar.html"); await page.waitForTimeout(300);
  const medir = async (nombre) => {
    const r = await page.evaluate(() => {
      const rgb = (c) => { const m = c.replace("srgb","").match(/[\d.]+/g).map(Number); const k = c.startsWith("color(") ? 255 : 1; return { r: m[0]*k, g: m[1]*k, b: m[2]*k, a: c.includes("/") ? m[3] : (c.startsWith("rgba") ? m[3] : 1) }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const fondo = (el) => { let capas = []; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0) { capas.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255 }; for (const c of capas.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
      const out = []; let n = 0;
      for (const el of document.querySelectorAll("#mesa *")) {
        if (!el.offsetParent || ![...el.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) continue;
        if (el.closest(".solo-lector,svg,dialog:not([open])")) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
        if (el.closest("button:disabled")) continue;   // deshabilitado: exento en WCAG
        const c = rgb(cs.color), f = fondo(el); const L1 = lum(c), L2 = lum(f);
        const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        const px = parseFloat(cs.fontSize), w = +cs.fontWeight; const grande = px >= 24 || (px >= 18.66 && w >= 700);
        n++; if (ratio < (grande ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} «${el.textContent.trim().slice(0, 30)}» ${cs.color} sobre rgb(${f.r|0},${f.g|0},${f.b|0})`);
      }
      return { n, out };
    });
    medidos += r.n; r.out.forEach((x) => fallos.add(`[${esquema}] ${nombre}: ${x}`));
  };
  const ir = (rol, v) => page.evaluate(([rol, v]) => { S.rol = rol; S.vista[rol] = v; pintar(); }, [rol, v]);
  for (const v of ["inicio", "rutas", "alumnos", "mensajes", "mas", "cobros", "licencia", "conexiones", "perfil"]) { await ir("tia", v); await medir("tía/" + v); }
  await page.evaluate(() => { S.rutaSel = "manana"; S.vista.tia = "ruta"; pintar(); }); await medir("tía/ruta");
  await page.evaluate(() => { iniciar("manana"); S.recorrido.progreso = .12; pintar(); }); await page.waitForTimeout(600); await medir("tía/recorrido");
  await page.evaluate(() => { S.rol = "familia"; S.vista.familia = "inicio"; pintar(); }); await page.waitForTimeout(400); await medir("familia/inicio con alarma");
  for (const v of ["seguir", "pagos", "mensajes", "mas", "codigo", "furgon", "perfil"]) { await ir("familia", v); await medir("familia/" + v); }
  await page.evaluate(() => avisar("Prueba de aviso", () => {})); await medir("toast");
  await page.evaluate(() => { S.vista.familia = "inicio"; S.dlg = { tipo: "minutos", id: "sofia" }; pintar(); }); await page.waitForTimeout(300); await medir("diálogo minutos");
}
await b.close();
console.log("Textos medidos:", medidos); console.log(fallos.size ? [...fallos].join("\n") : "Todos pasan WCAG AA");
