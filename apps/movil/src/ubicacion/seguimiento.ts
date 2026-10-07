// GPS en segundo plano del conductor: solo existe mientras hay un recorrido activo.
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { Alert } from "react-native";
import Storage from "expo-sqlite/kv-store";
import type { LocationObject } from "expo-location";
import { type PosicionGps, type ResultadoEnvio, vaciarCola } from "../lib/core";
import { SUPABASE_URL, supabase } from "../lib/supabase";
import { colaSqlite } from "./cola-sqlite";

export const TAREA_GPS = "furgon-gps";
const CLAVE_RECORRIDO = "recorrido_activo";
/** Se envía una posición cada ~10 s; las lecturas intermedias se descartan para ahorrar batería y datos. */
const INTERVALO_MIN_MS = 10_000;

let ultimaEncoladaMs = 0;
let enviando: Promise<unknown> | null = null;

export function recorridoActivo(): string | null {
  return Storage.getItemSync(CLAVE_RECORRIDO);
}

export type ResultadoInicio = { ok: true } | { ok: false; mensaje: string };

// Aviso destacado antes de pedir el permiso (lo exige Google Play para la ubicación en segundo plano).
const avisoUbicacion = () => new Promise<boolean>((resolver) => Alert.alert(
  "Ubicación del furgón",
  "Furgón Escolar recopila la ubicación de este teléfono para compartir el furgón con las familias de tu recorrido "
  + "y avisarles antes de que llegue, incluso cuando la app está cerrada o la pantalla apagada. "
  + "Solo mientras hay un recorrido iniciado; al finalizarlo deja de usarla.\n\n"
  + "En la siguiente pantalla elige «Permitir todo el tiempo».",
  [
    { text: "Ahora no", style: "cancel", onPress: () => resolver(false) },
    { text: "Continuar", onPress: () => resolver(true) },
  ],
  { cancelable: true, onDismiss: () => resolver(false) },
));

/** Pide (con el aviso previo) los permisos de ubicación del recorrido. Se llama antes de iniciarlo. */
export async function pedirPermisosUbicacion(): Promise<ResultadoInicio> {
  const [fgActual, bgActual] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
  if (fgActual.granted && bgActual.granted) return { ok: true };
  if (!(await avisoUbicacion())) {
    return { ok: false, mensaje: "Sin la ubicación del furgón no podemos avisar a las familias. Puedes iniciar el recorrido cuando quieras." };
  }
  const fg = fgActual.granted ? fgActual : await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { ok: false, mensaje: "Necesitamos acceso a tu ubicación para avisar a los apoderados." };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return {
      ok: false,
      mensaje: "Para avisar aunque la pantalla esté apagada, permite la ubicación \"Todo el tiempo\" en los ajustes.",
    };
  }
  return { ok: true };
}

export async function iniciarSeguimiento(recorridoId: string): Promise<ResultadoInicio> {
  const permisos = await pedirPermisosUbicacion();
  if (!permisos.ok) return permisos;

  Storage.setItemSync(CLAVE_RECORRIDO, recorridoId);
  ultimaEncoladaMs = 0;
  if (await Location.hasStartedLocationUpdatesAsync(TAREA_GPS)) {
    await Location.stopLocationUpdatesAsync(TAREA_GPS);
  }
  await Location.startLocationUpdatesAsync(TAREA_GPS, {
    accuracy: Location.Accuracy.High,
    timeInterval: INTERVALO_MIN_MS, // Android
    distanceInterval: 20,
    deferredUpdatesInterval: INTERVALO_MIN_MS, // iOS: agrupa lecturas
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Recorrido en curso",
      notificationBody: "Compartiendo la ubicación del furgón con los apoderados del recorrido.",
      notificationColor: "#F5B700",
      killServiceOnDestroy: false,
    },
  });
  return { ok: true };
}

/** Detiene el GPS y envía lo que quede en la cola. Sin recorrido no hay rastreo. */
export async function detenerSeguimiento(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_GPS)) {
      await Location.stopLocationUpdatesAsync(TAREA_GPS);
    }
  } catch {
    // la tarea no estaba registrada
  }
  await enviarCola().catch(() => {});
  Storage.removeItemSync(CLAVE_RECORRIDO);
}

/** Llamado por la tarea en segundo plano con cada lote de lecturas del GPS. */
export async function procesarLecturas(lecturas: LocationObject[]): Promise<void> {
  const recorridoId = recorridoActivo();
  if (!recorridoId) {
    // El recorrido terminó pero la tarea siguió viva: se apaga.
    await Location.stopLocationUpdatesAsync(TAREA_GPS).catch(() => {});
    return;
  }
  const nuevas: PosicionGps[] = [];
  for (const l of [...lecturas].sort((a, b) => a.timestamp - b.timestamp)) {
    if (l.timestamp - ultimaEncoladaMs < INTERVALO_MIN_MS) continue;
    ultimaEncoladaMs = l.timestamp;
    nuevas.push({
      clientId: Crypto.randomUUID(),
      recorridoId,
      registradaEnMs: l.timestamp,
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      precisionM: l.coords.accuracy ?? null,
      velocidadMs: l.coords.speed !== null && l.coords.speed >= 0 ? l.coords.speed : null,
      rumbo: l.coords.heading !== null && l.coords.heading >= 0 ? l.coords.heading : null,
    });
  }
  if (nuevas.length) await colaSqlite.agregar(nuevas);
  await enviarCola();
}

/** Envía la cola al backend. Si no hay señal, las posiciones esperan al siguiente intento. */
export function enviarCola(): Promise<unknown> {
  // Un solo envío a la vez (la tarea y la pantalla pueden pedirlo al mismo tiempo).
  enviando ??= vaciarCola(colaSqlite, enviarLote).finally(() => {
    enviando = null;
  });
  return enviando;
}

async function enviarLote(recorridoId: string, lote: PosicionGps[]): Promise<ResultadoEnvio> {
  const { data } = await supabase.auth.getSession(); // refresca el token si venció
  const token = data.session?.access_token;
  if (!token) return { ok: false, reintentable: true, error: "sin sesión" };
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/posiciones`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recorrido_id: recorridoId,
        posiciones: lote.map((p) => ({
          client_id: p.clientId, ts: p.registradaEnMs, lat: p.lat, lng: p.lng,
          precision_m: p.precisionM, velocidad_ms: p.velocidadMs, rumbo: p.rumbo,
        })),
      }),
    });
    if (resp.ok) return { ok: true };
    if (resp.status === 409 || resp.status === 403) {
      // El recorrido ya no está activo (lo cerró el conductor o el sistema): no se rastrea más.
      if (recorridoActivo() === recorridoId) {
        Storage.removeItemSync(CLAVE_RECORRIDO);
        await Location.stopLocationUpdatesAsync(TAREA_GPS).catch(() => {});
      }
      return { ok: false, reintentable: false, error: `recorrido no activo (${resp.status})` };
    }
    return { ok: false, reintentable: true, error: `HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, reintentable: true, error: e instanceof Error ? e.message : String(e) };
  }
}

export function pendientesEnCola(): Promise<number> {
  return colaSqlite.contar();
}
