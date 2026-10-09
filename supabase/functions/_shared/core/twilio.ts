// TwiML y validación de firma de Twilio, sin SDK (Web Crypto: Deno y Node 18+).

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface OpcionesVoz {
  idioma: string; // p. ej. "es-MX"
  voz: string; // p. ej. "Polly.Mia" o "Google.es-US-Standard-A"
}

export const VOZ_POR_DEFECTO: OpcionesVoz = { idioma: "es-MX", voz: "Polly.Mia" };
/** Voz en inglés para quien eligió English en la app. */
export const VOZ_INGLES: OpcionesVoz = { idioma: "en-US", voz: "Polly.Joanna" };

const FRASES = {
  es: {
    confirmar: "Para confirmar que recibió este aviso, presione 1.",
    repito: "Repito:",
    presione: "Presione 1 para confirmar.",
    sinRespuesta: "No recibimos su confirmación. Volveremos a intentar. Adiós.",
    gracias: "Gracias. Aviso confirmado. Adiós.",
    noReconocida: "No reconocimos la opción. Volveremos a intentar. Adiós.",
  },
  en: {
    confirmar: "To confirm you received this message, press 1.",
    repito: "Again:",
    presione: "Press 1 to confirm.",
    sinRespuesta: "We did not receive your confirmation. We will try again. Goodbye.",
    gracias: "Thank you. Message confirmed. Goodbye.",
    noReconocida: "We did not recognize that option. We will try again. Goodbye.",
  },
};
const frases = (voz: OpcionesVoz) => (voz.idioma.startsWith("en") ? FRASES.en : FRASES.es);

/** TwiML del aviso: lee el mensaje dos veces y pide presionar 1 para confirmar. */
export function twimlAviso(mensaje: string, urlConfirmar: string, voz: OpcionesVoz = VOZ_POR_DEFECTO): string {
  const say = (t: string) => `<Say language="${escaparXml(voz.idioma)}" voice="${escaparXml(voz.voz)}">${escaparXml(t)}</Say>`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${escaparXml(urlConfirmar)}" method="POST">` +
    say(`${mensaje} ${frases(voz).confirmar}`) +
    `<Pause length="1"/>` +
    say(`${frases(voz).repito} ${mensaje} ${frases(voz).presione}`) +
    `</Gather>` +
    say(frases(voz).sinRespuesta) +
    `<Hangup/>` +
    `</Response>`
  );
}

export function twimlRespuestaConfirmacion(confirmada: boolean, voz: OpcionesVoz = VOZ_POR_DEFECTO): string {
  const texto = confirmada ? frases(voz).gracias : frases(voz).noReconocida;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say language="${escaparXml(voz.idioma)}" voice="${escaparXml(voz.voz)}">${escaparXml(texto)}</Say>` +
    `<Hangup/></Response>`
  );
}

/**
 * Firma esperada de Twilio (X-Twilio-Signature):
 * base64(HMAC-SHA1(authToken, url + concatenación ordenada de clave+valor de los parámetros POST)).
 */
export async function firmaTwilio(authToken: string, url: string, params: Record<string, string>): Promise<string> {
  const datos = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(datos)));
  let binario = "";
  for (const b of firma) binario += String.fromCharCode(b);
  return btoa(binario);
}

export async function validarFirmaTwilio(
  authToken: string,
  firmaRecibida: string | null,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  if (!firmaRecibida) return false;
  const esperada = await firmaTwilio(authToken, url, params);
  // Comparación en tiempo constante.
  if (esperada.length !== firmaRecibida.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) diff |= esperada.charCodeAt(i) ^ firmaRecibida.charCodeAt(i);
  return diff === 0;
}
