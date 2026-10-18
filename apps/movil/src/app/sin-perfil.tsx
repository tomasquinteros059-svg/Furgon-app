// Cuenta sin perfil: pasa al entrar con Google por primera vez (Google no trae teléfono ni código).
// Aquí se completa el registro como familia o con el código de invitación del furgón.
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../componentes/ui";
import { normalizarTelefono } from "../lib/core";
import { useSesion } from "../lib/sesion";
import { mensajeError, supabase } from "../lib/supabase";
import { EnlacePrivacidad } from "../componentes/privacidad";
import { t } from "../lib/idioma";

export default function SinPerfil() {
  const { sesion, cerrarSesion, recargarPerfil } = useSesion();
  const datos = (sesion?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const [nombre, setNombre] = useState(datos.full_name ?? datos.name ?? "");
  const [telefono, setTelefono] = useState("");
  const [conCodigo, setConCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completar() {
    setError(null);
    const tel = telefono.trim() ? normalizarTelefono(telefono) : null;
    if (telefono.trim() && !tel) return setError(t("Revisa el teléfono (ej: 9 1234 5678)."));
    if (nombre.trim().length < 2) return setError(t("Escribe tu nombre."));
    if (conCodigo && codigo.trim().length < 6) return setError(t("Escribe el código de invitación."));
    setCargando(true);
    const { error: e } = await supabase.rpc("completar_registro", { p_nombre: nombre.trim(), p_telefono: tel, p_codigo: conCodigo ? codigo.trim() : null });
    setCargando(false);
    if (e) return setError(mensajeError(e));
    await recargarPerfil();
    router.replace("/");
  }

  // Cuenta anónima («entrar con código de familia») sin perfil: el código no sirvió.
  if (sesion?.user.is_anonymous) {
    return (
      <Pantalla titulo={t("Cuenta sin perfil")}>
        <Text style={[estilos.texto, { marginBottom: 16 }]}>{t("El código no se pudo usar. Pide uno nuevo a la mamá o el papá y vuelve a entrar.")}</Text>
        <Boton titulo={t("Reintentar")} onPress={recargarPerfil} />
        <Boton titulo={t("Cerrar sesión")} variante="secundario" onPress={cerrarSesion} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo={t("Completa tu registro")}>
      <Text style={[estilos.textoSuave, { marginBottom: 16 }]}>
        {conCodigo
          ? t("Escribe el código que te dio el furgón: define si entras como tía o tío del furgón, o como familia.")
          : t("Te registras como familia. Después buscas a tu tía o tío del furgón y te conectas con un toque.")}
      </Text>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      <Campo etiqueta={t("Nombre y apellido")} value={nombre} onChangeText={setNombre} autoComplete="name" />
      <Campo etiqueta={t("Teléfono")} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678"
        ayuda={t("Para la llamada de aviso cuando el furgón está cerca.")} />
      {conCodigo ? <Campo etiqueta={t("Código de invitación")} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" /> : null}
      <Boton titulo={t("Crear mi cuenta")} grande cargando={cargando} onPress={completar} />
      <Boton titulo={conCodigo ? t("Soy familia y no tengo código") : t("Soy tía o tío del furgón / tengo un código")} variante="texto"
        onPress={() => { setConCodigo(!conCodigo); setError(null); }} />
      <Boton titulo={t("Cerrar sesión")} variante="texto" onPress={cerrarSesion} />
      <Text style={[estilos.textoSuave, { textAlign: "center" }]}>{t("Al crear tu cuenta aceptas los términos y condiciones, y que tratemos tus datos y los de tus hijos para el transporte escolar según la política de privacidad.")}</Text>
      <EnlacePrivacidad />
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
    </Pantalla>
  );
}
