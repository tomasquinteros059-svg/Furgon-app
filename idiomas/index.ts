// Idiomas de Furgón Escolar (fuente única para la app, el panel web y el servidor).
//
// El texto en español ES la clave: en el código se escribe t("Hola, {nombre}", { nombre }) y el
// diccionario de cada idioma traduce ese texto. Si falta una traducción se muestra el español,
// así nunca aparece una clave vacía. tests/idiomas.test.ts revisa que no falte ninguna.

export type Idioma = "es" | "en";
export type PreferenciaIdioma = "sistema" | Idioma;
export const IDIOMAS: Idioma[] = ["es", "en"];
export const NOMBRE_IDIOMA: Record<Idioma, string> = { es: "Español", en: "English" };
/** Locale para fechas, horas y montos. */
export const LOCALE: Record<Idioma, string> = { es: "es-CL", en: "en-US" };

export type Diccionario = Record<string, string>;
export type Variables = Record<string, string | number | null | undefined>;

/** Idioma soportado a partir de un locale del sistema ("en-US" → "en"; lo demás → "es"). */
export function idiomaDeLocale(locale: string | null | undefined): Idioma {
  return locale?.toLowerCase().startsWith("en") ? "en" : "es";
}

export function interpolar(texto: string, vars?: Variables): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m));
}

/** Crea t() para un conjunto de diccionarios; `idioma` se lee en cada llamada. */
export function crearTraductor(diccionarios: Partial<Record<Idioma, Diccionario>>, idioma: () => Idioma) {
  return function t(texto: string, vars?: Variables): string {
    const i = idioma();
    const traducido = i === "es" ? texto : (diccionarios[i]?.[texto] ?? texto);
    return interpolar(traducido, vars);
  };
}

/** Variables que usa un texto ({nombre} → ["nombre"]), para revisar las traducciones. */
export const variablesDe = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Traduce un texto con datos variables usando patrones [regex, reemplazo con $1…]; null si ninguno calza. */
export function traducirConPatrones(texto: string, patrones: readonly (readonly [RegExp, string])[]): string | null {
  for (const [re, reemplazo] of patrones) if (re.test(texto)) return texto.replace(re, reemplazo);
  return null;
}
