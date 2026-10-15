// Firma AWS Signature V4 (sin SDK, con Web Crypto: Deno y Node 18+) y lectura del resultado de
// Rekognition CompareFaces para comparar la cara de la tía con la foto de su licencia.

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(clave: ArrayBuffer | Uint8Array, texto: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", clave as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(texto));
}

export interface CredencialesAws { accessKeyId: string; secretAccessKey: string; region: string }

/**
 * Devuelve los encabezados firmados (Authorization, x-amz-date y los que se firmaron) para un pedido.
 * `fecha` en formato AAAAMMDDTHHMMSSZ.
 */
export async function firmarAws(p: {
  metodo: string; url: string; servicio: string; cred: CredencialesAws;
  encabezados: Record<string, string>; cuerpo: string; fecha: string;
}): Promise<Record<string, string>> {
  const u = new URL(p.url);
  const dia = p.fecha.slice(0, 8);
  const todos: Record<string, string> = { ...p.encabezados, host: u.host, "x-amz-date": p.fecha };
  const nombres = Object.keys(todos).map((k) => k.toLowerCase()).sort();
  const valor = (n: string) => Object.entries(todos).find(([k]) => k.toLowerCase() === n)![1].trim().replace(/\s+/g, " ");
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join("&");
  const canonico = [
    p.metodo, u.pathname || "/", query,
    nombres.map((n) => `${n}:${valor(n)}\n`).join(""),
    nombres.join(";"),
    await sha256(p.cuerpo),
  ].join("\n");
  const alcance = `${dia}/${p.cred.region}/${p.servicio}/aws4_request`;
  const aFirmar = ["AWS4-HMAC-SHA256", p.fecha, alcance, await sha256(canonico)].join("\n");
  let clave = await hmac(enc.encode(`AWS4${p.cred.secretAccessKey}`), dia);
  for (const parte of [p.cred.region, p.servicio, "aws4_request"]) clave = await hmac(clave, parte);
  const firma = hex(await hmac(clave, aFirmar));
  return {
    ...p.encabezados,
    "x-amz-date": p.fecha,
    Authorization: `AWS4-HMAC-SHA256 Credential=${p.cred.accessKeyId}/${alcance}, SignedHeaders=${nombres.join(";")}, Signature=${firma}`,
  };
}

export type ResultadoRostro = "coincide" | "dudoso" | "no_coincide" | "sin_rostro" | "error";

/** Umbrales: ≥ 90 % coincide, 70–90 % dudoso (que la empresa lo mire con calma), menos no coincide. */
export function leerCompareFaces(ok: boolean, datos: unknown): { resultado: ResultadoRostro; similitud: number | null; detalle?: string } {
  const d = (datos ?? {}) as { FaceMatches?: { Similarity?: number }[]; UnmatchedFaces?: unknown[]; __type?: string; Message?: string; message?: string };
  if (!ok) {
    const tipo = d.__type ?? "";
    const mensaje = d.Message ?? d.message ?? "";
    // Rekognition responde InvalidParameterException cuando una de las fotos no tiene una cara.
    if (/InvalidParameter/i.test(tipo) && /face/i.test(mensaje)) return { resultado: "sin_rostro", similitud: null, detalle: mensaje };
    return { resultado: "error", similitud: null, detalle: `${tipo} ${mensaje}`.trim() };
  }
  const mejor = Math.max(0, ...(d.FaceMatches ?? []).map((m) => m.Similarity ?? 0));
  const similitud = Math.round(mejor * 10) / 10;
  return { resultado: similitud >= 90 ? "coincide" : similitud >= 70 ? "dudoso" : "no_coincide", similitud };
}
