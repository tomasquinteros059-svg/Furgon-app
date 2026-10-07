// Crea (o renueva) las dos cuentas de prueba que piden Google Play y App Store para revisar la app,
// con un servicio de demostración: tía con licencia al día, furgón, rutas «Mañana» y «Tarde» y una
// familia con dos hijos.
//
//   npm run cuentas-revision -- --tia revision.tia@tudominio.cl --familia revision.familia@tudominio.cl
//
// Cada vez genera contraseñas nuevas y las muestra una sola vez: cópialas al formulario de cada
// tienda («Acceso a la app» en Play, «Información de revisión» en App Store). Son cuentas de prueba
// sin datos reales; no uses tus cuentas personales.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { api, lit, REF, sql } from "./_supabase.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1]?.trim().toLowerCase() : undefined; };
const correos = { tia: arg("tia"), familia: arg("familia") };
if (!correos.tia || !correos.familia) {
  console.error("Uso: npm run cuentas-revision -- --tia correo --familia correo");
  process.exit(1);
}

const claves = await api("GET", "/api-keys?reveal=true");
const servicio = claves.find((k) => k.name === "service_role")?.api_key;
if (!servicio) throw new Error("No se encontró la service_role key del proyecto.");
const auth = async (metodo, ruta, cuerpo) => {
  const r = await fetch(`https://${REF()}.supabase.co/auth/v1/admin${ruta}`, {
    method: metodo,
    headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) throw new Error(`auth ${metodo} ${ruta} → HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
};

const ids = {}, contrasenas = {};
for (const [quien, correo] of Object.entries(correos)) {
  contrasenas[quien] = `Demo-${randomBytes(6).toString("base64url")}`;
  const [existente] = await sql(`select id from auth.users where lower(email) = ${lit(correo)}`);
  const datos = { password: contrasenas[quien], email_confirm: true, user_metadata: { nombre: quien === "tia" ? "Tía Demo" : "Familia Demo" } };
  ids[quien] = existente
    ? (await auth("PUT", `/users/${existente.id}`, datos)).id
    : (await auth("POST", "/users", { email: correo, ...datos })).id;
}

const semilla = readFileSync(new URL("./sql/demo-revision.sql", import.meta.url), "utf8");
await sql(`select set_config('demo.tia', ${lit(ids.tia)}, false), set_config('demo.familia', ${lit(ids.familia)}, false);\n${semilla}`);

console.log("✓ Servicio «Furgón Demo (revisión)» listo. Cuentas para las tiendas (se muestran solo esta vez):");
console.log(`  Conductora: ${correos.tia} / ${contrasenas.tia}`);
console.log(`  Familia:    ${correos.familia} / ${contrasenas.familia}`);
