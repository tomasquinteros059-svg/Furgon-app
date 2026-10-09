// Eliminar la cuenta desde la app (lo exigen Apple y Google). Muestra qué se borrará y
// pide escribir ELIMINAR para confirmar; la función «eliminar-cuenta» hace el resto.
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, estilos, Pantalla, Tarjeta } from "../componentes/ui";
import { useSesion } from "../lib/sesion";
import { llamarFuncion, mensajeError, supabase } from "../lib/supabase";
import { t } from "../lib/idioma";

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

  // Palabra que hay que escribir para confirmar (al servidor siempre se envía «ELIMINAR»).
  const palabra = t("ELIMINAR");
  const que: string[] = [t("Tu perfil, tu correo, tu teléfono y tus preferencias.")];
  if (resumen?.borra_empresa) {
    const n = resumen.alumnos_borrados;
    que.push(n === 1
      ? t("El servicio «{empresa}» completo: 1 alumno, sus rutas, cobros e historial.", { empresa: resumen.empresa })
      : t("El servicio «{empresa}» completo: {n} alumnos, sus rutas, cobros e historial.", { empresa: resumen.empresa, n }));
    const f = resumen.familias_afectadas;
    if (f) que.push(f === 1
      ? t("1 familia dejará de recibir avisos. Avísales antes.")
      : t("{n} familias dejarán de recibir avisos. Avísales antes.", { n: f }));
  } else if (resumen?.rol === "apoderado") {
    const n = resumen.alumnos_borrados;
    if (n) que.push(n === 1
      ? t("1 hijo que solo está en tu cuenta se da de baja del furgón: se borran su dirección y contactos, y sale de la ruta. Sus cobros quedan registrados para el transportista.")
      : t("{n} hijos que solo están en tu cuenta se dan de baja del furgón: se borran su dirección y contactos, y salen de la ruta. Sus cobros quedan registrados para el transportista.", { n }));
    que.push(t("Los hijos que compartes con otro familiar siguen en su cuenta; solo se quita tu teléfono de las llamadas."));
  } else if (resumen?.rol === "conductor") {
    que.push(t("Tu licencia de conducir y sus fotos. Los recorridos que hiciste quedan en el historial del servicio, sin tu nombre."));
  }

  return (
    <Pantalla titulo={t("Eliminar mi cuenta")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      <Aviso tipo="error" texto={t("Esto no se puede deshacer.")} />
      <Tarjeta>
        <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("Se borrará:")}</Text>
        {que.map((x) => <Text key={x} style={estilos.texto}>• {x}</Text>)}
      </Tarjeta>
      <Text style={estilos.textoSuave}>{t("Los registros de cobros que la ley obliga a guardar y los respaldos de seguridad se eliminan dentro de 30 días.")}</Text>
      {PANEL_URL ? <Boton titulo={t("Ver la política de privacidad")} variante="texto" onPress={() => Linking.openURL(`${PANEL_URL}/privacidad.html`)} /> : null}
      <Campo etiqueta={t("Para confirmar, escribe {palabra}", { palabra })} autoCapitalize="characters" autoCorrect={false} value={texto} onChangeText={setTexto} />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Boton titulo={t("Eliminar mi cuenta para siempre")} variante="peligro" cargando={borrando}
        deshabilitado={texto.trim().toUpperCase() !== palabra || !resumen} onPress={eliminar} />
    </Pantalla>
  );
}
