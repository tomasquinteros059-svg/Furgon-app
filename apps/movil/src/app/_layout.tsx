// La tarea de GPS debe definirse en el ámbito global, antes de montar cualquier pantalla.
import "../ubicacion/tarea";
import { alRecibir, alResponder } from "../llamadas-app";

import * as Notifications from "expo-notifications";
import { type ErrorBoundaryProps, router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ProveedorTema } from "../componentes/tema";
import { ProveedorIdioma } from "../i18n";
import { ProveedorSesion, useSesion } from "../lib/sesion";
import { supabase } from "../lib/supabase";
import { describirFalla, guardarFalla, tomarUltimaFalla, vigilarFallas } from "../lib/fallas";
import { t } from "../lib/idioma";

SplashScreen.preventAutoHideAsync();
vigilarFallas();

/** Pantalla con el error, en vez de cerrar la app. Colores fijos: puede fallar el propio tema. */
function PantallaFalla({ detalle, onReintentar, onCerrar }: { detalle: string; onReintentar?: () => void; onCerrar?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingTop: 56, paddingHorizontal: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#1B1F24" }}>{t("Algo falló en la app")}</Text>
      <Text style={{ fontSize: 15, color: "#4A5260" }}>{t("Toma una captura de esta pantalla y envíasela a quien te ayuda con la app. Así podemos arreglarlo.")}</Text>
      <ScrollView style={{ flex: 1, backgroundColor: "#F4F5F7", borderRadius: 10 }} contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ fontFamily: "monospace", fontSize: 12, color: "#1B1F24" }}>{detalle}</Text>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 10, paddingBottom: 32 }}>
        {onReintentar ? (
          <Pressable accessibilityRole="button" onPress={onReintentar} style={{ flex: 1, backgroundColor: "#F5B700", borderRadius: 12, padding: 14, alignItems: "center" }}>
            <Text style={{ fontWeight: "700", color: "#1B1F24" }}>{t("Reintentar")}</Text>
          </Pressable>
        ) : null}
        {onCerrar ? (
          <Pressable accessibilityRole="button" onPress={onCerrar} style={{ flex: 1, backgroundColor: "#F5B700", borderRadius: 12, padding: 14, alignItems: "center" }}>
            <Text style={{ fontWeight: "700", color: "#1B1F24" }}>{t("Continuar")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Error al dibujar cualquier pantalla (expo-router lo usa en lugar de cerrar la app). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    guardarFalla(error);
    SplashScreen.hide();
  }, [error]);
  return <PantallaFalla detalle={describirFalla(error)} onReintentar={retry} />;
}

function Navegacion() {
  const { cargando, sesion, perfil } = useSesion();
  // Si la app se cerró por un error la vez anterior, se muestra una vez al abrirla.
  const [fallaAnterior, setFallaAnterior] = useState(tomarUltimaFalla);

  useEffect(() => {
    if (!cargando) SplashScreen.hide();
  }, [cargando]);

  // Tocar la notificación de aviso cuenta como "recibido": detiene los reintentos de llamada.
  useEffect(() => {
    // Llamada gratis por la app recibida con la app abierta: se muestra la pantalla de llamada.
    const recibida = Notifications.addNotificationReceivedListener((n) => {
      alRecibir(n).catch(() => {});
    });
    const sub = Notifications.addNotificationResponseReceivedListener(async (r) => {
      if (await alResponder(r)) return;
      const data = r.notification.request.content.data as { tipo?: string; avisoId?: string; alumnoId?: string };
      if (data?.tipo === "aviso" && data.avisoId) {
        supabase.rpc("confirmar_aviso", { p_aviso: data.avisoId }).then(() => {});
      }
      // El aviso abre directo el mapa en vivo; las demás notificaciones, el inicio.
      if (data?.tipo === "aviso" && data.alumnoId) router.navigate(`/apoderado/seguir/${data.alumnoId}`);
      else if (data?.tipo === "licencia") router.navigate("/conductor/licencia");
      else if (data?.tipo) router.navigate("/");
    });
    return () => {
      sub.remove();
      recibida.remove();
    };
  }, []);

  if (cargando) return null;
  if (fallaAnterior) {
    return <PantallaFalla detalle={`${t("La última vez la app se cerró por este error:")}\n\n${fallaAnterior}`} onCerrar={() => setFallaAnterior(null)} />;
  }
  const rol = perfil?.rol;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="ingresar" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="entrar-codigo" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="eliminar-cuenta" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion && !perfil}>
        <Stack.Screen name="sin-perfil" />
      </Stack.Protected>
      <Stack.Protected guard={rol === "conductor"}>
        <Stack.Screen name="conductor" />
      </Stack.Protected>
      <Stack.Protected guard={rol === "apoderado"}>
        <Stack.Screen name="apoderado" />
      </Stack.Protected>
      <Stack.Protected guard={rol === "admin"}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // La sesión va por fuera: cambiar el tema o el idioma redibuja las pantallas, pero no vuelve
    // a cargar la sesión ni el perfil.
    <ProveedorSesion>
      <ProveedorTema>
        <ProveedorIdioma>
          <Navegacion />
        </ProveedorIdioma>
      </ProveedorTema>
    </ProveedorSesion>
  );
}
