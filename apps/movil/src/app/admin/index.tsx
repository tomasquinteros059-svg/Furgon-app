// Panel mínimo del administrador (Fase 1): asignar alumnos a rutas, invitaciones y
// estado de los recorridos del día. El panel completo es parte de la Fase 3.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Share, Text, View } from "react-native";
import { Aviso, Boton, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";

interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  ruta_paradas: { alumno_id: string; orden: number; alumnos: { nombre: string } }[];
}
interface Alumno {
  id: string;
  nombre: string;
  colegio: string | null;
}
interface Recorrido {
  id: string;
  tipo: string;
  estado: string;
  iniciado_en: string;
  ruta: { nombre: string };
  recorrido_alumnos: { estado: string }[];
}

export default function PanelAdmin() {
  const { cerrarSesion } = useSesion();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [recorridos, setRecorridos] = useState<Recorrido[]>([]);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "exito" | "error" } | null>(null);

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: r }, { data: a }, { data: rec }] = await Promise.all([
      supabase.from("rutas").select("id, nombre, tipo, ruta_paradas(alumno_id, orden, alumnos(nombre))").order("nombre"),
      supabase.from("alumnos").select("id, nombre, colegio").eq("activo", true).order("nombre"),
      supabase.from("recorridos")
        .select("id, tipo, estado, iniciado_en, ruta:rutas(nombre), recorrido_alumnos(estado)")
        .gte("iniciado_en", desde).order("iniciado_en", { ascending: false }),
    ]);
    setRutas((r as unknown as Ruta[]) ?? []);
    setAlumnos((a as Alumno[]) ?? []);
    setRecorridos((rec as unknown as Recorrido[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
  }, [cargar]));

  async function asignar(alumno: Alumno, ruta: Ruta) {
    const { error } = await supabase.rpc("asignar_a_ruta", { p_alumno: alumno.id, p_ruta: ruta.id });
    setMensaje(error ? { texto: mensajeError(error), tipo: "error" } : { texto: `${alumno.nombre} agregado a ${ruta.nombre}`, tipo: "exito" });
    cargar();
  }

  async function invitar(rol: "apoderado" | "conductor") {
    const { data, error } = await supabase.rpc("crear_invitacion", { p_rol: rol, p_usos: rol === "apoderado" ? 50 : 1 });
    if (error) return setMensaje({ texto: mensajeError(error), tipo: "error" });
    await Share.share({
      message: `Descarga la app Furgón Escolar y regístrate como ${rol} con el código: ${data}`,
    });
  }

  return (
    <Pantalla titulo="Administración" accion={<Boton titulo="Salir" variante="texto" onPress={cerrarSesion} />}>
      {mensaje ? <Aviso texto={mensaje.texto} tipo={mensaje.tipo} /> : null}

      <Text style={estilos.subtitulo}>Recorridos (últimas 24 h)</Text>
      {recorridos.length === 0 ? <Text style={estilos.textoSuave}>Sin recorridos recientes.</Text> : null}
      {recorridos.map((r) => {
        const total = r.recorrido_alumnos.length;
        const listos = r.recorrido_alumnos.filter((x) => x.estado !== "pendiente").length;
        return (
          <Tarjeta key={r.id}>
            <Text style={estilos.texto}>
              {r.estado === "activo" ? "🟢" : "⚪️"} {r.ruta.nombre} · {listos}/{total} atendidos
            </Text>
            <Text style={estilos.textoSuave}>
              Inicio {new Date(r.iniciado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · {r.estado}
            </Text>
          </Tarjeta>
        );
      })}

      <Text style={estilos.subtitulo}>Rutas</Text>
      {rutas.map((ruta) => {
        const enRuta = new Set(ruta.ruta_paradas.map((p) => p.alumno_id));
        const fuera = alumnos.filter((a) => !enRuta.has(a.id));
        return (
          <Tarjeta key={ruta.id}>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{ruta.nombre} ({ruta.tipo})</Text>
            {[...ruta.ruta_paradas].sort((a, b) => a.orden - b.orden).map((p) => (
              <Text key={p.alumno_id} style={estilos.textoSuave}>{p.orden}. {p.alumnos.nombre}</Text>
            ))}
            {fuera.length ? <Text style={[estilos.etiqueta, { marginTop: 8 }]}>Agregar al final:</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {fuera.map((a) => (
                <Boton key={a.id} titulo={`+ ${a.nombre}`} variante="secundario" onPress={() => asignar(a, ruta)} />
              ))}
            </View>
          </Tarjeta>
        );
      })}

      <Text style={estilos.subtitulo}>Invitaciones</Text>
      <Boton titulo="Invitar apoderados" onPress={() => invitar("apoderado")} />
      <Boton titulo="Invitar conductor" variante="secundario" onPress={() => invitar("conductor")} />
    </Pantalla>
  );
}
