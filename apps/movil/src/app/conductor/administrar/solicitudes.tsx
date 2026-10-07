import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable } from "react-native";
import { Text } from "../../../componentes/icono";
import { Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";

interface Solicitud { id: string; tipo: string; asunto: string; estado: string; alumnos: { nombre: string } | null; autor: { nombre: string } | null }
const TIPO: Record<string, string> = { pregunta: "Pregunta", cancelacion_servicio: "Cancelación", cambio_datos: "Cambio de datos", reclamo: "Reclamo", otro: "Otro" };

export default function SolicitudesAdmin() {
  const [lista, setLista] = useState<Solicitud[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from("solicitudes").select("id, tipo, asunto, estado, alumnos(nombre), autor:perfiles(nombre)")
      .neq("estado", "cerrada").order("actualizado_en", { ascending: false })
      .then(({ data }) => setLista((data as unknown as Solicitud[]) ?? []));
  }, []));
  return (
    <Pantalla titulo="Solicitudes" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {lista.length === 0 ? <Text style={estilos.textoSuave}>No hay solicitudes por atender. 🎉</Text> : null}
      {lista.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/conductor/administrar/solicitud/${s.id}`)}>
          <Tarjeta estilo={s.estado === "abierta" ? { borderColor: colores.rojo, borderWidth: 2 } : undefined}>
            <Text style={estilos.textoSuave}>{TIPO[s.tipo] ?? s.tipo} · {s.estado === "abierta" ? "Sin responder" : "Respondida"}</Text>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{s.asunto}</Text>
            <Text style={estilos.textoSuave}>{s.autor?.nombre}{s.alumnos ? ` · ${s.alumnos.nombre}` : ""}</Text>
          </Tarjeta>
        </Pressable>
      ))}
    </Pantalla>
  );
}
