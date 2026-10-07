import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../componentes/ui";
import { normalizarTelefono } from "../lib/core";
import { mensajeError, supabase } from "../lib/supabase";

const NOMBRE_ROL = { apoderado: "apoderado", conductor: "conductor", admin: "administrador" } as const;

export default function Registro() {
  const [codigo, setCodigo] = useState("");
  // Familias sin código: crean su cuenta y después se conectan con su tía o tío desde la búsqueda.
  const [sinCodigo, setSinCodigo] = useState(false);
  const [invitacion, setInvitacion] = useState<{ rol: keyof typeof NOMBRE_ROL; empresa: string } | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valida el código mientras se escribe, para mostrar a qué furgón y con qué rol se unirá.
  useEffect(() => {
    setInvitacion(null);
    if (codigo.trim().length < 6) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
      setInvitacion((data as { rol: keyof typeof NOMBRE_ROL; empresa: string }[] | null)?.[0] ?? null);
    }, 400);
    return () => clearTimeout(t);
  }, [codigo]);

  async function registrar() {
    setError(null);
    const tel = normalizarTelefono(telefono);
    if (!tel) return setError("Revisa el teléfono (ej: 9 1234 5678).");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: sinCodigo
          ? { sin_codigo: "familia", nombre: nombre.trim(), telefono: tel }
          : { codigo_invitacion: codigo.trim().toUpperCase(), nombre: nombre.trim(), telefono: tel },
      },
    });
    setCargando(false);
    if (error) return setError(mensajeError(error));
    router.replace("/");
  }

  return (
    <Pantalla titulo="Crear cuenta">
      <Text style={[estilos.textoSuave, { marginBottom: 16 }]}>
        {sinCodigo
          ? "Creas tu cuenta como familia. Después buscas a tu tía o tío del furgón y te conectas con un toque."
          : "Si el furgón te dio un código de invitación, escríbelo: define si te registras como apoderado o conductor."}
      </Text>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {sinCodigo ? (
        <Boton titulo="Tengo un código de invitación" variante="texto" onPress={() => setSinCodigo(false)} />
      ) : (
        <>
          <Campo etiqueta="Código de invitación" value={codigo} onChangeText={setCodigo} autoCapitalize="characters" />
          <Boton titulo="Soy familia y no tengo código" variante="texto" onPress={() => { setSinCodigo(true); setCodigo(""); }} />
        </>
      )}
      {sinCodigo ? null : invitacion ? (
        <Aviso tipo="exito" texto={`Te unirás a "${invitacion.empresa}" como ${NOMBRE_ROL[invitacion.rol]}.`} />
      ) : codigo.trim().length >= 6 ? (
        <Aviso tipo="error" texto="Código no válido o vencido." />
      ) : null}
      <Campo etiqueta="Nombre y apellido" value={nombre} onChangeText={setNombre} autoComplete="name" />
      <Campo etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678" />
      <Campo etiqueta="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry ayuda="Mínimo 8 caracteres" />
      <Boton
        titulo="Crear cuenta"
        onPress={registrar}
        cargando={cargando}
        deshabilitado={(!sinCodigo && !invitacion) || !nombre || !email || !password}
      />
      <Boton titulo="Ya tengo cuenta" variante="texto" onPress={() => router.back()} />
    </Pantalla>
  );
}
