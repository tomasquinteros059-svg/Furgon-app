import { router } from "expo-router";
// La administración (alumnos, rutas, conductoras, cobros, solicitudes) se hace en la app web
// (apps/admin). La app móvil es para la tía o el tío del furgón y para las familias.
import { Linking } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { SelectorTema } from "../../componentes/tema";
import { EnlacePrivacidad } from "../../componentes/privacidad";
import { SelectorIdioma } from "../../i18n";
import { t } from "../../lib/idioma";

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL ?? "";

export default function AdminEnLaWeb() {
  const { perfil, cerrarSesion } = useSesion();
  return (
    <Pantalla titulo={t("Hola, {nombre}", { nombre: perfil?.nombre.split(" ")[0] ?? "" })}>
      <Text style={estilos.texto}>
        {t("La administración del furgón se hace en el panel web, desde el computador o el navegador del teléfono.")}
      </Text>
      <Aviso texto={t("Esta app es para la tía o el tío del furgón y para las familias.")} />
      {PANEL_URL ? <Boton titulo={t("Abrir el panel web")} onPress={() => Linking.openURL(PANEL_URL)} /> : null}
      <Boton titulo={t("Cerrar sesión")} variante="secundario" onPress={cerrarSesion} />
      <Tarjeta><SelectorTema /></Tarjeta>
      <Tarjeta><SelectorIdioma /></Tarjeta>
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
      <EnlacePrivacidad />
    </Pantalla>
  );
}
