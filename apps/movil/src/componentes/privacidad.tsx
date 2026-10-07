// Enlace a la política de privacidad publicada con el panel web (Apple y Google lo piden dentro de la app).
import { Linking } from "react-native";
import { Boton } from "./ui";

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL?.replace(/\/$/, "");
export const URL_PRIVACIDAD = PANEL_URL ? `${PANEL_URL}/privacidad.html` : null;

export function EnlacePrivacidad() {
  if (!URL_PRIVACIDAD) return null;
  return <Boton titulo="Política de privacidad" variante="texto" onPress={() => Linking.openURL(URL_PRIVACIDAD)} />;
}
