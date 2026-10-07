// La tía o el tío sube su licencia de conducir (datos y fotos). La empresa la verifica y la app
// avisa antes de que venza. Con la licencia vencida no se pueden iniciar recorridos.
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Text, View } from "react-native";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { aFecha, type EstadoLic, textoLicencia } from "../../lib/licencia";
import { mensajeError, supabase } from "../../lib/supabase";

const CLASES = ["A1", "A3", "A2", "A4", "A5", "B"] as const;
/** dd-mm-aaaa → aaaa-mm-dd (o null si no es una fecha válida). */
function leerFecha(t: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : iso;
}

export default function MiLicencia() {
  const { perfil } = useSesion();
  const [lic, setLic] = useState<EstadoLic | null>(null);
  const [numero, setNumero] = useState("");
  const [clase, setClase] = useState<string>("A3");
  const [vence, setVence] = useState("");
  const [fotos, setFotos] = useState<{ frente: string | null; reverso: string | null }>({ frente: null, reverso: null });
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc("estado_licencias");
    setLic(((data as (EstadoLic & { conductor_id: string })[]) ?? []).find((x) => x.conductor_id === perfil?.id) ?? null);
  }, [perfil?.id]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function tomarFoto(lado: "frente" | "reverso", camara: boolean) {
    const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return setMsg({ ok: false, txt: "Necesitamos permiso para la cámara o las fotos." });
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [16, 10] };
    const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets[0]) setFotos((f) => ({ ...f, [lado]: r.assets[0].uri }));
  }

  async function subirFoto(uri: string, lado: string): Promise<string> {
    const ruta = `${perfil!.id}/${Date.now()}-${lado}.jpg`;
    const cuerpo = await (await fetch(uri)).arrayBuffer();
    const { error } = await supabase.storage.from("licencias").upload(ruta, cuerpo, { contentType: "image/jpeg" });
    if (error) throw error;
    return ruta;
  }

  async function enviar() {
    setMsg(null);
    const iso = leerFecha(vence);
    if (numero.trim().length < 3) return setMsg({ ok: false, txt: "Escribe el número de la licencia (tu RUT)." });
    if (!iso) return setMsg({ ok: false, txt: "Escribe la fecha de vencimiento como 31-12-2027." });
    if (!fotos.frente) return setMsg({ ok: false, txt: "Falta la foto del frente de la licencia." });
    setEnviando(true);
    try {
      const frente = await subirFoto(fotos.frente, "frente");
      const reverso = fotos.reverso ? await subirFoto(fotos.reverso, "reverso") : null;
      const { error } = await supabase.rpc("subir_licencia", { p_numero: numero, p_clase: clase, p_vence_en: iso, p_foto_frente: frente, p_foto_reverso: reverso });
      if (error) throw error;
      setMsg({ ok: true, txt: "Licencia enviada. Te avisaremos cuando la empresa la verifique." });
      setNumero(""); setVence(""); setFotos({ frente: null, reverso: null });
      cargar();
    } catch (e) {
      setMsg({ ok: false, txt: mensajeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  const estado = textoLicencia(lic);
  const pedirNueva = !lic || lic.estado !== "por_verificar";
  return (
    <Pantalla titulo="Mi licencia" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Aviso tipo={estado.tono} texto={estado.txt} />
      {lic?.numero ? (
        <Tarjeta>
          <Text style={estilos.texto}>N° {lic.numero} · Clase {lic.clase}</Text>
          {lic.vence_en ? <Text style={estilos.textoSuave}>Vence el {aFecha(lic.vence_en)}</Text> : null}
        </Tarjeta>
      ) : null}
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}
      {pedirNueva ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>{lic?.numero ? "Subir licencia renovada" : "Subir mi licencia"}</Text>
          <Campo etiqueta="Número (RUT)" value={numero} onChangeText={setNumero} placeholder="12.345.678-9" autoCapitalize="characters" />
          <Text style={estilos.etiqueta}>Clase</Text>
          <View style={[estilos.fila, { flexWrap: "wrap", marginBottom: 10 }]}>
            {CLASES.map((c) => <Boton key={c} titulo={c} variante={clase === c ? "primario" : "secundario"} estilo={{ minHeight: 40, paddingHorizontal: 14 }} onPress={() => setClase(c)} />)}
          </View>
          <Campo etiqueta="Vence el" value={vence} onChangeText={setVence} placeholder="31-12-2027" keyboardType="numbers-and-punctuation" />
          {(["frente", "reverso"] as const).map((lado) => (
            <View key={lado} style={{ gap: 6, marginBottom: 10 }}>
              <Text style={estilos.etiqueta}>Foto del {lado}{lado === "reverso" ? " (opcional)" : ""}</Text>
              {fotos[lado] ? <Image source={{ uri: fotos[lado]! }} style={{ width: "100%", aspectRatio: 1.6, borderRadius: 10, borderWidth: 1, borderColor: colores.borde }} /> : null}
              <View style={estilos.fila}>
                <Boton titulo="📷 Tomar foto" variante="secundario" estilo={{ flex: 1 }} onPress={() => tomarFoto(lado, true)} />
                <Boton titulo="🖼️ Elegir" variante="secundario" estilo={{ flex: 1 }} onPress={() => tomarFoto(lado, false)} />
              </View>
            </View>
          ))}
          <Boton titulo="Enviar para verificar" cargando={enviando} onPress={enviar} />
          <Text style={estilos.textoSuave}>🔒 Las fotos solo las ve la empresa para verificarla.</Text>
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
