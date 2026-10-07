// «Entrar con código de familia»: el papá (o la mamá, abuelo/a) escribe el código que le
// compartieron, su nombre y su teléfono, y entra directo al perfil compartido. Sin correo
// ni contraseña: después la app le sugiere protegerla (apoderado/proteger-cuenta).
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../componentes/ui";
import { normalizarTelefono } from "../lib/core";
import { mensajeError, supabase } from "../lib/supabase";

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
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
      const fila = (data as { rol: string; empresa: string }[] | null)?.find((x) => x.rol === "apoderado");
      setFamilia(fila ? fila.empresa : null); setRevisado(true);
    }, 400);
    return () => clearTimeout(t);
  }, [codigo]);

  async function entrar() {
    setError(null);
    const tel = normalizarTelefono(telefono);
    if (!tel) return setError("Revisa tu teléfono (ej: 9 1234 5678): lo usamos para la llamada automática.");
    setCargando(true);
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { codigo_invitacion: codigo.trim().toUpperCase(), nombre: nombre.trim(), telefono: tel } },
    });
    setCargando(false);
    if (error) return setError(mensajeError(error));
    router.replace("/");
  }

  return (
    <Pantalla titulo="Entrar con código">
      <Text style={[estilos.textoSuave, { marginBottom: 16 }]}>
        Escribe el código que te compartió la mamá o el papá. Entrarás directo a la familia: verás a los mismos hijos y recibirás los
        avisos del furgón en este teléfono.
      </Text>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      <Campo etiqueta="Código de familia" value={codigo} onChangeText={setCodigo} autoCapitalize="characters" placeholder="F1A2B3C4" />
      {familia ? <Aviso tipo="exito" texto={`Te unirás a ${familia}.`} /> : revisado ? <Aviso tipo="error" texto="Código no válido, vencido o ya usado." /> : null}
      <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} autoComplete="name" placeholder="Ej: Rodrigo Pérez" />
      <Campo etiqueta="Tu teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678"
        ayuda="Para llamarte si no contestan el aviso." />
      <Boton titulo="Entrar" onPress={entrar} cargando={cargando} deshabilitado={!familia || !nombre.trim() || !telefono.trim()} />
      <Boton titulo="Ya tengo cuenta" variante="texto" onPress={() => router.back()} />
    </Pantalla>
  );
}
