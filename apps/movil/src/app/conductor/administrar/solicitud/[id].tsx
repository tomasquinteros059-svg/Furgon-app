import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Aviso, Boton, colores, estilos, Pantalla } from "../../../../componentes/ui";
import { useSesion } from "../../../../lib/sesion";
import { mensajeError, supabase } from "../../../../lib/supabase";

export default function SolicitudAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSesion();
  const [s, setS] = useState<{ asunto: string; tipo: string; estado: string; resolucion: string | null } | null>(null);
  const [mensajes, setMensajes] = useState<{ id: string; cuerpo: string; autor_id: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("solicitudes").select("asunto, tipo, estado, resolucion").eq("id", id).single(),
      supabase.from("solicitud_mensajes").select("id, cuerpo, autor_id").eq("solicitud_id", id).order("creado_en"),
    ]);
    setS(a.data); setMensajes(b.data ?? []);
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  const hacer = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: ok });
    if (!error) setTexto("");
    cargar();
  };
  const responder = () => hacer(supabase.from("solicitud_mensajes").insert({ solicitud_id: id, autor_id: perfil?.id, cuerpo: texto.trim() }), "Respuesta enviada.");

  return (
    <Pantalla titulo={s?.asunto ?? "Solicitud"} accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}
      {mensajes.map((m) => {
        const mio = m.autor_id === perfil?.id;
        return (
          <View key={m.id} style={{ alignSelf: mio ? "flex-end" : "flex-start", maxWidth: "85%", backgroundColor: mio ? "#E6F0FA" : colores.tarjeta, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colores.borde }}>
            <Text style={estilos.texto}>{m.cuerpo}</Text>
          </View>
        );
      })}
      {s && s.estado !== "cerrada" ? (
        <>
          <TextInput multiline value={texto} onChangeText={setTexto} placeholder="Escribe tu respuesta"
            style={[estilos.input, { minHeight: 80, textAlignVertical: "top", marginTop: 8 }]} />
          {s.tipo === "cancelacion_servicio" ? (
            <>
              <Boton titulo="Aprobar cancelación y dar de baja" variante="peligro" onPress={() => hacer(supabase.rpc("resolver_cancelacion", { p_solicitud: id, p_aprobar: true, p_mensaje: texto.trim() }), "Cancelación aprobada: el alumno salió de tus rutas.")} />
              <Boton titulo="Rechazar" variante="secundario" onPress={() => hacer(supabase.rpc("resolver_cancelacion", { p_solicitud: id, p_aprobar: false, p_mensaje: texto.trim() }), "Solicitud rechazada.")} />
              <Boton titulo="Solo responder" variante="texto" deshabilitado={!texto.trim()} onPress={responder} />
            </>
          ) : (
            <>
              <Boton titulo="Responder" deshabilitado={!texto.trim()} onPress={responder} />
              <Boton titulo="Cerrar consulta" variante="secundario" onPress={() => hacer(supabase.from("solicitudes").update({ estado: "cerrada" }).eq("id", id), "Consulta cerrada.")} />
            </>
          )}
        </>
      ) : s ? <Aviso texto={s.resolucion ? `Cerrada · cancelación ${s.resolucion}.` : "Consulta cerrada."} /> : null}
    </Pantalla>
  );
}
