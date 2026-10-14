// Mensajes de la familia con su tía o tío (diseño oct. 2026): una sola conversación, como un chat.
// Por dentro es una consulta («pregunta») con sus mensajes; la tía la ve y la responde en su pestaña
// Mensajes. Cancelar el servicio, reclamos y preguntas frecuentes siguen en «Otras consultas».
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Avatar } from "../../componentes/avatar";
import { Icono, Text } from "../../componentes/icono";
import { PantallaFamilia } from "../../componentes/pantalla-familia";
import { Aviso, Boton, colores, estilos } from "../../componentes/ui";
import { misConexiones } from "../../lib/conexiones";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { locale, t } from "../../lib/idioma";

interface Mensaje { id: string; cuerpo: string; creado_en: string; autor_id: string }
const ASUNTO = "Mensajes"; // i18n-ignorar: dato guardado, la tía lo ve como asunto

const hora = (iso: string) => new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(iso));

export default function MensajesFamilia() {
  const { perfil } = useSesion();
  const [tia, setTia] = useState<string | null>(null);
  const [conversacion, setConversacion] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    // La conversación es la consulta «pregunta» abierta más reciente.
    const { data: s } = await supabase.from("solicitudes").select("id").eq("tipo", "pregunta").neq("estado", "cerrada")
      .order("actualizado_en", { ascending: false }).limit(1).maybeSingle();
    idRef.current = s?.id ?? null;
    setConversacion(s?.id ?? null);
    if (!s) { setMensajes([]); return; }
    const { data } = await supabase.from("solicitud_mensajes").select("id, cuerpo, creado_en, autor_id").eq("solicitud_id", s.id).order("creado_en");
    setMensajes(data ?? []);
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
    misConexiones().then((c) => setTia(c.find((x) => x.estado === "aceptada")?.otro_nombre ?? null)).catch(() => {});
  }, [cargar]));

  // Llegan las respuestas de la tía sin tener que salir y volver.
  useEffect(() => {
    const canal = supabase.channel("mensajes-familia")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "solicitud_mensajes" }, (p) => {
        if ((p.new as { solicitud_id?: string }).solicitud_id === idRef.current) cargar();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [cargar]);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || !perfil) return;
    setError(null); setEnviando(true);
    const { error } = conversacion
      ? await supabase.from("solicitud_mensajes").insert({ solicitud_id: conversacion, autor_id: perfil.id, cuerpo })
      : await supabase.rpc("crear_solicitud", { p_tipo: "pregunta", p_asunto: ASUNTO, p_mensaje: cuerpo, p_alumno: null });
    setEnviando(false);
    if (error) { setError(mensajeError(error)); return cargar(); }
    setTexto(""); cargar();
  }

  const nombreTia = tia ?? t("Tu tía del furgón");
  return (
    <PantallaFamilia>
      <View style={[estilos.fila, { gap: 16, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 28, padding: 18, marginBottom: 14 }]}>
        <Avatar nombre={nombreTia} tam={52} letras={1} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colores.texto }}>{nombreTia}</Text>
          <Text style={{ fontSize: 16, color: colores.suave }}>{tia ? t("Tía del furgón") : t("Aún no te conectas con tu furgón")}</Text>
        </View>
      </View>

      {error ? <Aviso tipo="error" texto={error} /> : null}
      <View style={{ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 30, padding: 18, gap: 14, marginBottom: 14 }}>
        {mensajes.length === 0 ? (
          <Text style={[estilos.textoSuave, { textAlign: "center", paddingVertical: 12 }]}>{t("Escríbele a la tía: le llega a su app y te responde aquí.")}</Text>
        ) : mensajes.map((m) => {
          const mio = m.autor_id === perfil?.id;
          return (
            <View key={m.id} style={{
              alignSelf: mio ? "flex-end" : "flex-start", maxWidth: "85%", borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16,
              backgroundColor: mio ? colores.amarillo : colores.superficie2, borderWidth: mio ? 2 : 0, borderColor: colores.borde,
            }}>
              <Text style={{ fontSize: 17, color: mio ? colores.sobreAmarillo : colores.texto, lineHeight: 24 }}>{m.cuerpo}</Text>
              <Text style={{ fontSize: 13, color: mio ? colores.sobreAmarillo : colores.suave, opacity: 0.75, marginTop: 6 }}>{hora(m.creado_en)}</Text>
            </View>
          );
        })}
      </View>

      <View style={[estilos.fila, { gap: 10, marginBottom: 18 }]}>
        <TextInput value={texto} onChangeText={setTexto} placeholder={t("Escribe a la tía…")} placeholderTextColor={colores.suave}
          multiline accessibilityLabel={t("Mensaje")}
          style={[estilos.input, { flex: 1, marginBottom: 0, borderRadius: 999, paddingHorizontal: 20, maxHeight: 120 }]} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("Enviar")} disabled={!texto.trim() || enviando} onPress={enviar}
          style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.borde,
            alignItems: "center", justifyContent: "center", opacity: !texto.trim() || enviando ? 0.5 : pressed ? 0.8 : 1 })}>
          <Icono nombre="enviar" tam={26} color={colores.sobreAmarillo} acento="transparent" />
        </Pressable>
      </View>

      <Boton titulo={t("Otras consultas y preguntas frecuentes")} variante="texto" onPress={() => router.push("/apoderado/consultas")} />
    </PantallaFamilia>
  );
}
