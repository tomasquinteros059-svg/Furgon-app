import { router } from "expo-router";
import { Text } from "../componentes/icono";
import { Boton, estilos, Pantalla } from "../componentes/ui";
import { useSesion } from "../lib/sesion";

export default function SinPerfil() {
  const { cerrarSesion, recargarPerfil } = useSesion();
  return (
    <Pantalla titulo="Cuenta sin perfil">
      <Text style={[estilos.texto, { marginBottom: 16 }]}>
        Tu cuenta existe, pero no está asociada a ningún furgón. Pide al administrador un código de
        invitación y regístrate con él, o vuelve a intentarlo si ya te lo asignaron.
      </Text>
      <Boton titulo="Reintentar" onPress={recargarPerfil} />
      <Boton titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
      <Boton titulo="Eliminar mi cuenta" variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
    </Pantalla>
  );
}
