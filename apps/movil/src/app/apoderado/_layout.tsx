import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { BarraInferior, type Pestana } from "../../componentes/barra-inferior";
import { colores } from "../../componentes/ui";
import { t } from "../../lib/idioma";

export default function Layout() {
  const ruta = usePathname();
  // Como el diseño «Trazo y relleno»: Hoy, Mensajes, Pagos y Más.
  const pestanas: Pestana[] = [
    { titulo: t("Hoy"), icono: "casa", ruta: "/apoderado", exacta: true },
    { titulo: t("Mensajes"), icono: "mensaje", ruta: "/apoderado/ayuda" },
    { titulo: t("Pagos"), icono: "tarjeta", ruta: "/apoderado/pagos" },
    { titulo: t("Más"), icono: "menu", ruta: "/apoderado/mas" },
  ];
  // En el mapa en vivo y en la llamada de aviso, pantalla completa sin barra.
  const conBarra = !ruta.startsWith("/apoderado/seguir") && !ruta.startsWith("/apoderado/llamada");
  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
      </View>
      {conBarra ? <BarraInferior pestanas={pestanas} /> : null}
    </View>
  );
}
