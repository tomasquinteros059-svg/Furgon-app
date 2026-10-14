// Avisos del Inicio de la tía que se cierran con ✕ (se recuerda en el teléfono). La pestaña «Más»
// tiene «Volver a mostrar los avisos», que borra estas marcas.
import Storage from "expo-sqlite/kv-store";

export const CONSEJOS_CERRADOS = "inicio-consejos-cerrados";
export const NUEVOS_VISTOS_HASTA = "inicio-nuevos-vistos-hasta";
export const leer = (k: string) => { try { return Storage.getItemSync(k); } catch { return null; } };
export const guardar = (k: string, v: string | null) => {
  try { if (v == null) Storage.removeItemSync(k); else Storage.setItemSync(k, v); } catch { /* sin almacenamiento */ }
};
