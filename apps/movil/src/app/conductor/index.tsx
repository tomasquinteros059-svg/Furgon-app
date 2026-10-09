import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { iniciarSeguimiento, pedirPermisosUbicacion } from "../../ubicacion/seguimiento";
import { type EstadoLic, textoLicencia } from "../../lib/licencia";
import { SelectorTema } from "../../componentes/tema";
import { EnlacePrivacidad } from "../../componentes/privacidad";
import { SelectorIdioma } from "../../i18n";
import { t } from "../../lib/idioma";

interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  hora_salida: string | null;
  colegio_nombre: string | null;
  ruta_paradas: { alumno_id: string }[];
}
interface Nuevo { alumno: string; ruta: string; tipo: "ida" | "vuelta"; parada: number; agregado_en: string }

export default function RutasConductor() {
  const { perfil, cerrarSesion } = useSesion();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [activos, setActivos] = useState<Record<string, string>>({});
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porResponder, setPorResponder] = useState(0);
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [licencia, setLicencia] = useState<EstadoLic | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: r }, { data: rec }] = await Promise.all([
      // Solo sus rutas (con permiso de administrar vería también las de otras conductoras).
      supabase.from("rutas").select("id, nombre, tipo, hora_salida, colegio_nombre, ruta_paradas(alumno_id)").eq("activa", true).eq("conductor_id", perfil?.id ?? "").order("hora_salida"),
      supabase.from("recorridos").select("id, ruta_id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? ""),
    ]);
    setRutas((r as Ruta[]) ?? []);
    setActivos(Object.fromEntries((rec ?? []).map((x) => [x.ruta_id, x.id])));
    const { data: l } = await supabase.rpc("estado_licencias");
    setLicencia(((l as (EstadoLic & { conductor_id: string })[]) ?? []).find((x) => x.conductor_id === perfil?.id) ?? null);
    const { data: n } = await supabase.rpc("nuevos_en_mis_rutas", { p_dias: 3 });
    setNuevos((n as Nuevo[]) ?? []);
    const { data: c } = await supabase.rpc("mis_conexiones");
    setPorResponder(((c as { estado: string; iniciada_por: string }[] | null) ?? []).filter((x) => x.estado === "pendiente" && x.iniciada_por === "apoderado").length);
  }, [perfil?.id]);

  useFocusEffect(useCallback(() => {
    cargar();
  }, [cargar]));

  async function iniciar(ruta: Ruta) {
    setError(null);
    setIniciando(ruta.id);
    try {
      // Primero los permisos: así no queda un recorrido iniciado sin GPS.
      const permisos = await pedirPermisosUbicacion();
      if (!permisos.ok) {
        Alert.alert(t("Permiso de ubicación"), permisos.mensaje);
        return;
      }
      const { data: recorridoId, error } = await supabase.rpc("iniciar_recorrido", { p_ruta: ruta.id });
      if (error) throw error;
      const gps = await iniciarSeguimiento(recorridoId as string);
      if (!gps.ok) {
        Alert.alert(t("Permiso de ubicación"), gps.mensaje);
        return;
      }
      router.push(`/conductor/recorrido/${recorridoId}`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setIniciando(null);
    }
  }

  return (
    <Pantalla titulo={t("Hola, {nombre}", { nombre: perfil?.nombre.split(" ")[0] ?? "" })} accion={<Boton titulo={t("Salir")} variante="texto" onPress={cerrarSesion} />}>
      <Aviso texto={t("Inicia el recorrido antes de partir. Los avisos a los apoderados se envían solos: no necesitas tocar el teléfono mientras manejas.")} />
      <Aviso texto={t("📡 Tu celular es el GPS del furgón: mantenlo con batería, con la ubicación activada y en su soporte.")} />
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {perfil?.puede_administrar ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>{t("🧑‍💼 Administrar")}</Text>
          <Text style={estilos.textoSuave}>{t("Tus alumnos, el orden de la ruta, los pagos y las consultas de las familias.")}</Text>
          {Object.keys(activos).length ? (
            <Aviso texto={t("Disponible cuando termines el recorrido: no se administra manejando.")} />
          ) : (
            <Boton titulo={t("Abrir administración")} variante="secundario" onPress={() => router.push("/conductor/administrar")} />
          )}
        </Tarjeta>
      ) : null}
      {licencia ? (
        <Tarjeta estilo={licencia.estado === "vigente" ? undefined : { borderColor: licencia.estado === "por_verificar" ? colores.amarillo : colores.rojo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🪪 Mi licencia")}</Text>
          <Text style={estilos.texto}>{textoLicencia(licencia).txt}</Text>
          <Boton titulo={licencia.estado === "vigente" || licencia.estado === "por_verificar" ? t("Ver mi licencia") : t("Subir licencia")} variante="secundario"
            onPress={() => router.push("/conductor/licencia")} />
        </Tarjeta>
      ) : null}
      {nuevos.length ? (
        <Tarjeta estilo={{ borderColor: colores.verde, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🆕 Se sumaron a tus rutas")}</Text>
          {nuevos.map((x, i) => (
            <Text key={i} style={estilos.texto}>
              {x.tipo === "ida" ? "🌅" : "🏠"} <Text style={{ fontWeight: "700" }}>{x.alumno}</Text> · {t("{ruta}, parada {parada}", { ruta: x.ruta, parada: x.parada })}
            </Text>
          ))}
          <Text style={estilos.textoSuave}>{t("Quedaron donde menos alargan el recorrido. Su familia ya recibe los avisos.")}</Text>
        </Tarjeta>
      ) : null}
      <Tarjeta estilo={porResponder ? { borderColor: colores.verde, borderWidth: 2 } : undefined}>
        <Text style={estilos.subtitulo}>{t("🤝 Conexiones con familias")}</Text>
        <Text style={estilos.textoSuave}>{porResponder === 1 ? t("1 familia quiere conectarse contigo.") : porResponder ? t("{n} familias quieren conectarse contigo.", { n: porResponder }) : t("Busca familias o deja que te encuentren para sumarlas a tu furgón.")}</Text>
        <Boton titulo={t("Abrir conexiones")} variante="secundario" onPress={() => router.push("/conductor/conexiones")} />
      </Tarjeta>
      {rutas.length === 0 ? <Text style={estilos.textoSuave}>{t("No tienes rutas asignadas.")}</Text> : null}
      {rutas.map((ruta) => {
        const activo = activos[ruta.id];
        return (
          <Tarjeta key={ruta.id}>
            <Text style={estilos.subtitulo}>{ruta.tipo === "ida" ? "🌅" : "🏠"} {ruta.nombre}</Text>
            <Text style={estilos.textoSuave}>
              {ruta.tipo === "ida" ? t("Casa → colegio") : t("Colegio → casa")}
              {ruta.hora_salida ? ` · ${ruta.hora_salida.slice(0, 5)}` : ""}
              {ruta.colegio_nombre ? ` · ${ruta.colegio_nombre}` : ""}
              {" · "}{ruta.ruta_paradas.length === 1 ? t("1 alumno") : t("{n} alumnos", { n: ruta.ruta_paradas.length })}
            </Text>
            {activo ? (
              <Boton titulo={t("Continuar recorrido en curso")} variante="exito" grande
                onPress={() => router.push(`/conductor/recorrido/${activo}`)} />
            ) : (
              <Boton titulo={t("Iniciar recorrido")} grande cargando={iniciando === ruta.id} onPress={() => iniciar(ruta)} />
            )}
          </Tarjeta>
        );
      })}
      <Tarjeta><SelectorTema /></Tarjeta>
      <Tarjeta><SelectorIdioma /></Tarjeta>
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
      <EnlacePrivacidad />
    </Pantalla>
  );
}
