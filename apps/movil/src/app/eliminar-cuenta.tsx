// Eliminar la cuenta desde la app (lo exigen Apple y Google). Muestra qué se borrará y
// pide escribir ELIMINAR para confirmar; la función «eliminar-cuenta» hace el resto.
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla, Tarjeta } from "../componentes/ui";
import { useSesion } from "../lib/sesion";
import { llamarFuncion, mensajeError, supabase } from "../lib/supabase";

interface Resumen { rol: "admin" | "conductor" | "apoderado" | null; borra_empresa: boolean; empresa: string | null; alumnos_borrados: number; familias_afectadas: number }
const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL;

export default function EliminarCuenta() {
  const { cerrarSesion } = useSesion();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [texto, setTexto] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("resumen_eliminacion").single<Resumen>().then(({ data }) => setResumen(data ?? null));
  }, []);

  async function eliminar() {
    setError(null); setBorrando(true);
    try {
      await llamarFuncion("eliminar-cuenta", { confirmar: "ELIMINAR" });
    } catch (e) {
      setBorrando(false);
      return setError(mensajeError(e));
    }
    try { await cerrarSesion(); } catch { /* la cuenta ya no existe: la sesión local se borra igual */ }
  }

  const que: string[] = ["Tu perfil, tu correo, tu teléfono y tus preferencias."];
  if (resumen?.borra_empresa) {
    que.push(`El servicio «${resumen.empresa}» completo: ${resumen.alumnos_borrados} alumno(s), sus rutas, cobros e historial.`);
    if (resumen.familias_afectadas) que.push(`${resumen.familias_afectadas} familia(s) dejarán de recibir avisos. Avísales antes.`);
  } else if (resumen?.rol === "apoderado") {
    if (resumen.alumnos_borrados) que.push(`${resumen.alumnos_borrados} hijo(s) que solo están en tu cuenta, con su dirección y contactos. Dejarán de estar en la ruta del furgón.`);
    que.push("Los hijos que compartes con otro familiar siguen en su cuenta; solo se quita tu teléfono de las llamadas.");
  } else if (resumen?.rol === "conductor") {
    que.push("Tu licencia de conducir y sus fotos. Los recorridos que hiciste quedan en el historial del servicio, sin tu nombre.");
  }

  return (
    <Pantalla titulo="Eliminar mi cuenta" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Aviso tipo="error" texto="Esto no se puede deshacer." />
      <Tarjeta>
        <Text style={[estilos.texto, { fontWeight: "700" }]}>Se borrará:</Text>
        {que.map((t) => <Text key={t} style={estilos.texto}>• {t}</Text>)}
      </Tarjeta>
      <Text style={estilos.textoSuave}>Los registros de cobros que la ley obliga a guardar y los respaldos de seguridad se eliminan dentro de 30 días.</Text>
      {PANEL_URL ? <Boton titulo="Ver la política de privacidad" variante="texto" onPress={() => Linking.openURL(`${PANEL_URL}/privacidad.html`)} /> : null}
      <Campo etiqueta="Para confirmar, escribe ELIMINAR" autoCapitalize="characters" autoCorrect={false} value={texto} onChangeText={setTexto} />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Boton titulo="Eliminar mi cuenta para siempre" variante="peligro" cargando={borrando}
        deshabilitado={texto.trim().toUpperCase() !== "ELIMINAR" || !resumen} onPress={eliminar} />
    </Pantalla>
  );
}
