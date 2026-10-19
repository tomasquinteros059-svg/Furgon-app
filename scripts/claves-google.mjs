// Revisión de las claves de «Continuar con Google» antes de activarlo (scripts/desplegar-supabase.mjs).
/** Qué está mal en las claves de Google (o null si tienen la forma correcta). No muestra los valores. */
export function problemaClavesGoogle(id, secreto) {
  if (/^GOCSPX-/.test(id)) return "en GOOGLE_OAUTH_CLIENT_ID está el SECRETO: van al revés.";
  if (/\s/.test(id)) return "el ID de cliente tiene espacios o saltos de línea: cópialo de nuevo.";
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) {
    return "el ID de cliente debe ser como 123456789-abc….apps.googleusercontent.com (cópialo completo desde Google Cloud → Clientes).";
  }
  if (/\.apps\.googleusercontent\.com$/.test(secreto)) return "en el secreto está el ID de cliente: van al revés.";
  if (!/^GOCSPX-\S+$/.test(secreto)) return "el secreto del cliente debe empezar con GOCSPX- (cópialo desde Google Cloud → Clientes → tu cliente).";
  return null;
}
