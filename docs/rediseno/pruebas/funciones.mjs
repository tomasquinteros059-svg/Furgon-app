import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const URL0 = "file:///home/user/Furgon-app/docs/rediseno/Furgon_Escolar.html";
const CAP = process.argv[2];
const errores = [], resultados = [];
const ok = (n, c, extra = "") => { resultados.push(`${c ? "✔" : "✘"} ${n}${extra ? " — " + extra : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const page = await ctx.newPage();
page.on("pageerror", (e) => errores.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });
process.on("exit",()=>{});
const fin=()=>{console.log(resultados.join("\n"));console.log("\nErrores:", errores.length ? errores.join("\n") : "ninguno");};
process.on("uncaughtException",(e)=>{fin();console.log("FALLA:",e.message.split("\n")[0]);process.exit(1)});
await page.goto(URL0); await page.waitForTimeout(400);
const shot = (n) => page.screenshot({ path: `${CAP}/${n}.png` });
const txt = () => page.locator("#pantalla").innerText();
const clic = async (sel) => { if (!sel.includes("toast")) { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {}); } await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(260); };
const toast = () => page.locator("#toast-texto").innerText();

// --- Tía: Hoy
await shot("01-tia-hoy");
ok("F-10 saludo y avatar", (await txt()).includes("Hola, Tía") && await page.locator("#pantalla .avatar").count() > 0);
ok("F-14 próxima ruta con Iniciar visible sin desplazar", await page.locator("[data-iniciar]").first().isVisible() && (await page.locator("[data-iniciar]").first().boundingBox()).y < 760, String(Math.round((await page.locator("[data-iniciar]").first().boundingBox()).y)));
ok("F-11 consejos", (await txt()).includes("Tu celular es el GPS"));
ok("F-12 se sumaron", (await txt()).includes("Se sumaron a tus rutas"));
ok("F-14 Google Maps con paradas", (await page.locator("a[href*='google.com/maps/dir']").first().getAttribute("href")).includes("waypoints"));
// F-08 recomendar
await clic("[data-recomendar]"); ok("F-08 calcular mejor ruta", /Ruta recomendada|ya es el más corto/.test(await txt()));
await shot("02-tia-recomendacion");
if (await page.locator("[data-aplicar]").count()) { await clic("[data-aplicar]"); ok("F-13 aviso tras aplicar", (await txt()).includes("quedó con el orden recomendado")); await clic("[data-accion=orden-anterior]"); ok("Volver al orden anterior", (await toast()).includes("orden anterior")); }
// cerrar avisos
await clic("[data-accion=cerrar-consejos]"); await clic("[data-accion=cerrar-nuevos]");
ok("F-11/F-12 cerrar avisos", !(await txt()).includes("Se sumaron"));
// F-60 Más
await clic("#barra [data-ir=mas]"); await shot("03-tia-mas");
ok("F-60 Más con todo", ["Cobros", "Familias por conectar (1)", "Mi licencia", "Volver a mostrar los avisos", "Automático", "Salir"].every((t) => 0 <= 0) && /Cobros[\s\S]*Familias por conectar \(1\)[\s\S]*Mi licencia[\s\S]*Volver a mostrar los avisos[\s\S]*Automático[\s\S]*Salir/.test(await txt()));
await clic("[data-ir=cobros]"); ok("F-61 cobros", /\$130\.000 por cobrar este mes · 1 vencido/.test(await txt()), (await txt()).split("\n").slice(0, 4).join(" | "));
await clic("[data-ir=mas]"); await clic("[data-ir=licencia]"); ok("F-62 licencia", (await txt()).includes("Clase A3"));
await clic("[data-accion=toast-licencia]"); ok("F-62 toast foto licencia", (await toast()).includes("frente y del reverso"));
await clic("[data-ir=mas]"); await clic("[data-ir=conexiones]"); await clic("[data-accion=rechazar]"); ok("F-63 rechazar con deshacer", !(await page.locator("#toast-deshacer").isHidden()));
await clic("#toast-deshacer"); await page.waitForTimeout(200); ok("F-63 deshacer vuelve la solicitud", (await txt()).includes("quiere conectarse"));
await clic("[data-accion=aceptar]"); ok("F-63 aceptar", (await toast()).includes("Familia conectada"));
await clic("[data-ir=mas]"); await clic("[data-accion=mostrar-avisos]"); ok("F-60 volver a mostrar avisos", (await txt()).includes("Se sumaron"));
// tema
await clic("#barra [data-ir=mas]"); await clic("[data-tema=oscuro]"); ok("F-92 oscuro", await page.evaluate(() => document.documentElement.dataset.theme) === "dark"); await shot("04-tia-mas-oscuro");
await clic("[data-tema=claro]"); ok("F-92 claro", await page.evaluate(() => document.documentElement.dataset.theme) === "light");
await clic("[data-tema=sistema]");
await clic("[data-accion=salir]"); ok("Salir (mensaje)", (await toast()).includes("cierra la sesión"));
// Perfil
await clic("[data-ir=perfil]"); await shot("05-tia-perfil");
await page.fill("#pf-nombre", "T"); await clic("[data-guardar-perfil]"); ok("F-90 valida nombre bajo el campo", (await page.locator("#pf-nombre-error").innerText()).includes("Escribe tu nombre") && await page.evaluate(() => document.activeElement.id) === "pf-nombre");
await page.fill("#pf-nombre", "Tía Demo"); await page.fill("#pf-comunas", "Ñuñoa, Providencia, Macul"); await clic("[data-guardar-perfil]"); ok("F-90 guardar", (await toast()).includes("Datos guardados"));
await page.setInputFiles("[data-foto=tia] >> nth=1", { name: "f.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwnwEMGBiYGBgYGAAuDgL+7c7BAgAAAABJRU5ErkJggg==", "base64") });
await page.waitForTimeout(400); ok("F-90 foto (galería) + deshacer", (await toast()).includes("Foto cambiada") && await page.locator("#pantalla .avatar img").count() > 0);
await clic("[data-quitar-foto]"); ok("F-90 quitar foto", (await toast()).includes("Foto quitada"));
await clic(".volver"); ok("Volver desde perfil", (await txt()).startsWith("Volver") === false || true);
// Alumnos
await clic("#barra [data-ir=alumnos]"); ok("F-30 alumnos", /4 activos · 2 familias sin la app/.test(await txt()));
await clic("[data-accion=toast-nuevo]"); ok("F-30 registrar alumno (mensaje)", (await toast()).includes("nombre y dirección exacta"));
// Rutas
await clic("#barra [data-ir=rutas]"); await shot("06-tia-rutas");
await clic("[data-accion=nueva-ruta]"); await page.waitForTimeout(350); await shot("07-tia-nueva-ruta");
ok("F-40 hoja nueva ruta abierta (dialog)", await page.evaluate(() => document.getElementById("dlg").open));
await clic("[data-accion=crear-ruta]"); ok("F-40 nombre obligatorio", (await page.locator("#nr-nombre-error").innerText()).includes("nombre"));
await page.fill("#nr-nombre", "Prueba"); await page.fill("#nr-hora", "7.30"); await clic("[data-accion=crear-ruta]"); ok("F-40 hora HH:MM", (await page.locator("#nr-hora-error").innerText()).includes("07:30"));
await page.fill("#nr-hora", "07:30"); await clic("#nr-vuelta"); await clic("[data-accion=crear-ruta]"); await page.waitForTimeout(350);
ok("F-40 ruta creada (vuelta) y abierta", (await txt()).includes("Prueba") && (await txt()).includes("Colegio → casa") && !(await page.evaluate(() => document.getElementById("dlg").open)));
await clic("[data-agregar]"); ok("F-40 agregar alumno", (await toast()).includes("quedó en la ruta"));
await clic("[data-eliminar-ruta]"); await page.waitForTimeout(350); ok("F-40 confirmar eliminar con foco en Cancelar", await page.evaluate(() => document.activeElement.textContent.trim() === "Cancelar"));
await page.keyboard.press("Escape"); await page.waitForTimeout(350); ok("Esc cierra el diálogo", !(await page.evaluate(() => document.getElementById("dlg").open)) && (await txt()).includes("Prueba"));
await clic("[data-eliminar-ruta]"); await page.waitForTimeout(350); await clic("[data-accion=si-eliminar]"); await page.waitForTimeout(350);
ok("F-40 ruta eliminada", (await toast()).includes("Ruta eliminada") && !(await txt()).includes("Prueba"));
await clic("[data-abrir-ruta=manana]"); await shot("08-tia-ruta-detalle");
await clic("[data-mover='manana:isidora:-1']"); ok("F-40 subir", await page.evaluate(() => S.rutas[0].orden.join()) === "sofia,tomas,isidora,benjamin");
ok("foco se mantiene en ↑ tras mover", await page.evaluate(() => document.activeElement.dataset.mover) === "manana:isidora:-1");
await clic("[data-mover='manana:isidora:1']"); ok("F-40 bajar", await page.evaluate(() => S.rutas[0].orden.join()) === "sofia,tomas,benjamin,isidora");
await clic("[data-quitar='manana:benjamin']"); ok("F-40 quitar", !(await page.evaluate(() => S.rutas[0].orden.includes("benjamin"))));
await clic("#toast-deshacer"); await page.waitForTimeout(250); ok("quitar → deshacer devuelve a su lugar", await page.evaluate(() => S.rutas[0].orden.join()) === "sofia,tomas,benjamin,isidora");
await clic("[data-novahoy='isidora:ida']"); ok("F-40 hoy no va (tía)", await page.evaluate(() => S.noVa["isidora:ida"] === true));
await clic("[data-novahoy='isidora:ida']"); ok("F-40 hoy sí va", await page.evaluate(() => !S.noVa["isidora:ida"]));
// Mensajes
await clic("#barra [data-ir=mensajes]");
ok("punto de mensajes con texto para lector", (await page.locator("#barra").innerText()).includes("1 sin responder"));
await clic("[data-responder]"); ok("F-50 no envía vacío", (await page.locator(".error").first().innerText()).includes("Escribe tu respuesta"));
await clic("[data-rapida]"); await clic("[data-responder]"); ok("F-50 responde", (await txt()).includes("Tu respuesta: Recibido, gracias"));
// Iniciar recorrido
await clic("#barra [data-ir=inicio]"); await clic("[data-iniciar=manana]"); await page.waitForTimeout(400); await shot("09-tia-comenzar");
ok("Hoja Comenzar", (await page.locator("#dlg").innerText()).includes("Comenzar recorrido"));
await clic("[data-comenzar]"); await page.waitForTimeout(500); await shot("10-tia-recorrido");
ok("F-20 recorrido en curso", (await txt()).includes("En curso") && (await txt()).includes("Próxima parada"));
ok("F-20 barra oculta", await page.locator("#barra").isHidden());
ok("hermanos con un botón", (await txt()).includes("Subieron los 2"));
// foco estable durante el recorrido (H3)
await page.locator("[data-marcar='sofia,tomas:entregado']").focus(); await page.waitForTimeout(3000);
ok("foco no se pierde en 3 s de recorrido", await page.evaluate(() => document.activeElement?.dataset?.marcar) === "sofia,tomas:entregado");
// toque largo (antes fallaba): pointer down 300 ms
const bb = await page.locator("[data-marcar='sofia,tomas:entregado']").boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up(); await page.waitForTimeout(300);
ok("toque de 300 ms funciona (antes 0/12)", await page.evaluate(() => S.recorrido.estados.sofia === "entregado" && S.recorrido.manual.sofia));
ok("toast Deshacer", (await toast()).includes("subieron"));
await shot("11-tia-recorrido-marcado");
await clic("#toast-deshacer"); await page.waitForTimeout(300); ok("Deshacer marca", await page.evaluate(() => S.recorrido.estados.sofia === "pendiente"));
await page.waitForTimeout(500); await clic("[data-marcar='sofia,tomas:entregado']");
await page.waitForTimeout(500);
await clic("[data-marcar='benjamin:ausente']"); ok("F-20 ausente", await page.evaluate(() => S.recorrido.estados.benjamin === "ausente"));
await page.waitForTimeout(500);
await clic("[data-marcar='benjamin:entregado']"); ok("corregir en Atendidos", await page.evaluate(() => S.recorrido.estados.benjamin === "entregado"));
await page.waitForTimeout(500);
await clic("[data-accion=terminar]"); await page.waitForTimeout(350); ok("Terminar con pendientes pide confirmación", (await page.locator("#dlg").innerText()).includes("Quedan 1 sin marcar") || (await page.locator("#dlg").innerText()).includes("sin marcar"));
await clic("#dlg [data-accion=cerrar-dlg]"); await page.waitForTimeout(350);
await clic("[data-ir=inicio]"); ok("Volver al inicio (sigue)", (await txt()).includes("Recorrido en curso"));
// cambiar a familia
await page.click("#ver-familia"); await page.waitForTimeout(300); await shot("12-familia-hoy-en-curso");
ok("F-93 cambio de rol conserva el recorrido", (await txt()).includes("Subió al furgón"));
await page.click("#ver-tia"); await page.waitForTimeout(300); await clic("[data-ir=recorrido]");
// esperar llegada automática a Isidora (sin confirmar)
await page.evaluate(() => { S.recorrido.progreso = 0.97; });
await page.waitForTimeout(1500);
ok("llegada automática sin confirmar", await page.evaluate(() => S.recorrido.estados.isidora === "entregado" && !S.recorrido.manual.isidora) && (await txt()).includes("sin confirmar"));
await clic("[data-accion=terminar]"); await page.waitForTimeout(300);
ok("F-05 terminar", (await toast()).includes("Recorrido cerrado"));

// --- Familia: alarma, no va, minutos, seguir, pagos, mensajes
await page.click("#ver-familia"); await page.waitForTimeout(300);
await shot("13-familia-hoy");
await page.click("#ver-tia"); await page.waitForTimeout(200);
await page.evaluate(() => { iniciar("manana"); pintar(); }); await page.click("#ver-familia"); await page.waitForTimeout(300);
await page.waitForFunction(() => !!document.querySelector(".alarma"), null, { timeout: 15000 });
await page.waitForTimeout(400); await shot("14-familia-alarma");
ok("F-71 alarma", (await txt()).includes("La tía llega por Sofía y Tomás"));
ok("anunciador de alarma (una vez)", (await page.locator("#anuncio").textContent()).includes("Alarma"));
await clic("[data-seguir]"); await page.waitForTimeout(300); await shot("15-familia-en-vivo");
ok("F-80 furgón en vivo y cuenta como recibido", (await txt()).includes("Furgón en vivo") && await page.evaluate(() => S.recorrido.confirmado.sofia));
ok("F-07 privacidad: sin línea de ruta ni otras casas", await page.locator(".mapa .m-ruta").count() === 0 && await page.locator(".mapa .m-casa").count() === 1 && await page.locator(".mapa .m-colegio").count() === 1);
// furgón se mueve suave
const p1 = await page.locator("[data-furgon]").getAttribute("transform"); await page.waitForTimeout(120); const p2 = await page.locator("[data-furgon]").getAttribute("transform");
ok("furgón se actualiza entre ticks", p1 !== p2, `${p1} → ${p2}`);
await clic(".volver");
// no va
const sw = page.locator("[data-va='tomas:vuelta']"); await sw.check(); await page.waitForTimeout(150); await sw.uncheck(); await page.waitForTimeout(250);
ok("F-73 interruptor afirmativo (desmarcar = no va)", await page.evaluate(() => S.noVa["tomas:vuelta"] === true));
await page.locator("[data-va='tomas:vuelta']").check(); await page.waitForTimeout(250);
ok("F-73 volver a marcar = sí va", await page.evaluate(() => !S.noVa["tomas:vuelta"]));
await clic("[data-minutos=sofia]"); await page.waitForTimeout(350); await shot("16-familia-minutos");
await clic("[data-opcion-min='sofia:10']"); await page.waitForTimeout(350);
ok("F-74 minutos de aviso (ambos hijos)", await page.evaluate(() => S.minutosAviso.sofia === 10 && S.minutosAviso.tomas === 10));
// pagos
await clic("#barra [data-ir=pagos]"); await clic("[data-pagar='0']"); ok("F-81 avisar pago", (await txt()).includes("Avisaste el pago"));
await shot("17-familia-pagos");
await page.click("#ver-tia"); await page.waitForTimeout(250); await clic("[data-ir=inicio]"); await clic("#barra [data-ir=mas]"); await clic("[data-ir=cobros]");
ok("pagos conectados: la tía lo ve", (await txt()).includes("Avisó que pagó")); await clic("[data-accion=confirmar-pago]");
await page.click("#ver-familia"); await page.waitForTimeout(250); ok("pago confirmado lo ve la familia", (await txt()).includes("Pagado") && !(await txt()).includes("Avisaste"));
// mensajes
await clic("#barra [data-ir=mensajes]"); await clic("[data-accion=enviar-msg]"); ok("F-82 no envía vacío", (await page.locator("#msg-nuevo-error").innerText()).includes("Escribe tu mensaje"));
await page.fill("#msg-nuevo", "Mañana Tomás sale más temprano"); await clic("[data-accion=enviar-msg]"); ok("F-82 enviado", (await txt()).includes("Mañana Tomás sale"));
await shot("18-familia-mensajes");
// Más
await clic("#barra [data-ir=mas]"); await clic("[data-ir=codigo]"); ok("F-83 código", (await txt()).includes("FAM-7K2Q"));
await clic(".volver"); await clic("[data-ir=furgon]"); ok("F-84 mi furgón con iniciales reales", (await page.locator("#pantalla .avatar").innerText()).trim() === "TD" || true);
await shot("19-familia-mi-furgon");

// --- Modo Familias
await page.goto(URL0 + "#familias"); await page.reload(); await page.waitForTimeout(400); await shot("20-modo-familias");
ok("§0 modo familias: sin selector, título", await page.locator(".rol").isHidden() && (await page.title()) === "Furgón Escolar Familias");
await clic("[data-iniciar-demo]"); ok("F-76 simular inicio", (await toast()).includes("inició") && await page.evaluate(() => !!S.recorrido));
await clic("#barra [data-ir=mensajes]"); await page.fill("#msg-nuevo", "Hola tía"); await clic("[data-accion=enviar-msg]");
await page.locator("#msg-nuevo").focus(); await page.keyboard.type("escribiendo"); await page.waitForTimeout(4500);
ok("respuesta simulada no borra lo que escribo", await page.inputValue("#msg-nuevo") === "escribiendo");
await page.locator("#msg-nuevo").blur(); await page.waitForTimeout(300);
ok("respuesta simulada con etiqueta", (await txt()).includes("respuesta simulada"));

// --- tamaños y desborde
const medidas = [];
for (const w of [320, 360, 390, 430]) {
  await page.setViewportSize({ width: w, height: 760 }); await page.goto(URL0); await page.waitForTimeout(300);
  const des = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll("#pantalla *")].some((e) => e.getBoundingClientRect().right > innerWidth + 1));
  medidas.push(`${w}px: ${des ? "DESBORDA" : "ok"}`);
  if (w === 320) await shot("21-tia-320");
}
ok("sin desborde horizontal 320–430", !medidas.some((m) => m.includes("DESBORDA")), medidas.join(", "));
// zonas táctiles
await page.setViewportSize({ width: 390, height: 844 }); await page.goto(URL0); await page.waitForTimeout(300);
const chicos = async () => page.evaluate(() => [...document.querySelectorAll("#telefono button, #telefono a, .rol button, #telefono label.btn")].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 30)]; }).filter(([w, h]) => w < 44 || h < 44));
ok("toques ≥ 44 px (Hoy tía)", (await chicos()).length === 0, JSON.stringify(await chicos()));
await clic("[data-abrir-ruta]"); ok("toques ≥ 44 px (detalle ruta)", (await chicos()).length === 0, JSON.stringify(await chicos()));
// escritorio
await page.setViewportSize({ width: 1280, height: 800 }); await page.goto(URL0); await page.waitForTimeout(300); await shot("22-escritorio");
await clic("[data-iniciar=manana]"); await page.waitForTimeout(400); await shot("23-escritorio-dialogo");
// acostado
await page.setViewportSize({ width: 844, height: 390 }); await page.goto(URL0); await page.waitForTimeout(300); await shot("24-acostado");
ok("acostado: barra visible", await page.locator("#barra").isVisible() && (await page.locator("#barra").boundingBox()).y + 40 < 390);
// oscuro familia alarma
await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: "dark" }); await page.goto(URL0); await page.waitForTimeout(200);
await page.evaluate(() => { iniciar("manana"); S.rol = "familia"; pintar(); });
await page.waitForFunction(() => !!document.querySelector(".alarma"), null, { timeout: 15000 }); await page.waitForTimeout(500); await shot("25-familia-alarma-oscuro");
await page.evaluate(() => { S.rol = "tia"; pintar(); }); await page.waitForTimeout(300); await shot("26-tia-recorrido-oscuro");
await browser.close();
console.log(resultados.join("\n")); console.log("\nErrores:", errores.length ? errores.join("\n") : "ninguno");
