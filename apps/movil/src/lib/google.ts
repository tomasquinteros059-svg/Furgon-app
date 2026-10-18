// Entrar con Google (Supabase Auth + navegador del sistema). La primera vez, la cuenta no tiene
// perfil: la pantalla «sin-perfil» le pide nombre, teléfono y, si tiene, el código de invitación.
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { t } from "./idioma";
import { SUPABASE_URL, supabase } from "./supabase";

const CLAVE_PUBLICA = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ¿Está activado «Entrar con Google» en el servidor? (si no, el botón no se muestra). */
export async function googleDisponible(): Promise<boolean> {
  if (!SUPABASE_URL || !CLAVE_PUBLICA) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: CLAVE_PUBLICA } });
    const d = (await r.json()) as { external?: { google?: boolean } };
    return !!d.external?.google;
  } catch {
    return false;
  }
}

/** Lee los parámetros de la dirección de vuelta (van después de # o de ?). Sin URL(): Hermes no la trae completa. */
function parametros(url: string): Record<string, string> {
  const salida: Record<string, string> = {};
  const texto = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  for (const par of texto.split("&")) {
    const [k, v = ""] = par.split("=");
    if (k) salida[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return salida;
}

/** Abre Google; devuelve false si la persona cerró la ventana. Lanza un error si Google o el servidor fallan. */
export async function entrarConGoogle(): Promise<boolean> {
  const vuelta = Linking.createURL("auth");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: vuelta, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  const r = await WebBrowser.openAuthSessionAsync(data.url, vuelta);
  if (r.type !== "success") return false;
  const p = parametros(r.url);
  if (p.error_description || p.error) throw new Error(p.error_description || p.error);
  if (p.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
    if (e) throw e;
    return true;
  }
  if (!p.access_token || !p.refresh_token) throw new Error(t("Google no devolvió la sesión. Intenta de nuevo."));
  const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
  if (e) throw e;
  return true;
}
