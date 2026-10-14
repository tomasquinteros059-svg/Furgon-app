// Notificaciones push: canal de ALARMA para el aviso de llegada y canal general.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "./lib/idioma";
import { supabase } from "./lib/supabase";
import { configurarLlamadas } from "./llamadas-app";

// Deben coincidir con supabase/functions/_shared/push.ts
export const CANAL_ALARMA = "aviso-furgon";
export const CANAL_GENERAL = "general";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configurarCanales(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Ojo: el sonido de un canal no se puede cambiar después de creado. Si cambias
  // el sonido, cambia también el id del canal (aquí y en el backend).
  await Notifications.setNotificationChannelAsync(CANAL_ALARMA, {
    name: t("Aviso de llegada del furgón"),
    description: t("Alarma cuando el furgón está a pocos minutos de tu casa"),
    importance: Notifications.AndroidImportance.MAX,
    sound: "alarma.wav",
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });
  await Notifications.setNotificationChannelAsync(CANAL_GENERAL, {
    name: t("Novedades del recorrido"),
    description: t("Alumno en su hogar, ausente y otras novedades"),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Pide permiso, obtiene el token de Expo y lo asocia al usuario en el backend. */
let tokenRegistrado: string | null = null;
/** Si este teléfono recibe avisos del servidor (push). Si no, la app hace sonar la alarma sola. */
export const tienePush = () => tokenRegistrado !== null;

/** Alarma local del aviso de llegada (respaldo cuando el teléfono no tiene push). */
export async function alarmaLocal(titulo: string, cuerpo: string, data: Record<string, unknown>): Promise<void> { // i18n-ignorar: tipos
  await configurarCanales();
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: cuerpo, data, sound: "alarma.wav", priority: Notifications.AndroidNotificationPriority.MAX },
    trigger: Platform.OS === "android" ? { channelId: CANAL_ALARMA } : null,
  });
}

/** Al cerrar sesión: este teléfono deja de recibir alarmas y llamadas de esa cuenta. */
export async function olvidarDispositivo(): Promise<void> {
  if (!tokenRegistrado) return;
  await supabase.from("dispositivos").delete().eq("expo_push_token", tokenRegistrado);
  tokenRegistrado = null;
}

export async function registrarParaPush(): Promise<string | null> {
  // Los emuladores no reciben push. La prueba en emulador (probar-apk.yml) igual recorre este camino.
  if (!Device.isDevice && process.env.EXPO_PUBLIC_PRUEBA_EMULADOR !== "1") return null;
  await configurarCanales();
  await configurarLlamadas();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }));
  }
  if (status !== "granted") return null;

  // Con proyecto de Expo: token de Expo. Sin él, en Android: token directo de Firebase («fcm:…»),
  // que el servidor envía por FCM v1 (supabase/functions/_shared/fcm.ts). Necesita que el APK
  // traiga google-services.json (secreto GOOGLE_SERVICES_JSON en GitHub).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  let token: string;
  if (projectId) {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } else if (Platform.OS === "android") {
    token = `fcm:${(await Notifications.getDevicePushTokenAsync()).data}`;
  } else {
    throw new Error("Falta EAS_PROJECT_ID para obtener el token de push");
  }
  await supabase.rpc("registrar_dispositivo", { p_token: token, p_plataforma: Platform.OS });
  tokenRegistrado = token;
  return token;
}
