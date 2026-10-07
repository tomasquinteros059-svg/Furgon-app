// La tía agrega un alumno a su ruta: datos, pin exacto de la casa, teléfonos y código para la familia.
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../../componentes/icono";
import MapView, { Marker } from "react-native-maps";
import { ESTILO_MAPA, PinCasa, PROVEEDOR_MAPA } from "../../../componentes/mapa";
import { Aviso, Boton, Campo, colores, estilos, Pantalla } from "../../../componentes/ui";
import { normalizarTelefono } from "../../../lib/core";
import { mensajeError, supabase } from "../../../lib/supabase";
import { compartirCodigo } from "../../../lib/familia";

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
    supabase.from("rutas").select("id, nombre").eq("activa", true).order("nombre").then(({ data }) => {
      setRutas(data ?? []); setElegidas((data ?? []).map((r) => r.id));
    });
  }, []);

  async function buscar() {
    try {
      const [r] = await Location.geocodeAsync(f.direccion);
      if (!r) return setError("No encontramos esa dirección: ubica el pin tocando el mapa.");
      const p = { latitude: r.latitude, longitude: r.longitude };
      setPin(p); mapa.current?.animateToRegion({ ...p, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 500);
    } catch { setError("No pudimos buscar la dirección: ubica el pin tocando el mapa."); }
  }

  async function guardar() {
    setError(null);
    if (!f.nombre.trim() || !f.direccion.trim()) return setError("Falta el nombre o la dirección.");
    if (!pin) return setError("Marca la casa en el mapa: así el aviso llega a tiempo.");
    const t1 = normalizarTelefono(f.c1t);
    if (!t1) return setError("Revisa el teléfono principal (ej: 9 1234 5678).");
    const t2 = f.c2t.trim() ? normalizarTelefono(f.c2t) : null;
    if (f.c2t.trim() && !t2) return setError("Revisa el teléfono secundario.");
    setGuardando(true);
    const { data, error } = await supabase.rpc("admin_crear_alumno", { p_datos: {
      nombre: f.nombre.trim(), curso: f.curso.trim(), colegio: f.colegio.trim(), minutos_aviso: 5,
      domicilio: { direccion: f.direccion.trim(), lat: pin.latitude, lng: pin.longitude, indicaciones: f.indicaciones.trim() || null },
      contactos: [{ nombre: f.c1n.trim() || "Principal", telefono: t1, prioridad: 1 }, ...(t2 ? [{ nombre: f.c2n.trim() || "Secundario", telefono: t2, prioridad: 2 }] : [])],
      ruta_ids: elegidas,
    } });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    setCreado({ id: (data as { alumno_id: string }).alumno_id, nombre: f.nombre.trim() });
  }

  if (creado) {
    return (
      <Pantalla titulo={`${creado.nombre} quedó en tu ruta`}>
        <Aviso tipo="exito" texto="Ya aparece en tu recorrido. Envía el código a la familia para que reciba los avisos." />
        <Boton titulo="Enviar código a la familia" onPress={() => compartirCodigo(creado.id, creado.nombre).catch((e) => setError(mensajeError(e)))} />
        <Boton titulo="Listo" variante="secundario" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  const campo = (k: keyof typeof f, etiqueta: string, extra: object = {}) => (
    <Campo etiqueta={etiqueta} value={f[k]} onChangeText={(t) => setF({ ...f, [k]: t })} {...extra} />
  );
  return (
    <Pantalla titulo="Agregar alumno" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {campo("nombre", "Nombre y apellido")}
      {campo("curso", "Curso", { placeholder: "Ej: 3° Básico" })}
      {campo("colegio", "Colegio")}
      {campo("direccion", "Dirección", { placeholder: "Calle, número, comuna", onSubmitEditing: buscar, returnKeyType: "search" })}
      <Boton titulo="Buscar en el mapa" variante="secundario" onPress={buscar} />
      <View style={{ height: 260, borderRadius: 14, overflow: "hidden", marginVertical: 10 }}>
        <MapView ref={mapa} provider={PROVEEDOR_MAPA} customMapStyle={ESTILO_MAPA} style={{ flex: 1 }}
          initialRegion={{ latitude: -33.4489, longitude: -70.6693, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}>
          {pin ? <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)} anchor={{ x: 0.5, y: 1 }}><PinCasa numero="🏠" color={colores.rojo} /></Marker> : null}
        </MapView>
      </View>
      {campo("indicaciones", "Indicaciones (opcional)", { placeholder: "Ej: portón verde" })}
      <Text style={estilos.subtitulo}>Teléfonos para los avisos</Text>
      {campo("c1n", "Principal · nombre", { placeholder: "Ej: Ana (mamá)" })}
      {campo("c1t", "Principal · teléfono", { keyboardType: "phone-pad", placeholder: "9 1234 5678" })}
      {campo("c2n", "Secundario · nombre (opcional)")}
      {campo("c2t", "Secundario · teléfono", { keyboardType: "phone-pad" })}
      <Text style={estilos.subtitulo}>Rutas</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {rutas.map((r) => {
          const on = elegidas.includes(r.id);
          return (
            <Pressable key={r.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              onPress={() => setElegidas(on ? elegidas.filter((x) => x !== r.id) : [...elegidas, r.id])}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: on ? colores.azul : colores.tarjeta }}>
              <Text style={{ color: on ? "#fff" : colores.texto, fontWeight: "600" }}>{on ? "✓ " : ""}{r.nombre}</Text>
            </Pressable>
          );
        })}
      </View>
      <Boton titulo="Guardar alumno" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}
