// Configuración desde variables de entorno. Ninguna clave vive en el código.

const leer = (nombre: string): string | undefined => {
  const v = Deno.env.get(nombre);
  return v === undefined || v.trim() === "" ? undefined : v.trim();
};

export function requerida(nombre: string): string {
  const v = leer(nombre);
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export const entorno = {
  supabaseUrl: () => requerida("SUPABASE_URL"),
  serviceRoleKey: () => requerida("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: () => requerida("SUPABASE_ANON_KEY"),

  etaProveedor: () => (leer("ETA_PROVEEDOR") ?? "ninguno") as "google" | "mapbox" | "ninguno",
  googleMapsKey: () => leer("GOOGLE_MAPS_API_KEY"),
  mapboxToken: () => leer("MAPBOX_ACCESS_TOKEN"),

  expoAccessToken: () => leer("EXPO_ACCESS_TOKEN"),

  llamadasHabilitadas: () => leer("LLAMADAS_HABILITADAS") === "true",
  twilioAccountSid: () => requerida("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: () => requerida("TWILIO_AUTH_TOKEN"),
  twilioNumeroOrigen: () => requerida("TWILIO_NUMERO_ORIGEN"),
  twilioVoz: () => ({ voz: leer("TWILIO_VOZ") ?? "Polly.Mia", idioma: leer("TWILIO_IDIOMA") ?? "es-MX" }),
  /** URL pública base de las funciones, p. ej. https://xyz.supabase.co/functions/v1 */
  funcionesUrlPublica: () => (leer("FUNCTIONS_PUBLIC_URL") ?? `${requerida("SUPABASE_URL")}/functions/v1`).replace(/\/$/, ""),
  cronSecret: () => leer("CRON_SECRET"),
};

/** Ejecuta trabajo después de responder (Supabase Edge Runtime mantiene viva la instancia hasta que termine). */
export function enSegundoPlano(promesa: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  const segura = promesa.catch((e) => console.error("tarea en segundo plano falló", e));
  if (rt) rt.waitUntil(segura);
}
