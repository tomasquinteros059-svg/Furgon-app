// Despliega el backend en un proyecto de Supabase:
//   1) aplica las migraciones pendientes (supabase/migrations), cada una en su transacción;
//   2) carga los secretos de las funciones (clave de Google, CRON_SECRET, etc.);
//   3) despliega las Edge Functions;
//   4) deja los valores PÚBLICOS (URL y anon key) en apps/movil/.env y apps/admin/.env.
//
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… GOOGLE_MAPS_API_KEY=… node scripts/desplegar-supabase.mjs [--sin-confirmar-correo]
//
// Se puede ejecutar las veces que haga falta: solo aplica lo que falta.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api, lit, REF, sql, TOKEN } from "./_supabase.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACIONES = join(RAIZ, "supabase", "migrations");
const soloMigraciones = process.argv.includes("--solo-migraciones");
// Durante el piloto conviene no exigir la confirmación del correo al crear cuentas.
const sinConfirmarCorreo = process.argv.includes("--sin-confirmar-correo");

async function migrar() {
  await sql(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const aplicadas = new Set((await sql("select version from supabase_migrations.schema_migrations")).map((f) => f.version));
  const archivos = readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  let n = 0;
  for (const archivo of archivos) {
    const [version, ...resto] = archivo.replace(/\.sql$/, "").split("_");
    if (aplicadas.has(version)) continue;
    const cuerpo = readFileSync(join(MIGRACIONES, archivo), "utf8");
    process.stdout.write(`  · ${archivo} … `);
    await sql(`begin;\n${cuerpo}\n;insert into supabase_migrations.schema_migrations (version, name) values (${lit(version)}, ${lit(resto.join("_"))});\ncommit;`);
    console.log("ok");
    n++;
  }
  console.log(n ? `✓ ${n} migración(es) aplicada(s).` : "✓ La base ya estaba al día.");
}

async function secretos() {
  const actuales = new Set((await api("GET", "/secrets")).map((s) => s.name));
  const nuevos = [];
  const poner = (nombre, valor, siFalta = false) => {
    if (valor && !(siFalta && actuales.has(nombre))) nuevos.push({ name: nombre, value: valor });
  };
  const google = process.env.GOOGLE_MAPS_API_KEY?.trim();
  poner("GOOGLE_MAPS_API_KEY", google);
  poner("ETA_PROVEEDOR", google ? "google" : "ninguno");
  poner("CRON_SECRET", randomBytes(24).toString("hex"), true); // se genera una sola vez
  poner("LLAMADAS_HABILITADAS", process.env.LLAMADAS_HABILITADAS?.trim() || "false", true);
  poner("FUNCTIONS_PUBLIC_URL", `https://${REF()}.supabase.co/functions/v1`, true);
  for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_NUMERO_ORIGEN", "EXPO_ACCESS_TOKEN"]) poner(k, process.env[k]?.trim());
  if (nuevos.length) await api("POST", "/secrets", nuevos);
  console.log(`✓ Secretos: ${nuevos.map((s) => s.name).join(", ") || "sin cambios"} (los valores no se muestran).`);
  if (!google) console.log("  ⚠ Sin GOOGLE_MAPS_API_KEY: el ETA usa la geocerca de respaldo y no hay ruta por calles.");
}

function funciones() {
  // La CLI empaqueta las funciones en los servidores de Supabase (--use-api): no necesita Docker.
  execFileSync("npx", ["-y", "supabase@2", "functions", "deploy", "--project-ref", REF(), "--use-api"], {
    cwd: RAIZ, stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN() },
  });
  console.log("✓ Edge Functions desplegadas.");
}

async function valoresPublicos() {
  const claves = await api("GET", "/api-keys");
  const anon = claves.find((k) => k.name === "anon")?.api_key;
  if (!anon) throw new Error("No se encontró la anon key del proyecto.");
  const url = `https://${REF()}.supabase.co`;
  const escribir = (archivo, pares) => {
    const ruta = join(RAIZ, archivo);
    let texto = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
    for (const [k, v] of Object.entries(pares)) {
      const linea = `${k}=${v}`;
      texto = new RegExp(`^${k}=.*$`, "m").test(texto) ? texto.replace(new RegExp(`^${k}=.*$`, "m"), linea) : `${texto}${texto && !texto.endsWith("\n") ? "\n" : ""}${linea}\n`;
    }
    writeFileSync(ruta, texto);
  };
  escribir("apps/movil/.env", { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: anon });
  escribir("apps/admin/.env", { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon });
  console.log(`✓ URL y anon key (públicas) en apps/movil/.env y apps/admin/.env → ${url}`);
}

console.log(`Proyecto ${REF()}`);
console.log("1) Migraciones");
await migrar();
if (!soloMigraciones) {
  console.log("2) Secretos de las funciones");
  await secretos();
  console.log("3) Edge Functions");
  funciones();
  console.log("4) Valores públicos para las apps");
  await valoresPublicos();
  if (sinConfirmarCorreo) {
    await api("PATCH", "/config/auth", { mailer_autoconfirm: true });
    console.log("✓ Las cuentas nuevas no necesitan confirmar el correo (piloto).");
  }
}
console.log("Listo. Siguiente paso: node scripts/crear-empresa.mjs (ver docs/PUESTA-EN-MARCHA.md).");
