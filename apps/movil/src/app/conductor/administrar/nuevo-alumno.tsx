// La tía agrega un alumno a su ruta: datos, pin exacto de la casa, teléfonos y código para la familia.
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../../componentes/icono";
import MapView, { Marker } from "react-native-maps";
import { estiloMapa, PinCasa, PROVEEDOR_MAPA } from "../../../componentes/mapa";
import { Aviso, Boton, Campo, colores, estilos, Pantalla } from "../../../componentes/ui";
import { normalizarTelefono } from "../../../lib/core";
import { mensajeError, supabase } from "../../../lib/supabase";
import { compartirCodigo } from "../../../lib/familia";
import { esOscuro } from "../../../componentes/tema";
import { t } from "../../../lib/idioma";

export default function NuevoAlumnoAdmin() {
  const mapa = useRef<MapView>(null);
  const [f, setF] = useState({ nombre: "", curso: "", colegio: "", direccion: "", indicaciones: "", c1n: "", c1t: "", c2n: "", c2t: "" });
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [rutas, setRutas] = useState<{ id: string; nombre: string }[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    // Solo las rutas de esta tía (con permiso de administrar, RLS también mostraría las de otras).
    supabase.auth.getUser().then(({ data: u }) =>
      supabase.from("rutas").select("id, nombre").eq("activa", true).eq("conductor_id", u.user?.id ?? "").order("nombre"),
    ).then(({ data }) => {
      setRutas(data ?? []); setElegidas((data ?? []).map((r) => r.id));
    });
  }, []);

  async function buscar() {
    try {
      const [r] = await Location.geocodeAsync(f.direccion);
      if (!r) return setError(t("No encontramos esa dirección: ubica el pin tocando el mapa."));
      const p = { latitude: r.latitude, longitude: r.longitude };
      setPin(p); mapa.current?.animateToRegion({ ...p, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 500);
    } catch { setError(t("No pudimos buscar la dirección: ubica el pin tocando el mapa.")); }
  }

  async function guardar() {
    setError(null);
    if (!f.nombre.trim() || !f.direccion.trim()) return setError(t("Falta el nombre o la dirección."));
    if (!pin) return setError(t("Marca la casa en el mapa: así el aviso llega a tiempo."));
    const t1 = normalizarTelefono(f.c1t);
    if (!t1) return setError(t("Revisa el teléfono principal (ej: 9 1234 5678)."));
    const t2 = f.c2t.trim() ? normalizarTelefono(f.c2t) : null;
    if (f.c2t.trim() && !t2) return setError(t("Revisa el teléfono secundario."));
    setGuardando(true);
    const { data, error } = await supabase.rpc("admin_crear_alumno", { p_datos: {
      nombre: f.nombre.trim(), curso: f.curso.trim(), colegio: f.colegio.trim(), minutos_aviso: 5,
      domicilio: { direccion: f.direccion.trim(), lat: pin.latitude, lng: pin.longitude, indicaciones: f.indicaciones.trim() || null },
      // Nombres por defecto de los contactos: se guardan como dato, en español. // i18n-ignorar
      contactos: [{ nombre: f.c1n.trim() || "Principal", telefono: t1, prioridad: 1 }, ...(t2 ? [{ nombre: f.c2n.trim() || "Secundario", telefono: t2, prioridad: 2 }] : [])],
      ruta_ids: elegidas,
    } });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    setCreado({ id: (data as { alumno_id: string }).alumno_id, nombre: f.nombre.trim() });
  }

  if (creado) {
    return (
      <Pantalla titulo={t("{nombre} quedó en tu ruta", { nombre: creado.nombre })}>
        <Aviso tipo="exito" texto={t("Ya aparece en tu recorrido. Envía el código a la familia para que reciba los avisos.")} />
        <Boton titulo={t("Enviar código a la familia")} onPress={() => compartirCodigo(creado.id, creado.nombre).catch((e) => setError(mensajeError(e)))} />
        <Boton titulo={t("Listo")} variante="secundario" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  const campo = (k: keyof typeof f, etiqueta: string, extra: object = {}) => (
    <Campo etiqueta={etiqueta} value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} {...extra} />
  );
  return (
    <Pantalla titulo={t("Agregar alumno")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {campo("nombre", t("Nombre y apellido"))}
      {campo("curso", t("Curso"), { placeholder: t("Ej: 3° Básico") })}
      {campo("colegio", t("Colegio"))}
      {campo("direccion", t("Dirección"), { placeholder: t("Calle, número, comuna"), onSubmitEditing: buscar, returnKeyType: "search" })}
      <Boton titulo={t("Buscar en el mapa")} variante="secundario" onPress={buscar} />
      <View style={{ height: 260, borderRadius: 14, overflow: "hidden", marginVertical: 10 }}>
        <MapView ref={mapa} provider={PROVEEDOR_MAPA} customMapStyle={estiloMapa(esOscuro())} style={{ flex: 1 }}
          initialRegion={{ latitude: -33.4489, longitude: -70.6693, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}>
          {pin ? <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)} anchor={{ x: 0.5, y: 1 }}><PinCasa numero="🏠" color={colores.rojo} /></Marker> : null}
        </MapView>
      </View>
      {campo("indicaciones", t("Indicaciones (opcional)"), { placeholder: t("Ej: portón verde") })}
      <Text style={estilos.subtitulo}>{t("Teléfonos para los avisos")}</Text>
      {campo("c1n", t("Principal · nombre"), { placeholder: t("Ej: Ana (mamá)") })}
      {campo("c1t", t("Principal · teléfono"), { keyboardType: "phone-pad", placeholder: "9 1234 5678" })}
      {campo("c2n", t("Secundario · nombre (opcional)"))}
      {campo("c2t", t("Secundario · teléfono"), { keyboardType: "phone-pad" })}
      <Text style={estilos.subtitulo}>{t("Rutas")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {rutas.map((r) => {
          const on = elegidas.includes(r.id);
          return (
            <Pressable key={r.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              onPress={() => setElegidas(on ? elegidas.filter((x) => x !== r.id) : [...elegidas, r.id])}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: on ? colores.amarillo : colores.superficie }}>
              <Text style={{ color: on ? colores.sobreAmarillo : colores.texto, fontWeight: "600" }}>{on ? "✓ " : ""}{r.nombre}</Text>
            </Pressable>
          );
        })}
      </View>
      <Boton titulo={t("Guardar alumno")} onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}
