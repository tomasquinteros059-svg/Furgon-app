import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla } from "../componentes/ui";
import { mensajeError, supabase } from "../lib/supabase";
import { EnlacePrivacidad } from "../componentes/privacidad";

export default function Ingresar() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingresar() {
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setCargando(false);
    if (error) setError(mensajeError(error));
  }

  return (
    <Pantalla>
      <View style={{ alignItems: "center", marginVertical: 32 }}>
        <Text style={{ fontSize: 56 }}>🚐</Text>
        <Text style={[estilos.titulo, { marginTop: 8 }]}>Furgón Escolar</Text>
        <Text style={estilos.textoSuave}>Avisos automáticos de llegada</Text>
      </View>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      <Campo etiqueta="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <Boton titulo="Ingresar" onPress={ingresar} cargando={cargando} deshabilitado={!email || !password} />
      <View style={{ marginTop: 28, gap: 8 }}>
        <Text style={[estilos.textoSuave, { textAlign: "center" }]}>¿La mamá o el papá te compartió a los hijos?</Text>
        <Boton titulo="👨‍👩‍👧 Entrar con código de familia" variante="secundario" grande onPress={() => router.push("/entrar-codigo")} />
      </View>
      <Link href="/registro" style={{ marginTop: 20, textAlign: "center", color: colores.azul, fontWeight: "600" }}>
        ¿Tienes un código de invitación? Crea tu cuenta
      </Link>
      <EnlacePrivacidad />
    </Pantalla>
  );
}
