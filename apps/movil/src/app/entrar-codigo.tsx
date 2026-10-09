// «Entrar con código de familia»: el papá (o la mamá, abuelo/a) escribe el código que le
// compartieron, su nombre y su teléfono, y entra directo al perfil compartido. Sin correo
// ni contraseña: después la app le sugiere protegerla (apoderado/proteger-cuenta).
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../componentes/ui";
import { normalizarTelefono } from "../lib/core";
import { mensajeError, supabase } from "../lib/supabase";
import { EnlacePrivacidad } from "../componentes/privacidad";
import { t } from "../lib/idioma";

export default function EntrarConCodigo() {
  const [codigo, setCodigo] = useState("");
  const [familia, setFamilia] = useState<string | null>(null);
  const [revisado, setRevisado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Muestra de qué familia es el código mientras se escribe.
  useEffect(() => {
    setFamilia(null); setRevisado(false);
    if (codigo.trim().length < 6) return;
    const espera = setTimeout(async () => {
      const { data } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
      const fila = (data as { rol: string; empresa: string }[] | null)?.find((x) => x.rol === "apoderado");
      setFamilia(fila ? fila.empresa : null); setRevisado(true);
    }, 400);
    return () => clearTimeout(espera);
  }, [codigo]);

  async function entrar() {
    setError(null);
    const tel = normalizarTelefono(telefono);
    if (!tel) return setError(t("Revisa tu teléfono (ej: 9 1234 5678): lo usamos para la llamada automática."));
    setCargando(true);
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { codigo_invitacion: codigo.trim().toUpperCase(), nombre: nombre.trim(), telefono: tel } },
    });
    setCargando(false);
    if (error) return setError(mensajeError(error));
    router.replace("/");
  }

  return (
    <Pantalla titulo={t("Entrar con código")}>
      <Text style={[estilos.textoSuave, { marginBottom: 16 }]}>
        {t("Escribe el código que te compartió la mamá o el papá. Entrarás directo a la familia: verás a los mismos hijos y recibirás los avisos del furgón en este teléfono.")}
      </Text>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      <Campo etiqueta={t("Código de familia")} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" placeholder="F1A2B3C4" />
      {familia ? <Aviso tipo="exito" texto={t("Te unirás a {familia}.", { familia })} /> : revisado ? <Aviso tipo="error" texto={t("Código no válido, vencido o ya usado.")} /> : null}
      <Campo etiqueta={t("Tu nombre")} value={nombre} onChangeText={setNombre} autoComplete="name" placeholder={t("Ej: Rodrigo Pérez")} />
      <Campo etiqueta={t("Tu teléfono")} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678"
        ayuda={t("Para llamarte si no contestan el aviso.")} />
      <Boton titulo={t("Entrar")} onPress={entrar} cargando={cargando} deshabilitado={!familia || !nombre.trim() || !telefono.trim()} />
      <Boton titulo={t("Ya tengo cuenta")} variante="texto" onPress={() => router.back()} />
      <Text style={[estilos.textoSuave, { textAlign: "center" }]}>{t("Al entrar aceptas los términos y condiciones, y que tratemos tus datos para el transporte escolar según la política de privacidad.")}</Text>
      <EnlacePrivacidad />
    </Pantalla>
  );
}
