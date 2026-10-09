// Traducciones al inglés del panel web (texto en español → inglés).
import { EN_ADMIN_PAGINAS } from "./admin-paginas.ts";
import { EN_COMUN } from "./comun.ts";
import { EN_ERRORES } from "./errores.ts";

export const EN_ADMIN: Record<string, string> = { ...EN_COMUN, ...EN_ERRORES, ...EN_ADMIN_PAGINAS };
