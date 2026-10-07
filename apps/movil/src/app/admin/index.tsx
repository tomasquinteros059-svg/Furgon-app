// La administración (alumnos, rutas, conductoras, cobros, solicitudes) se hace en la app web
// (apps/admin). La app móvil es para la tía o el tío del furgón y para las familias.
import { Linking, Text } from "react-native";
import { Aviso, Boton, estilos, Pantalla } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL ?? "";

export default function AdminEnLaWeb() {
  const { perfil, cerrarSesion } = useSesion();
  return (
    <Pantalla titulo={`Hola, ${perfil?.nombre.split(" ")[0] ?? ""}`}>
      <Text style={estilos.texto}>
        La administración del furgón se hace en el panel web, desde el computador o el navegador del teléfono.
      </Text>
      <Aviso texto="Esta app es para la tía o el tío del furgón y para las familias." />
      {PANEL_URL ? <Boton titulo="Abrir el panel web" onPress={() => Linking.openURL(PANEL_URL)} /> : null}
      <Boton titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
    </Pantalla>
  );
}
