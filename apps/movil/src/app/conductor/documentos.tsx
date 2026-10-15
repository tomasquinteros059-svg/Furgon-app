// Documentos del furgón y de quien conduce: la tía los fotografía y la empresa los revisa. Con uno
// obligatorio vencido no se pueden iniciar recorridos (por la seguridad de los niños).
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Icono, Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla } from "../../componentes/ui";
import { type Documento, documentosConProblema, infoDocumento, textoDocumento } from "../../lib/documentos";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

/** dd-mm-aaaa → aaaa-mm-dd (o null si no es una fecha válida). */
function leerFecha(texto: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : iso;
}

export default function Documentos() {
  const { perfil } = useSesion();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [vence, setVence] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("estado_documentos");
    if (error) setMsg({ ok: false, txt: mensajeError(error) });
    setDocs(((data as Documento[]) ?? []).filter((d) => d.de === "furgon" || d.conductor_id === perfil?.id));
  }, [perfil?.id]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function elegir(camara: boolean) {
    const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return setMsg({ ok: false, txt: t("Necesitamos permiso para la cámara o las fotos.") });
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
    const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets[0]) setFoto(r.assets[0].uri);
  }

  async function enviar(d: Documento) {
    setMsg(null);
    if (!foto) return setMsg({ ok: false, txt: t("Falta la foto del documento.") });
    const iso = d.vence ? leerFecha(vence) : null;
    if (d.vence && !iso) return setMsg({ ok: false, txt: t("Escribe la fecha de vencimiento como 31-12-2027.") });
    setEnviando(true);
    try {
      const ruta = `${perfil!.id}/${Date.now()}-${d.tipo}.jpg`;
      const cuerpo = await (await fetch(foto)).arrayBuffer();
      const subida = await supabase.storage.from("documentos").upload(ruta, cuerpo, { contentType: "image/jpeg" });
      if (subida.error) throw subida.error;
      const { error } = await supabase.rpc("subir_documento", { p_tipo: d.tipo, p_archivo: ruta, p_vence_en: iso });
      if (error) throw error;
      setMsg({ ok: true, txt: t("Documento enviado. La empresa lo revisará.") });
      setAbierto(null); setFoto(null); setVence("");
      cargar();
    } catch (e) {
      setMsg({ ok: false, txt: mensajeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  const lista = docs ?? [];
  const problemas = documentosConProblema(lista);
  const patente = lista.find((d) => d.de === "furgon")?.patente;
  const grupos: { titulo: string; docs: Documento[] }[] = [
    { titulo: patente ? t("Furgón {patente}", { patente }) : t("Furgón"), docs: lista.filter((d) => d.de === "furgon") },
    { titulo: t("Quien conduce"), docs: lista.filter((d) => d.de === "conductor") },
  ];

  return (
    <Pantalla titulo={t("Documentos")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      <Text style={{ fontSize: 17, color: colores.suave, marginBottom: 12, lineHeight: 25 }}>
        {t("Por la seguridad de los niños, la empresa revisa los documentos del furgón y los tuyos. Con uno obligatorio vencido no se pueden iniciar recorridos.")}
      </Text>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}
      {docs && problemas.length === 0 ? <Aviso tipo="exito" texto={t("Todo al día. ¡Gracias!")} /> : null}
      {docs && !lista.some((d) => d.de === "furgon") ? (
        <Aviso texto={t("Aún no tienes un furgón asignado: cuando la empresa te lo asigne, aquí aparecerán sus documentos.")} />
      ) : null}

      {grupos.filter((g) => g.docs.length).map((g) => (
        <View key={g.titulo} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: 1, color: colores.suave, marginBottom: 8 }}>{g.titulo.toUpperCase()}</Text>
          {g.docs.map((d) => {
            const info = infoDocumento(d.tipo);
            const estado = textoDocumento(d);
            const clave = `${d.tipo}-${d.furgon_id ?? d.conductor_id}`;
            const abiertoAqui = abierto === clave;
            const color = estado.tono === "exito" ? colores.verde : estado.tono === "error" ? colores.rojo : colores.suave;
            return (
              <View key={clave} style={{ backgroundColor: colores.superficie, borderWidth: 2, borderColor: estado.tono === "error" && d.obligatorio ? colores.rojo : colores.borde, borderRadius: 26, marginBottom: 12, overflow: "hidden" }}>
                <Pressable accessibilityRole="button" accessibilityLabel={info.nombre} accessibilityState={{ expanded: abiertoAqui }}
                  onPress={() => { setAbierto(abiertoAqui ? null : clave); setFoto(null); setVence(""); setMsg(null); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
                  <Icono nombre={d.de === "furgon" ? "furgon" : "licencia"} tam={28} color={colores.texto} acento="transparent" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 17, fontWeight: "600", color: colores.texto }}>{info.nombre}</Text>
                    <Text style={{ fontSize: 14, color }}>{estado.txt}</Text>
                  </View>
                  <Text style={{ fontSize: 22, color: colores.suave }}>{abiertoAqui ? "⌄" : "›"}</Text>
                </Pressable>
                {abiertoAqui ? (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
                    <Text style={estilos.textoSuave}>{info.ayuda}</Text>
                    {d.estado === "por_verificar" ? null : (
                      <>
                        {foto ? <Image source={{ uri: foto }} style={{ width: "100%", aspectRatio: 1.4, borderRadius: 14, borderWidth: 1, borderColor: colores.borde }} resizeMode="contain" /> : null}
                        <View style={estilos.fila}>
                          <Boton titulo={t("📷 Tomar foto")} variante="secundario" estilo={{ flex: 1 }} onPress={() => elegir(true)} />
                          <Boton titulo={t("🖼️ Elegir")} variante="secundario" estilo={{ flex: 1 }} onPress={() => elegir(false)} />
                        </View>
                        {d.vence ? <Campo etiqueta={t("Vence el")} value={vence} onChangeText={setVence} placeholder="31-12-2027" keyboardType="numbers-and-punctuation" /> : null}
                        <Boton titulo={d.documento_id ? t("Subir el nuevo") : t("Enviar para revisar")} cargando={enviando} onPress={() => enviar(d)} />
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      <Text style={estilos.textoSuave}>{t("🔒 Los documentos solo los ve la empresa.")}</Text>
    </Pantalla>
  );
}
