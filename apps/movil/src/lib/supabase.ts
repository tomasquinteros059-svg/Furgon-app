import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (ver apps/movil/.env.example)");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Invoca una Edge Function con la sesión actual. Lanza con el mensaje del servidor si falla. */
export async function llamarFuncion<T = unknown>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nombre, { body: cuerpo });
  if (error) {
    let mensaje = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const json = ctx ? await ctx.json() : null;
      if (json?.mensaje) mensaje = json.mensaje;
    } catch {
      // sin cuerpo legible
    }
    throw new Error(mensaje);
  }
  return data as T;
}

/** Mensaje en español para errores de Supabase/red. */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : String(e);
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Network request failed|Failed to fetch/i.test(m)) return "Sin conexión. Revisa tu señal e intenta de nuevo.";
  if (/User already registered/i.test(m)) return "Ya existe una cuenta con ese correo.";
  if (/Database error saving new user/i.test(m)) return "No se pudo crear la cuenta. Revisa el código de invitación.";
  return m;
}
