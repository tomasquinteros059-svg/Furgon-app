import type { ConfigContext, ExpoConfig } from "expo/config";

// Las claves llegan por variables de entorno (archivo apps/movil/.env o EAS env vars).
// Solo valores PÚBLICOS: la clave anon de Supabase y la clave de Maps restringida a la app.
const GOOGLE_MAPS_ANDROID = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "";
const GOOGLE_MAPS_IOS = process.env.GOOGLE_MAPS_IOS_API_KEY ?? "";
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Furgón Escolar",
  slug: "furgon-escolar",
  scheme: "furgonapp",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "cl.furgonapp.movil",
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ["location", "remote-notification"],
      // Para abrir la navegación en la app de Google Maps si está instalada.
      LSApplicationQueriesSchemes: ["comgooglemaps"],
    },
    entitlements: {
      // Permite que el aviso atraviese el modo Concentración (iOS 15+).
      "com.apple.developer.usernotifications.time-sensitive": true,
    },
  },
  android: {
    package: "cl.furgonapp.movil",
    adaptiveIcon: {
      backgroundColor: "#F2B705",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: ["POST_NOTIFICATIONS", "ACCESS_NOTIFICATION_POLICY"],
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Durante el recorrido, el furgón comparte su ubicación con los apoderados para avisarles cuando está por llegar. Solo mientras hay un recorrido activo.",
        locationWhenInUsePermission:
          "Usamos tu ubicación para ubicar el pin de tu casa y, si eres conductor, para avisar a los apoderados.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#F2B705",
        sounds: ["./assets/sonidos/alarma.wav"],
        // Despierta la app al llegar la llamada gratis, para acusar recibo sin abrirla.
        enableBackgroundRemoteNotifications: true,
      },
    ],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID,
        iosGoogleMapsApiKey: GOOGLE_MAPS_IOS,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        backgroundColor: "#F2B705",
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
  },
});
