// Envío directo por Firebase Cloud Messaging (FCM HTTP v1), sin pasar por los servidores de Expo.
// La app guarda su token de Android como «fcm:<token>» (apps/movil/src/notificaciones.ts) cuando
// no hay proyecto de Expo. El mensaje va SOLO con datos, con los nombres que entiende
// expo-notifications en Android (title, message, body, channelId, categoryId, sound): así la
// notificación se dibuja igual que las de Expo, con el canal de alarma y los botones de la llamada.
//
// Credencial: la cuenta de servicio de Firebase (JSON completo) en el secreto FIREBASE_SERVICE_ACCOUNT.

export const PREFIJO_FCM = "fcm:";

export interface CuentaServicio { project_id: string; client_email: string; private_key: string }

export interface MensajeFcm {
  token: string;
  titulo: string;
  cuerpo: string;
  data: Record<string, unknown>;
  canal: string;
  sonido: string | null;
  categoria?: string;
  /** Segundos: un aviso de «llega en 5 min» no sirve si llega tarde. */
  ttl: number;
}

/** Cuerpo de la petición FCM v1 para un mensaje (función pura, se prueba en tests/fcm.test.ts). */
export function cuerpoFcm(m: MensajeFcm) {
  const data: Record<string, string> = {
    title: m.titulo,
    message: m.cuerpo,
    body: JSON.stringify(m.data),
    channelId: m.canal,
  };
  if (m.sonido) data.sound = m.sonido;
  if (m.categoria) data.categoryId = m.categoria;
  return {
    message: {
      token: m.token.startsWith(PREFIJO_FCM) ? m.token.slice(PREFIJO_FCM.length) : m.token,
      data,
      android: { priority: "HIGH", ttl: `${Math.max(1, Math.round(m.ttl))}s` },
    },
  };
}

const b64url = (bytes: Uint8Array | string) => {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(typeof bytes === "string" ? unescape(encodeURIComponent(s)) : s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** JWT firmado (RS256) para pedir el token de acceso de Google. */
export async function jwtCuentaServicio(c: CuentaServicio, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const carga = b64url(JSON.stringify({
    iss: c.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600,
  }));
  const pem = c.private_key.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const llave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", llave, new TextEncoder().encode(`${cabecera}.${carga}`)));
  return `${cabecera}.${carga}.${b64url(firma)}`;
}

let accesoCache: { token: string; vence: number } | null = null;

async function tokenAcceso(c: CuentaServicio): Promise<string> {
  if (accesoCache && accesoCache.vence > Date.now() + 60_000) return accesoCache.token;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await jwtCuentaServicio(c) }),
    signal: AbortSignal.timeout(8_000),
  });
  const j = await resp.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!j.access_token) throw new Error(`Firebase no entregó acceso: ${j.error_description ?? resp.status}`);
  accesoCache = { token: j.access_token, vence: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

export function leerCuentaServicio(json: string | undefined): CuentaServicio | null {
  if (!json) return null;
  try {
    const c = JSON.parse(json) as Partial<CuentaServicio>;
    return c.project_id && c.client_email && c.private_key ? (c as CuentaServicio) : null;
  } catch {
    return null;
  }
}

export interface ResultadoFcm { estado: "ok" | "error"; id?: string; error?: string; tokenInvalido?: boolean }

/** Envía cada mensaje por FCM v1; nunca lanza: el resultado de cada uno va en la lista. */
export async function enviarFcm(c: CuentaServicio, mensajes: MensajeFcm[]): Promise<ResultadoFcm[]> {
  let acceso: string;
  try {
    acceso = await tokenAcceso(c);
  } catch (e) {
    return mensajes.map(() => ({ estado: "error", error: e instanceof Error ? e.message : String(e) }));
  }
  return Promise.all(mensajes.map(async (m): Promise<ResultadoFcm> => {
    try {
      const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoFcm(m)),
        signal: AbortSignal.timeout(8_000),
      });
      const j = await resp.json().catch(() => ({})) as { name?: string; error?: { message?: string; status?: string; details?: { errorCode?: string }[] } };
      if (resp.ok) return { estado: "ok", id: j.name };
      const codigo = j.error?.details?.find((d) => d.errorCode)?.errorCode ?? j.error?.status;
      return { estado: "error", error: j.error?.message ?? `http_${resp.status}`, tokenInvalido: codigo === "UNREGISTERED" || resp.status === 404 };
    } catch (e) {
      return { estado: "error", error: e instanceof Error ? e.message : String(e) };
    }
  }));
}
