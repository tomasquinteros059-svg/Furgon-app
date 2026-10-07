// La tarea de GPS debe definirse en el ámbito global, antes de montar cualquier pantalla.
import "../ubicacion/tarea";

import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ProveedorSesion, useSesion } from "../lib/sesion";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const { cargando, sesion, perfil } = useSesion();

  useEffect(() => {
    if (!cargando) SplashScreen.hide();
  }, [cargando]);

  // Tocar la notificación de aviso cuenta como "recibido": detiene los reintentos de llamada.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as { tipo?: string; avisoId?: string; alumnoId?: string };
      if (data?.tipo === "aviso" && data.avisoId) {
        supabase.rpc("confirmar_aviso", { p_aviso: data.avisoId }).then(() => {});
      }
      // El aviso abre directo el mapa en vivo; las demás notificaciones, el inicio.
      if (data?.tipo === "aviso" && data.alumnoId) router.navigate(`/apoderado/seguir/${data.alumnoId}`);
      else if (data?.tipo) router.navigate("/");
    });
    return () => sub.remove();
  }, []);

  if (cargando) return null;
  const rol = perfil?.rol;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="ingresar" />
        <Stack.Screen name="registro" />
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
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Navegacion />
    </ProveedorSesion>
  );
}
