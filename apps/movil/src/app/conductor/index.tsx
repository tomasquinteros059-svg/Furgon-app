import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { iniciarSeguimiento } from "../../ubicacion/seguimiento";

interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  hora_salida: string | null;
  colegio_nombre: string | null;
}

export default function RutasConductor() {
  const { perfil, cerrarSesion } = useSesion();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [activos, setActivos] = useState<Record<string, string>>({});
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porResponder, setPorResponder] = useState(0);

  const cargar = useCallback(async () => {
    const [{ data: r }, { data: rec }] = await Promise.all([
      // Solo sus rutas (con permiso de administrar vería también las de otras conductoras).
      supabase.from("rutas").select("id, nombre, tipo, hora_salida, colegio_nombre").eq("activa", true).eq("conductor_id", perfil?.id ?? "").order("hora_salida"),
      supabase.from("recorridos").select("id, ruta_id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? ""),
    ]);
    setRutas((r as Ruta[]) ?? []);
    setActivos(Object.fromEntries((rec ?? []).map((x) => [x.ruta_id, x.id])));
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
      const { data: recorridoId, error } = await supabase.rpc("iniciar_recorrido", { p_ruta: ruta.id });
      if (error) throw error;
      const gps = await iniciarSeguimiento(recorridoId as string);
      if (!gps.ok) {
        Alert.alert("Permiso de ubicación", gps.mensaje);
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
    <Pantalla titulo={`Hola, ${perfil?.nombre.split(" ")[0] ?? ""}`} accion={<Boton titulo="Salir" variante="texto" onPress={cerrarSesion} />}>
      <Aviso texto="Inicia el recorrido antes de partir. Los avisos a los apoderados se envían solos: no necesitas tocar el teléfono mientras manejas." />
      <Aviso texto="📡 Tu celular es el GPS del furgón: mantenlo con batería, con la ubicación activada y en su soporte." />
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {perfil?.puede_administrar ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>🧑‍💼 Administrar</Text>
          <Text style={estilos.textoSuave}>Tus alumnos, el orden de la ruta, los pagos y las consultas de las familias.</Text>
          {Object.keys(activos).length ? (
            <Aviso texto="Disponible cuando termines el recorrido: no se administra manejando." />
          ) : (
            <Boton titulo="Abrir administración" variante="secundario" onPress={() => router.push("/conductor/administrar")} />
          )}
        </Tarjeta>
      ) : null}
      <Tarjeta estilo={porResponder ? { borderColor: colores.verde, borderWidth: 2 } : undefined}>
        <Text style={estilos.subtitulo}>🤝 Conexiones con familias</Text>
        <Text style={estilos.textoSuave}>{porResponder ? `${porResponder} familia(s) quieren conectarse contigo.` : "Busca familias o deja que te encuentren para sumarlas a tu furgón."}</Text>
        <Boton titulo="Abrir conexiones" variante="secundario" onPress={() => router.push("/conductor/conexiones")} />
      </Tarjeta>
      {rutas.length === 0 ? <Text style={estilos.textoSuave}>No tienes rutas asignadas.</Text> : null}
      {rutas.map((ruta) => {
        const activo = activos[ruta.id];
        return (
          <Tarjeta key={ruta.id}>
            <Text style={estilos.subtitulo}>{ruta.tipo === "ida" ? "🌅" : "🏠"} {ruta.nombre}</Text>
            <Text style={estilos.textoSuave}>
              {ruta.tipo === "ida" ? "Casa → colegio" : "Colegio → casa"}
              {ruta.hora_salida ? ` · ${ruta.hora_salida.slice(0, 5)}` : ""}
              {ruta.colegio_nombre ? ` · ${ruta.colegio_nombre}` : ""}
            </Text>
            {activo ? (
              <Boton titulo="Continuar recorrido en curso" variante="exito" grande
                onPress={() => router.push(`/conductor/recorrido/${activo}`)} />
            ) : (
              <Boton titulo="Iniciar recorrido" grande cargando={iniciando === ruta.id} onPress={() => iniciar(ruta)} />
            )}
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
