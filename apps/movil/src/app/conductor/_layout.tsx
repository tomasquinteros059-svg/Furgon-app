import { Stack, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { BarraInferior, type Pestana } from "../../componentes/barra-inferior";
import { colores } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

export default function Layout() {
  const { perfil } = useSesion();
  const ruta = usePathname();
  const [conexiones, setConexiones] = useState(0);
  const [solicitudes, setSolicitudes] = useState(0);

  // Puntos rojos de la barra: familias esperando conexión y consultas sin responder.
  useEffect(() => {
    supabase.rpc("mis_conexiones").then(({ data }) =>
      setConexiones(((data as { estado: string; iniciada_por: string }[] | null) ?? [])
        .filter((x) => x.estado === "pendiente" && x.iniciada_por === "apoderado").length));
    if (perfil?.puede_administrar) {
      supabase.rpc("resumen_admin").then(({ data }) => setSolicitudes((data as { solicitudes_abiertas?: number } | null)?.solicitudes_abiertas ?? 0));
    }
  }, [ruta, perfil?.puede_administrar]);

  // Como el diseño «Trazo y relleno»: Hoy, Rutas, Alumnos, Mensajes y Más (lo demás).
  // Rutas, Alumnos y Mensajes son de administración: sin ese permiso quedan Hoy y Más.
  const pestanas: Pestana[] = [
    { titulo: t("Hoy"), icono: "casa", ruta: "/conductor", exacta: true },
    ...(perfil?.puede_administrar ? [
      { titulo: t("Rutas"), icono: "ruta", ruta: "/conductor/administrar/rutas" },
      { titulo: t("Alumnos"), icono: "alumno", ruta: "/conductor/administrar/alumnos" },
      { titulo: t("Mensajes"), icono: "mensaje", ruta: "/conductor/administrar/solicitudes", punto: solicitudes > 0 },
    ] as Pestana[] : []),
    { titulo: t("Más"), icono: "menu", ruta: "/conductor/mas", punto: conexiones > 0 },
  ];

  // Durante el recorrido no hay barra: la pantalla queda solo para manejar.
  const conBarra = !ruta.startsWith("/conductor/recorrido");
  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
      </View>
      {conBarra ? <BarraInferior pestanas={pestanas} /> : null}
    </View>
  );
}
