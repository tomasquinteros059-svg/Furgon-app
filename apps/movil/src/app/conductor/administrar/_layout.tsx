// Administración desde la app de la tía: solo con permiso y nunca durante un recorrido.
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Aviso, Boton, colores, estilos, Pantalla } from "../../../componentes/ui";
import { useSesion } from "../../../lib/sesion";
import { supabase } from "../../../lib/supabase";

export default function LayoutAdministrar() {
  const { perfil } = useSesion();
  const [manejando, setManejando] = useState<boolean | null>(null);
  useEffect(() => {
    const revisar = async () => {
      const { data } = await supabase.from("recorridos").select("id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? "");
      setManejando((data ?? []).length > 0);
    };
    revisar();
    const t = setInterval(revisar, 20_000);
    return () => clearInterval(t);
  }, [perfil?.id]);

  if (!perfil?.puede_administrar) {
    return (
      <Pantalla titulo="Administración">
        <Aviso tipo="error" texto="Tu cuenta no tiene permiso para administrar. Pídeselo al administrador principal." />
        <Boton titulo="Volver" variante="secundario" onPress={() => router.back()} />
      </Pantalla>
    );
  }
  if (manejando) {
    return (
      <Pantalla titulo="Administración">
        <Aviso texto="Tienes un recorrido en curso. La administración se abre cuando lo termines: no se administra manejando." />
        <Text style={estilos.textoSuave}>Los avisos a las familias siguen funcionando solos.</Text>
        <Boton titulo="Volver al recorrido" onPress={() => router.back()} />
      </Pantalla>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />;
}
