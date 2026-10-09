// Traducciones al inglés de la app móvil (texto en español → inglés).
import { EN_COMUN } from "./comun.ts";
import { EN_ERRORES } from "./errores.ts";
import { EN_MOVIL_CONDUCTOR } from "./movil-conductor.ts";
import { EN_MOVIL_FAMILIAS } from "./movil-familias.ts";

export const EN_MOVIL: Record<string, string> = { ...EN_COMUN, ...EN_ERRORES, ...EN_MOVIL_FAMILIAS, ...EN_MOVIL_CONDUCTOR };
