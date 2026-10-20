// GPS del recorrido con Transistorsoft Background Geolocation (licencia «Starter»).
// Más estable que expo-location con la pantalla apagada o la app cerrada: sigue registrando aunque
// la tía cierre la app (stopOnTerminate: false) y retoma tras reiniciar el teléfono.
// Solo se usa si el APK se compiló con la licencia (EXPO_PUBLIC_GPS_TRANSISTOR=1); si no, la app
// usa expo-location (ver seguimiento.ts). El envío al servidor es el mismo en los dos casos: la
// cola SQLite propia (no el HTTP del SDK, que renovaría la sesión de Supabase por su cuenta).
import type { Location as LocacionTs } from "react-native-background-geolocation";
import { t } from "../lib/idioma";

export const GPS_TRANSISTOR = process.env.EXPO_PUBLIC_GPS_TRANSISTOR === "1";

/** Lectura en la forma que usa el resto de la app (la de expo-location). */
export interface Lectura {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null };
}

type AlLeer = (lecturas: Lectura[]) => Promise<void>; // i18n-ignorar: tipo, no texto
type Modulo = typeof import("react-native-background-geolocation").default;
let modulo: Modulo | null = null;
/** Se carga solo cuando se usa: sin la licencia, el módulo nativo ni se toca. */
function bg(): Modulo {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  modulo ??= (require("react-native-background-geolocation") as { default: Modulo }).default;
  return modulo;
}

export function aLectura(l: LocacionTs): Lectura {
  const c = l.coords;
  return {
    timestamp: typeof l.timestamp === "number" ? l.timestamp : Date.parse(l.timestamp),
    coords: {
      latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy ?? null,
      speed: c.speed !== undefined && c.speed >= 0 ? c.speed : null,
      heading: c.heading !== undefined && c.heading >= 0 ? c.heading : null,
    },
  };
}

let listo = false;
let suscripcion: { remove(): void } | null = null;

/** Configura el SDK una vez y conecta las lecturas a `alLeer` (con la app abierta o en segundo plano). */
async function preparar(alLeer: AlLeer): Promise<void> {
  const BG = bg();
  suscripcion?.remove();
  suscripcion = BG.onLocation((l) => { alLeer([aLectura(l)]).catch(() => {}); }, () => {});
  if (listo) return;
  await BG.ready({
    reset: true,
    geolocation: {
      desiredAccuracy: BG.DesiredAccuracy.High,
      distanceFilter: 20,
      locationUpdateInterval: 10_000,
      fastestLocationUpdateInterval: 5_000,
      activityType: BG.ActivityType.AutomotiveNavigation,
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Los permisos los pide la app antes (con su propio aviso, que exige Google Play).
      locationAuthorizationRequest: "Always",
      disableLocationAuthorizationAlert: true,
    },
    // Un furgón se detiene en semáforos y paradas: sin «modo detenido», no deja de enviar.
    // Sin sensores de movimiento: no hace falta el permiso de «actividad física».
    activity: { disableStopDetection: true, stopOnStationary: false, disableMotionActivityUpdates: true },
    app: {
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      heartbeatInterval: 60,
      notification: {
        title: t("Recorrido en curso"),
        text: t("Compartiendo la ubicación del furgón con los apoderados del recorrido."),
        color: "#F5B700",
        sticky: true,
      },
    },
    // Las posiciones se guardan en la cola propia; el SDK no necesita guardar copia.
    persistence: { persistMode: BG.PersistMode.None, maxDaysToPersist: 1 },
    logger: { debug: false, logLevel: BG.LogLevel.Off },
  });
  listo = true;
}

export async function iniciarTransistor(alLeer: AlLeer): Promise<void> {
  await preparar(alLeer);
  const BG = bg();
  await BG.start();
  await BG.changePace(true); // empieza a registrar de inmediato, sin esperar a detectar movimiento
}

export async function detenerTransistor(): Promise<void> {
  if (!modulo && !GPS_TRANSISTOR) return;
  await bg().stop().catch(() => {});
}

export async function transistorActivo(): Promise<boolean> {
  try {
    return (await bg().getState()).enabled;
  } catch {
    return false;
  }
}

/** Reconecta las lecturas al abrir la app si el GPS ya venía funcionando (p. ej. tras reiniciar). */
export async function reconectarTransistor(alLeer: AlLeer): Promise<void> {
  await preparar(alLeer);
}

/**
 * Lecturas que llegan con la app cerrada (Android la despierta sin pantalla). Debe registrarse
 * al cargar el código de la app (lo hace ubicacion/tarea.ts).
 */
export function registrarTareaCerrada(alLeer: AlLeer): void {
  bg().registerHeadlessTask(async (evento) => {
    if (evento.name === "location") await alLeer([aLectura(evento.params as LocacionTs)]);
  });
}
