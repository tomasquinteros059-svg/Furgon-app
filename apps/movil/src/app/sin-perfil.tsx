import { router } from "expo-router";
import { Text } from "../componentes/icono";
import { Boton, estilos, Pantalla } from "../componentes/ui";
import { useSesion } from "../lib/sesion";
import { EnlacePrivacidad } from "../componentes/privacidad";
import { t } from "../lib/idioma";

export default function SinPerfil() {
  const { cerrarSesion, recargarPerfil } = useSesion();
  return (
    <Pantalla titulo={t("Cuenta sin perfil")}>
      <Text style={[estilos.texto, { marginBottom: 16 }]}>
        {t("Tu cuenta existe, pero no está asociada a ningún furgón. Pide al administrador un código de invitación y regístrate con él, o vuelve a intentarlo si ya te lo asignaron.")}
      </Text>
      <Boton titulo={t("Reintentar")} onPress={recargarPerfil} />
      <Boton titulo={t("Cerrar sesión")} variante="secundario" onPress={cerrarSesion} />
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
      <EnlacePrivacidad />
    </Pantalla>
  );
}
