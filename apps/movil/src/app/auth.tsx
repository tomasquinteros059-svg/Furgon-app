// Dirección de vuelta de «Entrar con Google» (furgonapp://auth): la sesión la toma lib/google.ts;
// si Android abre esta ruta, solo vuelve al inicio.
import { Redirect } from "expo-router";

export default function VueltaDeGoogle() {
  return <Redirect href="/" />;
}
