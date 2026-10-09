import { locale } from "./i18n";

export const pesos = (n: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "CLP", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(n);
export const fecha = (iso: string) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso));
export const fechaHora = (iso: string) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const hora = (iso: string) => new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const nombreMes = (periodo: string) => {
  const [a, m] = periodo.split("-").map(Number);
  const t = new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(new Date(a, m - 1, 1));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const sumarMes = (periodo: string, n: number) => {
  const [a, m] = periodo.split("-").map(Number); const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Teléfono a E.164 (Chile por defecto). Misma regla que supabase/functions/_shared/core/telefono.ts. */
export function normalizarTelefono(entrada: string): string | null {
  const limpio = entrada.trim().replace(/[\s().-]/g, "");
  if (!limpio) return null;
  const d = limpio.startsWith("+") ? limpio.slice(1) : limpio.startsWith("00") ? limpio.slice(2)
    : limpio.startsWith("56") && limpio.length > 9 ? limpio : "56" + limpio.replace(/^0+/, "");
  if (!/^[1-9]\d{7,14}$/.test(d) || (d.startsWith("56") && d.length !== 11)) return null;
  return `+${d}`;
}
