// Ayuda: preguntas frecuentes, consultas a la administración y solicitud de cancelación.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

type Tipo = "pregunta" | "cancelacion_servicio" | "cambio_datos" | "reclamo";
// Funciones (no constantes) para que los nombres salgan en el idioma actual.
const tipos = (): { id: Tipo; nombre: string }[] => [
  { id: "pregunta", nombre: t("Pregunta") },
  { id: "cambio_datos", nombre: t("Cambio de datos") },
  { id: "reclamo", nombre: t("Reclamo") },
  { id: "cancelacion_servicio", nombre: t("Cancelar el servicio") },
];
const nombreEstado = (estado: string) => ({ abierta: t("Enviada"), respondida: t("Respondida"), cerrada: t("Cerrada") } as Record<string, string>)[estado] ?? estado;

export default function Ayuda() {
  const [faq, setFaq] = useState<{ id: string; pregunta: string; respuesta: string }[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<{ id: string; asunto: string; estado: string; tipo: string }[]>([]);
  const [hijos, setHijos] = useState<{ id: string; nombre: string }[]>([]);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ tipo: Tipo; alumno: string | null; asunto: string; mensaje: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const TIPOS = tipos();

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
    if (!nueva.asunto.trim() || !nueva.mensaje.trim()) return setError(t("Escribe un asunto y tu mensaje."));
    if (nueva.tipo === "cancelacion_servicio" && !nueva.alumno) return setError(t("Elige qué alumno deja el furgón."));
    setEnviando(true);
    const { error } = await supabase.rpc("crear_solicitud", {
      p_tipo: nueva.tipo, p_asunto: nueva.asunto.trim(), p_mensaje: nueva.mensaje.trim(), p_alumno: nueva.alumno,
    });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    setNueva(null); cargar();
  }

  return (
    <Pantalla titulo={t("Ayuda")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {nueva ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>{t("Nueva consulta")}</Text>
          {error ? <Aviso tipo="error" texto={error} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {TIPOS.map((x) => (
              <Pressable key={x.id} onPress={() => setNueva({ ...nueva, tipo: x.id })} accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: nueva.tipo === x.id ? colores.amarillo : colores.superficie }}>
                <Text style={{ color: nueva.tipo === x.id ? colores.sobreAmarillo : colores.texto, fontWeight: "600" }}>{x.nombre}</Text>
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
          {nueva.tipo === "cancelacion_servicio" ? <Aviso texto={t("La administración revisará tu solicitud y te confirmará desde cuándo queda cancelado el servicio.")} /> : null}
          <Campo etiqueta={t("Asunto")} value={nueva.asunto} onChangeText={(v) => setNueva({ ...nueva, asunto: v })} />
          <Text style={estilos.etiqueta}>{t("Mensaje")}</Text>
          <TextInput multiline value={nueva.mensaje} onChangeText={(v) => setNueva({ ...nueva, mensaje: v })}
            style={[estilos.input, { minHeight: 110, textAlignVertical: "top", marginBottom: 12 }]} />
          <Boton titulo={t("Enviar")} onPress={enviar} cargando={enviando} />
          <Boton titulo={t("Cancelar")} variante="texto" onPress={() => setNueva(null)} />
        </Tarjeta>
      ) : (
        <Boton titulo={t("+ Escribir a la administración")} onPress={() => setNueva({ tipo: "pregunta", alumno: hijos.length === 1 ? hijos[0].id : null, asunto: "", mensaje: "" })} />
      )}

      {solicitudes.length ? <Text style={estilos.subtitulo}>{t("Mis consultas")}</Text> : null}
      {solicitudes.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/apoderado/solicitud/${s.id}`)} accessibilityRole="button">
          <Tarjeta>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{s.asunto}</Text>
            <Text style={estilos.textoSuave}>{TIPOS.find((x) => x.id === s.tipo)?.nombre ?? t("Otro")} · {nombreEstado(s.estado)}</Text>
          </Tarjeta>
        </Pressable>
      ))}

      <Text style={estilos.subtitulo}>{t("Preguntas frecuentes")}</Text>
      {faq.map((f) => (
        <Pressable key={f.id} onPress={() => setAbierta(abierta === f.id ? null : f.id)} accessibilityRole="button">
          <Tarjeta>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{abierta === f.id ? "▾" : "▸"} {f.pregunta}</Text>
            {abierta === f.id ? <Text style={[estilos.texto, { marginTop: 6 }]}>{f.respuesta}</Text> : null}
          </Tarjeta>
        </Pressable>
      ))}
      {telefono ? <Aviso texto={t("¿Urgente? Llama a la administración al {telefono}.", { telefono })} /> : null}
    </Pantalla>
  );
}
