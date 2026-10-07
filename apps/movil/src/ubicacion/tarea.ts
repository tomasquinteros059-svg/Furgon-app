// Definición de la tarea de GPS en segundo plano. Debe importarse en el ámbito global
// (lo hace src/app/_layout.tsx) para que exista incluso cuando el sistema despierta
// la app solo para entregar ubicaciones.
import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";
import { procesarLecturas, TAREA_GPS } from "./seguimiento";

TaskManager.defineTask<{ locations: LocationObject[] }>(TAREA_GPS, async ({ data, error }) => {
  if (error) {
    console.warn("error de GPS en segundo plano:", error.message);
    return;
  }
  if (data?.locations?.length) await procesarLecturas(data.locations);
});
