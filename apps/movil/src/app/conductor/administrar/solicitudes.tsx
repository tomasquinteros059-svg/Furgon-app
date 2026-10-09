import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable } from "react-native";
import { Text } from "../../../componentes/icono";
import { Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";
import { t } from "../../../lib/idioma";

interface Solicitud { id: string; tipo: string; asunto: string; estado: string; alumnos: { nombre: string } | null; autor: { nombre: string } | null }
const tipoSolicitud = (tipo: string): string =>
  ({ pregunta: t("Pregunta"), cancelacion_servicio: t("Cancelación"), cambio_datos: t("Cambio de datos"), reclamo: t("Reclamo"), otro: t("Otro") } as Record<string, string>)[tipo] ?? tipo;

export default function SolicitudesAdmin() {
  const [lista, setLista] = useState<Solicitud[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from("solicitudes").select("id, tipo, asunto, estado, alumnos(nombre), autor:perfiles(nombre)")
      .neq("estado", "cerrada").order("actualizado_en", { ascending: false })
      .then(({ data }) => setLista((data as unknown as Solicitud[]) ?? []));
  }, []));
  return (
    <Pantalla titulo={t("Solicitudes")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {lista.length === 0 ? <Text style={estilos.textoSuave}>{t("No hay solicitudes por atender. 🎉")}</Text> : null}
      {lista.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/conductor/administrar/solicitud/${s.id}`)}>
          <Tarjeta estilo={s.estado === "abierta" ? { borderColor: colores.rojo, borderWidth: 2 } : undefined}>
            <Text style={estilos.textoSuave}>{tipoSolicitud(s.tipo)} · {s.estado === "abierta" ? t("Sin responder") : t("Respondida")}</Text>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{s.asunto}</Text>
            <Text style={estilos.textoSuave}>{s.autor?.nombre}{s.alumnos ? ` · ${s.alumnos.nombre}` : ""}</Text>
          </Tarjeta>
        </Pressable>
      ))}
    </Pantalla>
  );
}
