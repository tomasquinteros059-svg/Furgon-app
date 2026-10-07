import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";

interface Resumen { alumnos_activos: number; alumnos_sin_ruta: number; familias_sin_app: number; por_cobrar_mes: number; morosos: number; solicitudes_abiertas: number }
const pesos = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export default function MenuAdministrar() {
  const [r, setR] = useState<Resumen | null>(null);
  useFocusEffect(useCallback(() => { supabase.rpc("resumen_admin").then(({ data }) => setR(data as Resumen)); }, []));
  const opcion = (titulo: string, detalle: string, ruta: string, alerta = false) => (
    <Pressable onPress={() => router.push(ruta as never)} accessibilityRole="button">
      <Tarjeta estilo={alerta ? { borderColor: colores.rojo, borderWidth: 2 } : undefined}>
        <Text style={estilos.subtitulo}>{titulo}</Text>
        <Text style={estilos.textoSuave}>{detalle}</Text>
      </Tarjeta>
    </Pressable>
  );
  return (
    <Pantalla titulo="Administración" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {opcion("👧 Alumnos", r ? `${r.alumnos_activos} activos${r.familias_sin_app ? ` · ${r.familias_sin_app} familia(s) sin la app` : ""}` : "…", "/conductor/administrar/alumnos")}
      {opcion("🗺️ Rutas", r?.alumnos_sin_ruta ? `${r.alumnos_sin_ruta} alumno(s) sin ruta` : "Orden de las paradas", "/conductor/administrar/rutas", !!r?.alumnos_sin_ruta)}
      {opcion("💳 Cobros", r ? `${pesos(r.por_cobrar_mes)} por cobrar este mes${r.morosos ? ` · ${r.morosos} vencido(s)` : ""}` : "…", "/conductor/administrar/cobros", !!r?.morosos)}
      {opcion("💬 Solicitudes", r ? (r.solicitudes_abiertas ? `${r.solicitudes_abiertas} sin responder` : "Todo respondido") : "…", "/conductor/administrar/solicitudes", !!r?.solicitudes_abiertas)}
      <View style={{ marginTop: 8 }}>
        <Text style={estilos.textoSuave}>También puedes entrar al panel web de administración con esta misma cuenta.</Text>
      </View>
    </Pantalla>
  );
}
