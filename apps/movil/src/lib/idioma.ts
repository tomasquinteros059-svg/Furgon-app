// Núcleo del idioma de la app: t(), el idioma actual y el locale de fechas y montos.
// El proveedor y el selector están en src/i18n.tsx.
import { crearTraductor, type Idioma, idiomaDeLocale, LOCALE, traducirConPatrones, type Variables } from "../../../../idiomas/index.ts";
import { EN_MOVIL } from "../../../../idiomas/en/movil.ts";
import { EN_ERRORES_PATRONES } from "../../../../idiomas/en/errores.ts";

export const idiomaSistema = (): Idioma => {
  try { return idiomaDeLocale(Intl.DateTimeFormat().resolvedOptions().locale); } catch { return "es"; }
};

let idiomaActual: Idioma = idiomaSistema();
export const fijarIdioma = (i: Idioma) => { idiomaActual = i; };
export const idioma = () => idiomaActual;
/** Locale para fechas y montos ("es-CL" o "en-US"). */
export const locale = () => LOCALE[idiomaActual];
const traducir = crearTraductor({ en: EN_MOVIL }, () => idiomaActual);
/** Traduce un texto escrito en español: t("Hola, {nombre}", { nombre }). */
export const t = (texto: string, vars?: Variables): string => {
  const r = traducir(texto, vars);
  // Mensajes con datos variables (p. ej. una fecha) se traducen por patrón.
  return idiomaActual === "en" && r === texto ? (traducirConPatrones(texto, EN_ERRORES_PATRONES) ?? r) : r;
};
