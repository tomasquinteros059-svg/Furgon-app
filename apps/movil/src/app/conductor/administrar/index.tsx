import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../../componentes/icono";
import { Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";
import { locale, t } from "../../../lib/idioma";

interface Resumen { alumnos_activos: number; alumnos_sin_ruta: number; familias_sin_app: number; por_cobrar_mes: number; morosos: number; solicitudes_abiertas: number }
const pesos = (n: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

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
    <Pantalla titulo={t("Administración")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {opcion(t("👧 Alumnos"), r ? [
        r.alumnos_activos === 1 ? t("1 activo") : t("{n} activos", { n: r.alumnos_activos }),
        ...(r.familias_sin_app === 1 ? [t("1 familia sin la app")] : r.familias_sin_app ? [t("{n} familias sin la app", { n: r.familias_sin_app })] : []),
      ].join(" · ") : "…", "/conductor/administrar/alumnos")}
      {opcion(t("🗺️ Rutas"), r?.alumnos_sin_ruta === 1 ? t("1 alumno sin ruta") : r?.alumnos_sin_ruta ? t("{n} alumnos sin ruta", { n: r.alumnos_sin_ruta }) : t("Ruta recomendada, orden y «hoy no va»"), "/conductor/administrar/rutas", !!r?.alumnos_sin_ruta)}
      {opcion(t("💳 Cobros"), r ? [
        t("{monto} por cobrar este mes · precios", { monto: pesos(r.por_cobrar_mes) }),
        ...(r.morosos === 1 ? [t("1 vencido")] : r.morosos ? [t("{n} vencidos", { n: r.morosos })] : []),
      ].join(" · ") : "…", "/conductor/administrar/cobros", !!r?.morosos)}
      {opcion(t("💬 Solicitudes"), r ? (r.solicitudes_abiertas ? t("{n} sin responder", { n: r.solicitudes_abiertas }) : t("Todo respondido")) : "…", "/conductor/administrar/solicitudes", !!r?.solicitudes_abiertas)}
      <View style={{ marginTop: 8 }}>
        <Text style={estilos.textoSuave}>{t("También puedes entrar al panel web de administración con esta misma cuenta.")}</Text>
      </View>
    </Pantalla>
  );
}
