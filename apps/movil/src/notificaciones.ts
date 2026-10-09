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
export async function registrarParaPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // los emuladores no reciben push
  await configurarCanales();
  await configurarLlamadas();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }));
  }
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Falta EAS_PROJECT_ID para obtener el token de push");
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.rpc("registrar_dispositivo", { p_token: token, p_plataforma: Platform.OS });
  return token;
}
