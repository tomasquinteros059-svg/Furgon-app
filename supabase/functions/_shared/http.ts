import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { entorno } from "./entorno.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export function error(status: number, codigo: string, mensaje: string): Response {
  return json({ error: codigo, mensaje }, status);
}

/** Cliente con service_role: ignora RLS. Usar solo después de autorizar. */
export function clienteServicio(): SupabaseClient {
  return createClient(entorno.supabaseUrl(), entorno.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente que actúa como el usuario de la petición: aplica RLS y auth.uid(). */
export function clienteUsuario(req: Request): SupabaseClient {
  return createClient(entorno.supabaseUrl(), entorno.anonKey(), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function usuarioDeLaPeticion(req: Request, sb: SupabaseClient): Promise<User | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
}
