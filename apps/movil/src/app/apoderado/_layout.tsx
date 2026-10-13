import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { BarraInferior, type Pestana } from "../../componentes/barra-inferior";
import { colores } from "../../componentes/ui";
import { t } from "../../lib/idioma";

export default function Layout() {
  const ruta = usePathname();
  const pestanas: Pestana[] = [
    { titulo: t("Inicio"), icono: "casa", ruta: "/apoderado", exacta: true },
    { titulo: t("Pagos"), icono: "tarjeta", ruta: "/apoderado/pagos" },
    { titulo: t("Mensajes"), icono: "mensaje", ruta: "/apoderado/ayuda" },
    { titulo: t("Familia"), icono: "familia", ruta: "/apoderado/familia" },
    { titulo: t("Mi furgón"), icono: "conexion", ruta: "/apoderado/conectar" },
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
