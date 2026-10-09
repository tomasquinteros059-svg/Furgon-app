// Enlaces a los Términos y Condiciones y a la Política de Privacidad, publicados con el panel web
// (Apple y Google los piden dentro de la app).
import { Linking, View } from "react-native";
import { t } from "../lib/idioma";
import { Boton } from "./ui";

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL?.replace(/\/$/, "");
export const URL_PRIVACIDAD = PANEL_URL ? `${PANEL_URL}/privacidad.html` : null;
export const URL_TERMINOS = PANEL_URL ? `${PANEL_URL}/terminos.html` : null;

export function EnlacePrivacidad() {
  if (!URL_PRIVACIDAD || !URL_TERMINOS) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
      <Boton titulo={t("Términos y condiciones")} variante="texto" onPress={() => Linking.openURL(URL_TERMINOS)} />
      <Boton titulo={t("Política de privacidad")} variante="texto" onPress={() => Linking.openURL(URL_PRIVACIDAD)} />
    </View>
  );
}
