// Fallas de JavaScript: en vez de que la app se cierre sin explicación, el error queda guardado y
// se muestra en pantalla (al tiro, o al volver a abrir la app si alcanzó a cerrarse). Así una
// captura de pantalla basta para saber qué pasó.
import { File, Paths } from "expo-file-system";
import Storage from "expo-sqlite/kv-store";

const CLAVE = "ultima-falla";

export function describirFalla(e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e));
  const pila = (err.stack ?? "").split("\n").slice(0, 6).join("\n");
  return `${err.name}: ${err.message}\n${pila}`.slice(0, 1500);
}

export function guardarFalla(e: unknown): void {
  try { Storage.setItemSync(CLAVE, `${new Date().toISOString()}\n${describirFalla(e)}`); } catch { /* sin almacenamiento */ }
}

/** La falla que cerró la app la última vez (y la olvida, para mostrarla una sola vez). */
export function tomarUltimaFalla(): string | null {
  const fallas: string[] = [];
  try {
    const v = Storage.getItemSync(CLAVE);
    if (v) { Storage.removeItemSync(CLAVE); fallas.push(v); }
  } catch { /* sin almacenamiento */ }
  // Error nativo de Android: lo escribe plugins/registro-fallas.js justo antes de cerrarse.
  try {
    const nativa = new File(Paths.document, "ultima-falla-nativa.txt");
    if (nativa.exists) {
      const texto = nativa.textSync();
      nativa.delete();
      // Android cerró la app en segundo plano por falta de memoria: no es un error de la app.
      if (!/\nmotivo 3:/.test(texto)) fallas.push(texto);
    }
  } catch { /* sin archivo */ }
  return fallas.length ? fallas.join("\n\n") : null;
}

/** Guarda cualquier error fatal antes de que React Native cierre la app. */
export function vigilarFallas(): void {
  const g = globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const anterior = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    if (fatal) guardarFalla(e);
    anterior(e, fatal);
  });
}
