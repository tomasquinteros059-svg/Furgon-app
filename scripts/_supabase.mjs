// Utilidades para la API de administración de Supabase (https://api.supabase.com).
// Todo va por HTTPS: no hace falta Docker ni conexión directa a Postgres.
// Lee SUPABASE_ACCESS_TOKEN y SUPABASE_PROJECT_REF del entorno: nunca se escriben en archivos.

export function requerida(nombre) {
  const v = process.env[nombre]?.trim();
  if (!v) {
    console.error(`Falta la variable de entorno ${nombre}. Revisa docs/PUESTA-EN-MARCHA.md.`);
    process.exit(1);
  }
  return v;
}

export const TOKEN = () => requerida("SUPABASE_ACCESS_TOKEN");
/**
 * Código del proyecto (20 letras). Acepta también lo que se suele pegar por error: la dirección del
 * panel (supabase.com/dashboard/project/<ref>/…) o la del proyecto (https://<ref>.supabase.co).
 */
export const REF = () => {
  // En GitHub Actions, scripts/resolver-proyecto.mjs deja aquí el código ya buscado por nombre.
  const v = process.env.SUPABASE_REF_RESUELTO?.trim() || requerida("SUPABASE_PROJECT_REF");
  const ref = v.match(/\/project\/([a-z0-9]+)/i)?.[1] ?? v.match(/^(?:https?:\/\/)?([a-z0-9]+)\.supabase\.co/i)?.[1]
    ?? v.match(/(?:^|[^a-z0-9])([a-z]{20})(?![a-z0-9])/)?.[1] ?? v; // p. ej. «Project ID: abcd…» pegado entero
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    console.error("SUPABASE_PROJECT_REF no parece un código de proyecto: deben ser 20 letras y números en minúscula,");
    console.error("el final de la dirección supabase.com/dashboard/project/<código>. Revisa que no tenga espacios ni otras partes.");
    // Pistas sin mostrar el valor (los registros de GitHub Actions son públicos).
    const pista = /^sbp_/.test(ref) ? "parece el token de acceso (empieza con sbp_): va en SUPABASE_ACCESS_TOKEN"
      : /^sb_(publishable|secret)_/.test(ref) || /^eyJ/.test(ref) ? "parece una clave de API del proyecto, no su código"
      : /[A-Z\s-]/.test(ref) ? "tiene mayúsculas, espacios o guiones: parece el NOMBRE del proyecto, no su código"
      : `tiene ${ref.length} caracteres (deben ser 20)`;
    console.error(`  → Lo que hay guardado ${pista}.`);
    process.exit(1);
  }
  return ref;
};

export async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF()}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → HTTP ${r.status}: ${texto.slice(0, 500)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Ejecuta SQL en la base del proyecto (como el rol postgres). */
export const sql = (query) => api("POST", "/database/query", { query });

/** Comillas simples para literales SQL. */
export const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Clave pública del proyecto (la que va dentro de las apps). Los proyectos nuevos listan primero la
 * `anon` antigua (un `eyJ…`), que puede venir desactivada: se prefiere la `sb_publishable_…`.
 */
export async function clavePublica() {
  const claves = await api("GET", "/api-keys");
  const k = claves.find((c) => /^sb_publishable_/.test(c.api_key ?? ""))
    ?? claves.find((c) => c.name === "publishable")
    ?? claves.find((c) => c.name === "anon");
  if (!k?.api_key) throw new Error("No se encontró la clave pública (publishable/anon) del proyecto.");
  return k.api_key;
}
