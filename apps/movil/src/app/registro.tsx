import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../componentes/ui";
import { normalizarTelefono } from "../lib/core";
import { mensajeError, supabase } from "../lib/supabase";
import { EnlacePrivacidad } from "../componentes/privacidad";
import { t } from "../lib/idioma";
import { nombreDeFamilia } from "../lib/familia";

const NOMBRE_ROL = { apoderado: "apoderado", conductor: "conductor", admin: "administrador" } as const;
/** Rol en palabras, en el idioma actual. */
const nombreRol = (rol: keyof typeof NOMBRE_ROL) => ({ apoderado: t("apoderado"), conductor: t("conductor"), admin: t("administrador") })[rol];

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
    if (codigo.trim().length < 8) return; // los códigos tienen 8 o 9 caracteres
    let vigente = true;
    const espera = setTimeout(async () => {
      const { data, error: e } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
      if (!vigente) return; // ya se escribió otro código
      if (e) { setError(mensajeError(e)); return; }
      setError(null);
      setInvitacion((data as { rol: keyof typeof NOMBRE_ROL; empresa: string }[] | null)?.[0] ?? null);
    }, 600);
    return () => { vigente = false; clearTimeout(espera); };
  }, [codigo]);

  async function registrar() {
    setError(null);
    const tel = normalizarTelefono(telefono);
    if (!tel) return setError(t("Revisa el teléfono (ej: 9 1234 5678)."));
    if (password.length < 8) return setError(t("La contraseña debe tener al menos 8 caracteres."));
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
    <Pantalla titulo={t("Crear cuenta")}>
      <Text style={[estilos.textoSuave, { marginBottom: 16 }]}>
        {sinCodigo
          ? t("Creas tu cuenta como familia. Después buscas a tu tía o tío del furgón y te conectas con un toque.")
          : t("Si el furgón te dio un código de invitación, escríbelo: define si te registras como apoderado o conductor.")}
      </Text>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {sinCodigo ? (
        <Boton titulo={t("Tengo un código de invitación")} variante="texto" onPress={() => setSinCodigo(false)} />
      ) : (
        <>
          <Campo etiqueta={t("Código de invitación")} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" />
          <Boton titulo={t("Soy familia y no tengo código")} variante="texto" onPress={() => { setSinCodigo(true); setCodigo(""); }} />
        </>
      )}
      {sinCodigo ? null : invitacion ? (
        <Aviso tipo="exito" texto={t(`Te unirás a "{empresa}" como {rol}.`, { empresa: nombreDeFamilia(invitacion.empresa), rol: nombreRol(invitacion.rol) })} />
      ) : codigo.trim().length >= 6 ? (
        <Aviso tipo="error" texto={t("Código no válido o vencido.")} />
      ) : null}
      <Campo etiqueta={t("Nombre y apellido")} value={nombre} onChangeText={setNombre} autoComplete="name" />
      <Campo etiqueta={t("Teléfono")} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678" />
      <Campo etiqueta={t("Correo")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Campo etiqueta={t("Contraseña")} value={password} onChangeText={setPassword} secureTextEntry ayuda={t("Mínimo 8 caracteres")} />
      <Boton
        titulo={t("Crear cuenta")}
        onPress={registrar}
        cargando={cargando}
        deshabilitado={(!sinCodigo && !invitacion) || !nombre || !email || !password}
      />
      <Boton titulo={t("Ya tengo cuenta")} variante="texto" onPress={() => router.back()} />
      <Text style={[estilos.textoSuave, { textAlign: "center" }]}>{t("Al crear tu cuenta aceptas los términos y condiciones, y que tratemos tus datos y los de tus hijos para el transporte escolar según la política de privacidad.")}</Text>
      <EnlacePrivacidad />
    </Pantalla>
  );
}
