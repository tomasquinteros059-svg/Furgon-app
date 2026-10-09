// Compila la app móvil en los servidores de Expo (EAS Build).
//
//   npm run compilar-app -- --plataforma android --perfil preview     (APK para instalar y probar)
//   npm run compilar-app -- --plataforma android --perfil production  (para Google Play)
//   npm run compilar-app -- --plataforma ios --perfil production      (para App Store)
//
// apps/movil/.env no se sube a Expo (está en .gitignore), así que antes de compilar este script
// copia sus valores a las variables de entorno de EAS del perfil elegido. Las claves de Google
// Maps quedan como «sensitive» (no se muestran en el panel de Expo). Necesita EXPO_TOKEN.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requerida } from "./_supabase.mjs";

const RAIZ = join(import.meta.dirname, "..");
const MOVIL = join(RAIZ, "apps", "movil");
const arg = (n, def) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : def; };
const plataforma = arg("plataforma", "android"), perfil = arg("perfil", "preview");
if (!["android", "ios", "all"].includes(plataforma) || !["development", "preview", "production"].includes(perfil)) {
  console.error("Uso: npm run compilar-app -- --plataforma android|ios|all --perfil development|preview|production");
  process.exit(1);
}
requerida("EXPO_TOKEN");

const archivo = join(MOVIL, ".env");
if (!existsSync(archivo)) {
  console.error("Falta apps/movil/.env: ejecuta antes `npm run desplegar` (escribe la URL y la anon key de Supabase).");
  process.exit(1);
}
const valores = Object.fromEntries(readFileSync(archivo, "utf8").split("\n")
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
// Las claves de Maps también pueden venir del entorno (así no se escriben en archivos).
for (const k of ["GOOGLE_MAPS_ANDROID_API_KEY", "GOOGLE_MAPS_IOS_API_KEY", "EAS_PROJECT_ID"]) if (process.env[k]) valores[k] = process.env[k].trim();

const VARIABLES = {
  EXPO_PUBLIC_SUPABASE_URL: "plaintext",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "plaintext",
  EXPO_PUBLIC_PANEL_URL: "plaintext",
  EAS_PROJECT_ID: "plaintext",
  GOOGLE_MAPS_ANDROID_API_KEY: "sensitive",
  GOOGLE_MAPS_IOS_API_KEY: "sensitive",
};
for (const k of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!valores[k]) { console.error(`Falta ${k} en apps/movil/.env.`); process.exit(1); }
}

const eas = (...a) => execFileSync("npx", ["-y", "eas-cli@latest", ...a], { cwd: MOVIL, stdio: "inherit", env: process.env });
for (const [k, visibilidad] of Object.entries(VARIABLES)) {
  if (!valores[k]) { console.log(`  · ${k} vacío: se omite`); continue; }
  eas("env:create", "--name", k, "--value", valores[k], "--environment", perfil, "--visibility", visibilidad, "--force", "--non-interactive");
}
console.log(`✓ Variables cargadas en el entorno «${perfil}» de EAS (los valores sensibles no se muestran).`);

eas("build", "--platform", plataforma, "--profile", perfil, "--non-interactive", "--no-wait");
console.log("✓ Compilación en curso en los servidores de Expo. El enlace de descarga llega a tu correo y aparece en expo.dev.");
