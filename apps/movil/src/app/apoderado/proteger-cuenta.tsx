// Quien entró con código de familia (sesión anónima) agrega correo y contraseña para no
// perder la cuenta si cambia de teléfono o cierra sesión.
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../../componentes/ui";
import { mensajeError, supabase } from "../../lib/supabase";

export default function ProtegerCuenta() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  async function guardar() {
    setMsg(null);
    if (password.length < 8) return setMsg({ ok: false, txt: "La contraseña debe tener al menos 8 caracteres." });
    setCargando(true);
    const { data, error } = await supabase.auth.updateUser({ email: email.trim(), password });
    setCargando(false);
    if (error) return setMsg({ ok: false, txt: mensajeError(error) });
    setMsg({ ok: true, txt: data.user?.is_anonymous === false
      ? "Listo: tu cuenta quedó protegida. Puedes entrar con tu correo en cualquier teléfono."
      : "Te enviamos un correo para confirmar. Cuando lo confirmes, tu cuenta quedará protegida." });
  }

  return (
    <Pantalla titulo="Protege tu cuenta" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Text style={[estilos.textoSuave, { marginBottom: 12 }]}>
        Entraste con un código, así que tu cuenta solo vive en este teléfono. Agrega tu correo y una contraseña para no perderla si
        cambias de teléfono o cierras sesión.
      </Text>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}
      <Campo etiqueta="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry ayuda="Mínimo 8 caracteres" />
      <Boton titulo="Proteger mi cuenta" onPress={guardar} cargando={cargando} deshabilitado={!email.trim() || !password} />
    </Pantalla>
  );
}
