// Ayuda: preguntas frecuentes, consultas a la administración y solicitud de cancelación.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { mensajeError, supabase } from "../../lib/supabase";

type Tipo = "pregunta" | "cancelacion_servicio" | "cambio_datos" | "reclamo";
const TIPOS: { id: Tipo; nombre: string }[] = [
  { id: "pregunta", nombre: "Pregunta" },
  { id: "cambio_datos", nombre: "Cambio de datos" },
  { id: "reclamo", nombre: "Reclamo" },
  { id: "cancelacion_servicio", nombre: "Cancelar el servicio" },
];
const ESTADO = { abierta: "Enviada", respondida: "Respondida", cerrada: "Cerrada" } as Record<string, string>;

export default function Ayuda() {
  const [faq, setFaq] = useState<{ id: string; pregunta: string; respuesta: string }[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<{ id: string; asunto: string; estado: string; tipo: string }[]>([]);
  const [hijos, setHijos] = useState<{ id: string; nombre: string }[]>([]);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ tipo: Tipo; alumno: string | null; asunto: string; mensaje: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const [f, s, h, e] = await Promise.all([
      supabase.from("preguntas_frecuentes").select("id, pregunta, respuesta").order("orden"),
      supabase.from("solicitudes").select("id, asunto, estado, tipo").order("actualizado_en", { ascending: false }),
      supabase.from("alumnos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("empresas").select("telefono_contacto").maybeSingle(),
    ]);
    setFaq(f.data ?? []); setSolicitudes(s.data ?? []); setHijos(h.data ?? []); setTelefono(e.data?.telefono_contacto ?? null);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function enviar() {
    if (!nueva) return;
    setError(null);
    if (!nueva.asunto.trim() || !nueva.mensaje.trim()) return setError("Escribe un asunto y tu mensaje.");
    if (nueva.tipo === "cancelacion_servicio" && !nueva.alumno) return setError("Elige qué alumno deja el furgón.");
    setEnviando(true);
    const { error } = await supabase.rpc("crear_solicitud", {
      p_tipo: nueva.tipo, p_asunto: nueva.asunto.trim(), p_mensaje: nueva.mensaje.trim(), p_alumno: nueva.alumno,
    });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    setNueva(null); cargar();
  }

  return (
    <Pantalla titulo="Ayuda" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {nueva ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>Nueva consulta</Text>
          {error ? <Aviso tipo="error" texto={error} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {TIPOS.map((t) => (
              <Pressable key={t.id} onPress={() => setNueva({ ...nueva, tipo: t.id })} accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: nueva.tipo === t.id ? colores.amarillo : colores.superficie }}>
                <Text style={{ color: nueva.tipo === t.id ? colores.sobreAmarillo : colores.texto, fontWeight: "600" }}>{t.nombre}</Text>
              </Pressable>
            ))}
          </View>
          {hijos.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {hijos.map((h) => (
                <Pressable key={h.id} onPress={() => setNueva({ ...nueva, alumno: nueva.alumno === h.id ? null : h.id })} accessibilityRole="button"
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: nueva.alumno === h.id ? colores.amarillo : colores.tarjeta }}>
                  <Text style={{ fontWeight: "600", color: colores.texto }}>{h.nombre}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {nueva.tipo === "cancelacion_servicio" ? <Aviso texto="La administración revisará tu solicitud y te confirmará desde cuándo queda cancelado el servicio." /> : null}
          <Campo etiqueta="Asunto" value={nueva.asunto} onChangeText={(t) => setNueva({ ...nueva, asunto: t })} />
          <Text style={estilos.etiqueta}>Mensaje</Text>
          <TextInput multiline value={nueva.mensaje} onChangeText={(t) => setNueva({ ...nueva, mensaje: t })}
            style={[estilos.input, { minHeight: 110, textAlignVertical: "top", marginBottom: 12 }]} />
          <Boton titulo="Enviar" onPress={enviar} cargando={enviando} />
          <Boton titulo="Cancelar" variante="texto" onPress={() => setNueva(null)} />
        </Tarjeta>
      ) : (
        <Boton titulo="+ Escribir a la administración" onPress={() => setNueva({ tipo: "pregunta", alumno: hijos.length === 1 ? hijos[0].id : null, asunto: "", mensaje: "" })} />
      )}

      {solicitudes.length ? <Text style={estilos.subtitulo}>Mis consultas</Text> : null}
      {solicitudes.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/apoderado/solicitud/${s.id}`)} accessibilityRole="button">
          <Tarjeta>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{s.asunto}</Text>
            <Text style={estilos.textoSuave}>{TIPOS.find((t) => t.id === s.tipo)?.nombre ?? "Otro"} · {ESTADO[s.estado] ?? s.estado}</Text>
          </Tarjeta>
        </Pressable>
      ))}

      <Text style={estilos.subtitulo}>Preguntas frecuentes</Text>
      {faq.map((f) => (
        <Pressable key={f.id} onPress={() => setAbierta(abierta === f.id ? null : f.id)} accessibilityRole="button">
          <Tarjeta>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{abierta === f.id ? "▾" : "▸"} {f.pregunta}</Text>
            {abierta === f.id ? <Text style={[estilos.texto, { marginTop: 6 }]}>{f.respuesta}</Text> : null}
          </Tarjeta>
        </Pressable>
      ))}
      {telefono ? <Aviso texto={`¿Urgente? Llama a la administración al ${telefono}.`} /> : null}
    </Pantalla>
  );
}
