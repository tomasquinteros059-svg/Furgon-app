// Llamada gratis por internet: llega como push de alta prioridad (categoría con botones),
// la app la muestra como llamada entrante y lee el mensaje en voz alta en el teléfono.
// Si el teléfono no acusa recibo en 15 s (sin internet), el servidor llama por teléfono (con costo).
//
// Este módulo define una tarea global: debe importarse en el ámbito global (src/app/_layout.tsx).
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { t } from "./lib/idioma";
import { llamarFuncion } from "./lib/supabase";

// Debe coincidir con supabase/functions/_shared/push.ts
export const CATEGORIA_LLAMADA = "llamada-furgon";
const TAREA_PUSH = "furgon-push-segundo-plano";

export interface DatosLlamada {
  llamadaId: string;
  avisoId: string;
  alumnoId: string;
  alumno: string;
  voz: string;
}

/** Busca los datos de la llamada en cualquier forma en que llegue la notificación (iOS, Android, segundo plano). */
export function extraerLlamada(x: unknown, profundidad = 0): DatosLlamada | null {
  if (profundidad > 6 || x === null || x === undefined) return null;
  if (typeof x === "string") {
    if (!x.includes("llamadaId")) return null;
    try {
      return extraerLlamada(JSON.parse(x), profundidad + 1);
    } catch {
      return null;
    }
  }
  if (typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.llamadaId === "string" && o.tipo === "llamada") {
    return {
      llamadaId: o.llamadaId,
      avisoId: String(o.avisoId ?? ""),
      alumnoId: String(o.alumnoId ?? ""),
      alumno: String(o.alumno ?? ""),
      voz: String(o.voz ?? ""),
    };
  }
  for (const v of Object.values(o)) {
    const r = extraerLlamada(v, profundidad + 1);
    if (r) return r;
  }
  return null;
}

type Accion = "acuse" | "confirmar" | "rechazar";

export async function responderLlamada(llamadaId: string, accion: Accion): Promise<void> {
  try {
    await llamarFuncion("llamada-app", { llamada_id: llamadaId, accion });
  } catch (e) {
    console.warn(`llamada-app ${accion} falló`, e);
  }
}

export function abrirLlamada(d: DatosLlamada): void {
  router.push({ pathname: "/apoderado/llamada/[id]", params: { id: d.llamadaId, alumno: d.alumno, voz: d.voz } });
}

// Acuse en segundo plano: si el sistema despierta la app al llegar la push, el servidor
// sabe que hay internet y no hace la llamada telefónica con costo.
TaskManager.defineTask(TAREA_PUSH, async ({ data, error }) => {
  if (error) return;
  const d = extraerLlamada(data);
  if (d) await responderLlamada(d.llamadaId, "acuse");
});

export async function configurarLlamadas(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORIA_LLAMADA, [
    { identifier: "confirmar", buttonTitle: t("Confirmar (1)"), options: { opensAppToForeground: true } },
    { identifier: "rechazar", buttonTitle: t("No puedo"), options: { opensAppToForeground: false } },
  ]);
  try {
    await Notifications.registerTaskAsync(TAREA_PUSH);
  } catch (e) {
    console.warn("no se pudo registrar la tarea de push en segundo plano", e);
  }
}

/** Notificación recibida con la app abierta: acusa y muestra la llamada. */
export async function alRecibir(n: Notifications.Notification): Promise<void> {
  const d = extraerLlamada(n.request.content.data);
  if (!d) return;
  await responderLlamada(d.llamadaId, "acuse");
  abrirLlamada(d);
}

/** La persona tocó la notificación o uno de sus botones. */
export async function alResponder(r: Notifications.NotificationResponse): Promise<boolean> {
  const d = extraerLlamada(r.notification.request.content.data);
  if (!d) return false;
  if (r.actionIdentifier === "rechazar") {
    await responderLlamada(d.llamadaId, "rechazar");
  } else if (r.actionIdentifier === "confirmar") {
    await responderLlamada(d.llamadaId, "confirmar");
    router.navigate(`/apoderado/seguir/${d.alumnoId}`);
  } else {
    await responderLlamada(d.llamadaId, "acuse");
    abrirLlamada(d);
  }
  return true;
}
