// Deja en $GITHUB_ENV (como SUPABASE_REF_RESUELTO) el código (ref) del proyecto de Supabase. Si SUPABASE_PROJECT_REF ya es un código
// o una dirección lo usa tal cual; si trae el NOMBRE del proyecto, lo busca entre los proyectos de la
// cuenta del token (o toma el único que haya). Nunca imprime el token.
//
//   node scripts/resolver-proyecto.mjs >> "$GITHUB_ENV"

import { requerida } from "./_supabase.mjs";

const token = requerida("SUPABASE_ACCESS_TOKEN");
const valor = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
const directo = valor.match(/\/project\/([a-z0-9]{20})/)?.[1]
  ?? valor.match(/^(?:https?:\/\/)?([a-z0-9]{20})\.supabase\.co/)?.[1]
  ?? valor.match(/(?:^|[^a-z0-9])([a-z]{20})(?![a-z0-9])/)?.[1];

let ref = directo;
if (!ref) {
  const r = await fetch("https://api.supabase.com/v1/projects", { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.error(`Supabase rechazó SUPABASE_ACCESS_TOKEN (HTTP ${r.status}). Genera uno nuevo en supabase.com/dashboard/account/tokens.`);
    process.exit(1);
  }
  const proyectos = await r.json();
  const simple = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const elegido = proyectos.find((p) => simple(p.name) === simple(valor)) ?? (proyectos.length === 1 ? proyectos[0] : undefined);
  if (!elegido) {
    console.error(`No encontré un proyecto llamado así. Proyectos de esta cuenta: ${proyectos.map((p) => `«${p.name}»`).join(", ") || "ninguno"}.`);
    process.exit(1);
  }
  ref = elegido.id ?? elegido.ref;
  console.error(`Proyecto encontrado por su nombre: «${elegido.name}».`);
}
console.log(`SUPABASE_REF_RESUELTO=${ref}`);
