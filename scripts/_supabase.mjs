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
export const REF = () => requerida("SUPABASE_PROJECT_REF");

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
