// Idioma del panel web: Automático (el del navegador), Español o English. Se recuerda en este
// navegador. `t()` lee el idioma actual; al cambiarlo, la app se vuelve a dibujar completa.
import { useEffect, useState } from "react";
import { crearTraductor, type Idioma, idiomaDeLocale, LOCALE, NOMBRE_IDIOMA, type PreferenciaIdioma } from "../../../idiomas/index.ts";
import { EN_ADMIN } from "../../../idiomas/en/admin.ts";

const leerPreferencia = (): PreferenciaIdioma => {
  try { const v = localStorage.getItem("idioma"); return v === "es" || v === "en" ? v : "sistema"; } catch { return "sistema"; }
};
const resolver = (p: PreferenciaIdioma): Idioma => (p === "sistema" ? idiomaDeLocale(navigator.language) : p);

let idiomaActual: Idioma = resolver(leerPreferencia());
document.documentElement.lang = idiomaActual;
export const t = crearTraductor({ en: EN_ADMIN }, () => idiomaActual);
export const idioma = () => idiomaActual;
/** Locale para fechas y montos ("es-CL" o "en-US"). */
export const locale = () => LOCALE[idiomaActual];

const oyentes = new Set<() => void>();
/** Se vuelve a dibujar cuando cambia el idioma (App lo usa como clave). */
export function useIdiomaActual(): Idioma {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  return idiomaActual;
}

function cambiar(p: PreferenciaIdioma) {
  try { localStorage.setItem("idioma", p); } catch { /* sin almacenamiento */ }
  idiomaActual = resolver(p);
  document.documentElement.lang = idiomaActual;
  oyentes.forEach((f) => f());
}

/** Selector Auto · ES · EN (junto al de tema). */
export function SelectorIdioma() {
  const [pref, setPref] = useState<PreferenciaIdioma>(leerPreferencia);
  return (
    <div className="tema" role="group" aria-label={t("Idioma")}>
      {([["sistema", t("Auto")], ["es", "ES"], ["en", "EN"]] as const).map(([v, n]) => (
        <button key={v} type="button" aria-pressed={pref === v} title={v === "sistema" ? t("Automático") : NOMBRE_IDIOMA[v]}
          onClick={() => { setPref(v); cambiar(v); }}>{n}</button>
      ))}
    </div>
  );
}
