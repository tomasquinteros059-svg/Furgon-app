// Mi perfil (tía y familia): foto, nombre, teléfono y correo; la tía además sus comunas, su
// presentación y si aparece en la búsqueda de familias.
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Switch, View } from "react-native";
import { Avatar } from "../componentes/avatar";
import { Text } from "../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../componentes/ui";
import { formatearTelefono, normalizarTelefono } from "../lib/core";
import { useSesion } from "../lib/sesion";
import { mensajeError, supabase } from "../lib/supabase";
import { t } from "../lib/idioma";

export default function MiPerfil() {
  const { perfil, sesion, recargarPerfil } = useSesion();
  const esTia = perfil?.rol === "conductor";
  const sinProteger = !!sesion?.user.is_anonymous;
  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [telefono, setTelefono] = useState("");
  const [comunas, setComunas] = useState("");
  const [presentacion, setPresentacion] = useState("");
  const [visible, setVisible] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [fotoNueva, setFotoNueva] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  useFocusEffect(useCallback(() => {
    if (!perfil?.id) return;
    supabase.from("perfiles").select("nombre, telefono, comunas, presentacion, visible_en_busqueda, aviso_whatsapp").eq("id", perfil.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setNombre(data.nombre ?? "");
        setTelefono(data.telefono ? formatearTelefono(data.telefono) : "");
        setComunas(data.comunas ?? "");
        setPresentacion(data.presentacion ?? "");
        setVisible(!!data.visible_en_busqueda);
        setWhatsapp(!!data.aviso_whatsapp);
      });
  }, [perfil?.id]));

  async function elegirFoto(camara: boolean) {
    setMsg(null);
    const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return setMsg({ ok: false, txt: t("Necesitamos permiso para la cámara o las fotos.") });
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, allowsEditing: true, aspect: [1, 1] };
    const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets[0]) setFotoNueva(r.assets[0].uri);
  }

  async function quitarFoto() {
    if (!perfil) return;
    const { error } = await supabase.from("perfiles").update({ foto: null }).eq("id", perfil.id);
    if (error) return setMsg({ ok: false, txt: mensajeError(error) });
    setFotoNueva(null);
    await recargarPerfil();
    setMsg({ ok: true, txt: t("Foto quitada.") });
  }

  async function guardar() {
    if (!perfil) return;
    setMsg(null);
    if (nombre.trim().length < 2) return setMsg({ ok: false, txt: t("Escribe tu nombre.") });
    const tel = telefono.trim() ? normalizarTelefono(telefono) : null;
    if (telefono.trim() && !tel) return setMsg({ ok: false, txt: t("Revisa el teléfono (ej: 9 1234 5678).") });
    if (whatsapp && !tel) return setMsg({ ok: false, txt: t("Para recibir el aviso por WhatsApp, escribe tu teléfono.") });
    setGuardando(true);
    try {
      let foto: string | undefined;
      if (fotoNueva) {
        foto = `${perfil.id}/${Date.now()}.jpg`;
        const cuerpo = await (await fetch(fotoNueva)).arrayBuffer();
        const { error } = await supabase.storage.from("fotos-perfil").upload(foto, cuerpo, { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const cambios: Record<string, unknown> = { nombre: nombre.trim(), telefono: tel, ...(foto ? { foto } : {}) };
      if (!esTia) cambios.aviso_whatsapp = whatsapp;
      if (esTia) Object.assign(cambios, { comunas: comunas.trim() || null, presentacion: presentacion.trim() || null, visible_en_busqueda: visible });
      const { error } = await supabase.from("perfiles").update(cambios).eq("id", perfil.id);
      if (error) throw error;
      setFotoNueva(null);
      await recargarPerfil();
      setMsg({ ok: true, txt: t("Datos guardados.") });
    } catch (e) {
      setMsg({ ok: false, txt: mensajeError(e) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla titulo={t("Mi perfil")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {msg ? <Aviso texto={msg.txt} tipo={msg.ok ? "exito" : "error"} /> : null}

      <View style={{ alignItems: "center", gap: 10, marginVertical: 8 }}>
        <Avatar nombre={nombre || perfil?.nombre || ""} foto={perfil?.foto} uri={fotoNueva} tam={120} />
        <Text style={estilos.textoSuave}>{esTia ? t("Las familias de tu furgón ven tu foto.") : t("Tu tía o tío del furgón ve tu foto.")}</Text>
        <View style={estilos.fila}>
          <Boton titulo={t("📷 Tomar foto")} variante="secundario" onPress={() => elegirFoto(true)} />
          <Boton titulo={t("🖼️ Galería")} variante="secundario" onPress={() => elegirFoto(false)} />
        </View>
        {perfil?.foto && !fotoNueva ? <Boton titulo={t("Quitar foto")} variante="texto" onPress={quitarFoto} /> : null}
        {fotoNueva ? <Text style={estilos.textoSuave}>{t("Toca «Guardar» para dejar esta foto.")}</Text> : null}
      </View>

      <Tarjeta>
        <Campo etiqueta={t("Nombre")} value={nombre} onChangeText={setNombre} autoComplete="name" />
        <Campo etiqueta={t("Teléfono")} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="9 1234 5678"
          ayuda={esTia ? t("Para que la empresa te ubique. Las familias no lo ven en la búsqueda.") : t("Para la llamada de aviso cuando el furgón está cerca.")} />
        <Text style={estilos.etiqueta}>{t("Correo")}</Text>
        {sinProteger ? (
          <Boton titulo={t("Agregar correo y contraseña")} variante="secundario" onPress={() => router.push("/apoderado/proteger-cuenta")} />
        ) : (
          <Text style={[estilos.texto, { marginBottom: 6 }]}>{sesion?.user.email ?? "—"}</Text>
        )}
      </Tarjeta>

      {esTia ? (
        <Tarjeta>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("Que las familias me encuentren")}</Text>
              <Text style={estilos.textoSuave}>{t("Apareces en la búsqueda con tu nombre, tu furgón y tus comunas. Nunca se muestran tu teléfono ni tus rutas.")}</Text>
            </View>
            <Switch value={visible} onValueChange={setVisible} trackColor={{ true: colores.verde }} />
          </View>
          <Campo etiqueta={t("Comunas donde trabajas")} value={comunas} onChangeText={setComunas} placeholder={t("Ej: Ñuñoa, La Reina, Providencia")} />
          <Campo etiqueta={t("Presentación (opcional)")} value={presentacion} onChangeText={setPresentacion} placeholder={t("Ej: 12 años de experiencia, Colegio X")} maxLength={300} multiline />
        </Tarjeta>
      ) : null}

      {!esTia ? (
        <Tarjeta>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("Avisarme también por WhatsApp")}</Text>
              <Text style={estilos.textoSuave}>{t("Cuando el furgón esté a pocos minutos te llega un WhatsApp a tu teléfono, además de la alarma en la app.")}</Text>
            </View>
            <Switch value={whatsapp} onValueChange={setWhatsapp} trackColor={{ true: colores.verde }} accessibilityLabel={t("Avisarme también por WhatsApp")} />
          </View>
        </Tarjeta>
      ) : null}

      <Boton titulo={t("Guardar")} grande cargando={guardando} onPress={guardar} />
    </Pantalla>
  );
}
