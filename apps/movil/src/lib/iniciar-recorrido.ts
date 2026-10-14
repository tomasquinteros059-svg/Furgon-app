// Iniciar un recorrido desde cualquier pantalla de la tía (Inicio o Rutas): primero los permisos
// de ubicación, así no queda un recorrido iniciado sin GPS; después abre la pantalla del recorrido.
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { iniciarSeguimiento, pedirPermisosUbicacion } from "../ubicacion/seguimiento";
import { t } from "./idioma";
import { mensajeError, supabase } from "./supabase";

export function useIniciarRecorrido(alError: (mensaje: string) => void) {
  const [iniciando, setIniciando] = useState<string | null>(null);

  async function iniciar(rutaId: string) {
    setIniciando(rutaId);
    try {
      const permisos = await pedirPermisosUbicacion();
      if (!permisos.ok) {
        Alert.alert(t("Permiso de ubicación"), permisos.mensaje);
        return;
      }
      const { data: recorridoId, error } = await supabase.rpc("iniciar_recorrido", { p_ruta: rutaId });
      if (error) throw error;
      const gps = await iniciarSeguimiento(recorridoId as string);
      if (!gps.ok) {
        Alert.alert(t("Permiso de ubicación"), gps.mensaje);
        return;
      }
      router.push(`/conductor/recorrido/${recorridoId}`);
    } catch (e) {
      alError(mensajeError(e));
    } finally {
      setIniciando(null);
    }
  }

  return { iniciando, iniciar };
}
