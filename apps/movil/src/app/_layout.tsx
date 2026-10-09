// La tarea de GPS debe definirse en el ámbito global, antes de montar cualquier pantalla.
import "../ubicacion/tarea";
import { alRecibir, alResponder } from "../llamadas-app";

import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ProveedorTema } from "../componentes/tema";
import { ProveedorIdioma } from "../i18n";
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
    <ProveedorTema>
      <ProveedorIdioma>
        <ProveedorSesion>
          <Navegacion />
        </ProveedorSesion>
      </ProveedorIdioma>
    </ProveedorTema>
  );
}
