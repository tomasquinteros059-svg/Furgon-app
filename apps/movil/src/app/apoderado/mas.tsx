// Pestaña «Más» de la familia: perfil, compartir con papá o mamá, el furgón, registrar a un hijo,
// apariencia, idioma y la cuenta.
import { router } from "expo-router";
import { Alert } from "react-native";
import { Avatar } from "../../componentes/avatar";
import { Icono, Text } from "../../componentes/icono";
import { EnlacePrivacidad } from "../../componentes/privacidad";
import { SelectorTema } from "../../componentes/tema";
import { Boton, colores, estilos, FilaMenu, Pantalla, Tarjeta } from "../../componentes/ui";
import { SelectorIdioma } from "../../i18n";
import { useSesion } from "../../lib/sesion";
import { t } from "../../lib/idioma";

export default function MasFamilia() {
  const { perfil, sesion, cerrarSesion } = useSesion();
  const sinProteger = !!sesion?.user.is_anonymous;
  const icono = (n: Parameters<typeof Icono>[0]["nombre"]) => <Icono nombre={n} tam={26} color={colores.texto} />;

  function salir() {
    if (!sinProteger) return cerrarSesion();
    Alert.alert(t("¿Salir sin proteger tu cuenta?"), t("Entraste con un código: si sales ahora, no podrás volver a entrar. Protégela primero con tu correo."), [
      { text: t("Proteger mi cuenta"), onPress: () => router.push("/apoderado/proteger-cuenta") },
      { text: t("Salir igual"), style: "destructive", onPress: cerrarSesion },
    ]);
  }

  return (
    <Pantalla titulo={t("Más")}>
      <FilaMenu titulo={perfil?.nombre ?? ""} detalle={t("Mi perfil y foto")} onPress={() => router.push("/perfil")}
        izquierda={<Avatar nombre={perfil?.nombre ?? ""} foto={perfil?.foto} tam={48} />} />
      <FilaMenu titulo={t("Mi furgón")} detalle={t("Tu tía o tío y la conexión")} izquierda={icono("furgon")} onPress={() => router.push("/apoderado/conectar")} />
      <FilaMenu titulo={t("Familia")} detalle={t("Compartir con papá o mamá")} izquierda={icono("familia")} onPress={() => router.push("/apoderado/familia")} />
      {perfil?.empresa_id ? (
        <FilaMenu titulo={t("Registrar alumno")} detalle={t("Agrega a otro hijo o hija")} izquierda={icono("alumno")} onPress={() => router.push("/apoderado/nuevo-alumno")} />
      ) : null}
      <Text style={[estilos.subtitulo, { marginTop: 10 }]}>{t("Apariencia")}</Text>
      <Tarjeta><SelectorTema /></Tarjeta>
      <Tarjeta><SelectorIdioma /></Tarjeta>
      <EnlacePrivacidad />
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
      <Boton titulo={t("Salir")} variante="contornoPeligro" onPress={salir} />
    </Pantalla>
  );
}
