// Conversación de una consulta con la administración.
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Text } from "../../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla } from "../../../componentes/ui";
import { useSesion } from "../../../lib/sesion";
import { mensajeError, supabase } from "../../../lib/supabase";

interface Mensaje { id: string; cuerpo: string; creado_en: string; autor_id: string }

export default function Solicitud() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSesion();
  const [s, setS] = useState<{ asunto: string; estado: string; resolucion: string | null } | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("solicitudes").select("asunto, estado, resolucion").eq("id", id).single(),
      supabase.from("solicitud_mensajes").select("id, cuerpo, creado_en, autor_id").eq("solicitud_id", id).order("creado_en"),
    ]);
    setS(a.data); setMensajes(b.data ?? []);
  }, [id]);
  useEffect(() => {
    cargar();
    const canal = supabase.channel(`solicitud-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "solicitud_mensajes", filter: `solicitud_id=eq.${id}` }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, cargar]);

  async function enviar() {
    if (!texto.trim() || !perfil) return;
    const { error } = await supabase.from("solicitud_mensajes").insert({ solicitud_id: id, autor_id: perfil.id, cuerpo: texto.trim() });
    if (error) return setError(mensajeError(error));
    setTexto(""); cargar();
  }

  const hora = (iso: string) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return (
    <Pantalla titulo={s?.asunto ?? "Consulta"} accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {s?.resolucion ? <Aviso tipo={s.resolucion === "aprobada" ? "exito" : "info"} texto={`Cancelación ${s.resolucion}.`} /> : null}
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {mensajes.map((m) => {
        const mio = m.autor_id === perfil?.id;
        return (
          <View key={m.id} style={{ alignSelf: mio ? "flex-end" : "flex-start", maxWidth: "85%", backgroundColor: mio ? colores.superficie2 : colores.superficie, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colores.borde }}>
            <Text style={[estilos.textoSuave, { fontSize: 12 }]}>{mio ? "Tú" : "Administración"} · {hora(m.creado_en)}</Text>
            <Text style={estilos.texto}>{m.cuerpo}</Text>
          </View>
        );
      })}
      {s && s.estado !== "cerrada" ? (
        <>
          <TextInput multiline value={texto} onChangeText={setTexto} placeholder="Escribe tu mensaje"
            style={[estilos.input, { minHeight: 80, textAlignVertical: "top", marginTop: 8 }]} />
          <Boton titulo="Enviar" onPress={enviar} deshabilitado={!texto.trim()} />
        </>
      ) : s ? <Aviso texto="Esta consulta está cerrada. Si necesitas algo más, escribe una nueva desde Ayuda." /> : null}
    </Pantalla>
  );
}
