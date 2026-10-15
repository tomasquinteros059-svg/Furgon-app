// Destino final de una ruta: el colegio o los colegios. En la ida son las últimas paradas; en la
// vuelta, las primeras. Se agregan por dirección (o con la ubicación actual, si la tía está ahí).
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { t } from "../lib/idioma";
import { mensajeError, supabase } from "../lib/supabase";
import { Icono, Text } from "./icono";
import { Boton, Campo, colores, estilos } from "./ui";

export interface Destino { id: string; orden: number; nombre: string; direccion: string | null }

export function DestinosRuta({ rutaId, tipo, destinos, onCambio, onError }: {
  rutaId: string; tipo: "ida" | "vuelta"; destinos: Destino[]; onCambio: () => void; onError: (m: string | null) => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const lista = [...destinos].sort((a, b) => a.orden - b.orden);

  async function guardar(usarMiUbicacion: boolean) {
    onError(null);
    if (!nombre.trim()) return onError(t("Escribe el nombre del colegio."));
    if (!usarMiUbicacion && !direccion.trim()) return onError(t("Escribe la dirección del colegio."));
    setGuardando(true);
    try {
      let punto: { latitude: number; longitude: number } | undefined;
      if (usarMiUbicacion) {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (!permiso.granted) return onError(t("Necesitamos permiso de ubicación."));
        punto = (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })).coords;
      } else {
        [punto] = await Location.geocodeAsync(direccion);
        if (!punto) return onError(t("No encontramos esa dirección. Prueba agregando la comuna, o usa tu ubicación estando en el colegio."));
      }
      const { error } = await supabase.from("ruta_destinos").insert({
        ruta_id: rutaId, orden: (lista[lista.length - 1]?.orden ?? 0) + 1, nombre: nombre.trim(),
        direccion: direccion.trim() || null, lat: punto.latitude, lng: punto.longitude,
      });
      if (error) throw error;
      setNombre(""); setDireccion(""); setAgregando(false);
      onCambio();
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  function quitar(d: Destino) {
    Alert.alert(t("¿Quitar «{colegio}» de la ruta?", { colegio: d.nombre }), t("Los niños de ese colegio pasan al colegio principal de la ruta."), [
      { text: t("Cancelar"), style: "cancel" },
      { text: t("Quitar"), style: "destructive", onPress: async () => {
        const { error } = await supabase.from("ruta_destinos").delete().eq("id", d.id);
        if (error) onError(mensajeError(error)); else onCambio();
      } },
    ]);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: 1, color: colores.suave }}>
        {(tipo === "ida" ? t("Destino final") : t("Punto de partida")).toUpperCase()}
      </Text>
      {lista.length === 0 ? <Text style={estilos.textoSuave}>{t("Agrega el colegio para que la ruta sepa dónde termina.")}</Text> : null}
      {lista.map((d) => (
        <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.amarillo, borderRadius: 22, paddingVertical: 10, paddingLeft: 12, paddingRight: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colores.amarilloSuave, alignItems: "center", justifyContent: "center" }}>
            <Icono nombre="colegio" tam={22} color={colores.texto} acento="transparent" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "600", color: colores.texto }}>{d.nombre}</Text>
            {d.direccion ? <Text numberOfLines={1} style={{ fontSize: 14, color: colores.suave }}>{d.direccion}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Quitar de la ruta")} hitSlop={6} onPress={() => quitar(d)}
            style={{ width: 34, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22, color: colores.rojo }}>✕</Text>
          </Pressable>
        </View>
      ))}
      {agregando ? (
        <View style={{ backgroundColor: colores.superficie, borderRadius: 22, borderWidth: 2, borderColor: colores.borde, padding: 14 }}>
          <Campo etiqueta={t("Nombre del colegio")} value={nombre} onChangeText={setNombre} placeholder={t("Ej.: Colegio San José")} />
          <Campo etiqueta={t("Dirección")} value={direccion} onChangeText={setDireccion} placeholder={t("Ej.: Av. Grecia 1234, Ñuñoa")} />
          <Boton titulo={t("Agregar colegio")} cargando={guardando} onPress={() => guardar(false)} />
          <Boton titulo={t("Estoy en el colegio: usar mi ubicación")} variante="texto" deshabilitado={guardando} onPress={() => guardar(true)} />
          <Boton titulo={t("Cancelar")} variante="texto" onPress={() => setAgregando(false)} />
        </View>
      ) : (
        <Boton titulo={lista.length ? t("+ Agregar otro colegio") : t("+ Agregar colegio")} variante="texto" onPress={() => setAgregando(true)} />
      )}
    </View>
  );
}
