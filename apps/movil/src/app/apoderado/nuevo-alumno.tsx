import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Aviso, Boton, Campo, estilos, Pantalla } from "../../componentes/ui";
import { type Conexion, misConexiones } from "../../lib/conexiones";
import { normalizarTelefono } from "../../lib/core";
import { mensajeError, supabase } from "../../lib/supabase";

const SANTIAGO: Region = { latitude: -33.4489, longitude: -70.6693, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function NuevoAlumno() {
  const mapa = useRef<MapView>(null);
  const [nombre, setNombre] = useState("");
  const [colegio, setColegio] = useState("");
  const [curso, setCurso] = useState("");
  const [direccion, setDireccion] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [contacto1, setContacto1] = useState({ nombre: "", telefono: "" });
  const [contacto2, setContacto2] = useState({ nombre: "", telefono: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Con más de una tía conectada (hermanos en furgones distintos), se elige con quién va.
  const [tias, setTias] = useState<Conexion[]>([]);
  const [tia, setTia] = useState<string | null>(null);

  useEffect(() => {
    misConexiones().then((c) => {
      const aceptadas = c.filter((x) => x.estado === "aceptada");
      setTias(aceptadas);
      if (aceptadas.length === 1) setTia(aceptadas[0].otro_id);
    }).catch(() => {});
  }, []);

  // Centra el mapa en la ubicación actual (útil si se registra desde la casa).
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapa.current?.animateToRegion({ ...pos.coords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
    })().catch(() => {});
  }, []);

  async function buscarDireccion() {
    if (!direccion.trim()) return;
    try {
      const [r] = await Location.geocodeAsync(direccion);
      if (!r) return setError("No encontramos esa dirección. Ubica el pin manualmente.");
      const punto = { latitude: r.latitude, longitude: r.longitude };
      setPin(punto);
      mapa.current?.animateToRegion({ ...punto, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 500);
    } catch {
      setError("No pudimos buscar la dirección. Ubica el pin manualmente.");
    }
  }

  async function guardar() {
    setError(null);
    if (tias.length > 1 && !tia) return setError("Elige con qué tía o tío va al colegio.");
    if (!pin) return setError("Marca en el mapa la puerta de tu casa: así el aviso será exacto.");
    const tel1 = normalizarTelefono(contacto1.telefono);
    if (!tel1) return setError("Revisa el teléfono del contacto principal.");
    const tel2 = contacto2.telefono.trim() ? normalizarTelefono(contacto2.telefono) : null;
    if (contacto2.telefono.trim() && !tel2) return setError("Revisa el teléfono del contacto secundario.");

    setGuardando(true);
    const { error } = await supabase.rpc("registrar_alumno", {
      p_datos: {
        nombre, colegio, curso, minutos_aviso: 5, conductor_id: tia,
        domicilio: { direccion, lat: pin.latitude, lng: pin.longitude, indicaciones },
        contactos: [
          { nombre: contacto1.nombre || "Contacto principal", telefono: tel1, prioridad: 1 },
          ...(tel2 ? [{ nombre: contacto2.nombre || "Contacto secundario", telefono: tel2, prioridad: 2 }] : []),
        ],
      },
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    router.back();
  }

  return (
    <Pantalla titulo="Registrar alumno">
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {tias.length > 1 ? (
        <View style={{ marginBottom: 14, gap: 6 }}>
          <Text style={estilos.etiqueta}>¿Con qué tía o tío va?</Text>
          {tias.map((t) => (
            <Boton key={t.otro_id} titulo={`${tia === t.otro_id ? "✓ " : ""}${t.otro_nombre}${t.empresa ? ` · ${t.empresa}` : ""}`}
              variante={tia === t.otro_id ? "primario" : "secundario"} onPress={() => setTia(t.otro_id)} />
          ))}
        </View>
      ) : null}
      <Campo etiqueta="Nombre del alumno" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Colegio" value={colegio} onChangeText={setColegio} />
      <Campo etiqueta="Curso" value={curso} onChangeText={setCurso} placeholder="Ej: 3° Básico" />

      <Text style={estilos.subtitulo}>Dirección</Text>
      <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} onSubmitEditing={buscarDireccion}
        placeholder="Calle, número, comuna" returnKeyType="search" />
      <Boton titulo="Buscar en el mapa" variante="secundario" onPress={buscarDireccion} />
      <Text style={[estilos.textoSuave, { marginVertical: 8 }]}>
        Toca el mapa o arrastra el pin hasta la puerta de tu casa.
      </Text>
      <View style={{ height: 280, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
        <MapView
          ref={mapa}
          style={{ flex: 1 }}
          initialRegion={SANTIAGO}
          showsUserLocation
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
        >
          {pin ? <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)} /> : null}
        </MapView>
      </View>
      <Campo etiqueta="Indicaciones para el conductor (opcional)" value={indicaciones} onChangeText={setIndicaciones}
        placeholder="Ej: portón verde, depto 302" />

      <Text style={estilos.subtitulo}>Teléfonos para la llamada automática</Text>
      <Campo etiqueta="Contacto principal · nombre" value={contacto1.nombre} onChangeText={(t) => setContacto1({ ...contacto1, nombre: t })} />
      <Campo etiqueta="Contacto principal · teléfono" value={contacto1.telefono} keyboardType="phone-pad" placeholder="9 1234 5678"
        onChangeText={(t) => setContacto1({ ...contacto1, telefono: t })} />
      <Campo etiqueta="Contacto secundario · nombre (opcional)" value={contacto2.nombre} onChangeText={(t) => setContacto2({ ...contacto2, nombre: t })} />
      <Campo etiqueta="Contacto secundario · teléfono" value={contacto2.telefono} keyboardType="phone-pad"
        ayuda="Si el principal no contesta dos veces, llamamos a este número."
        onChangeText={(t) => setContacto2({ ...contacto2, telefono: t })} />

      <Aviso texto="El administrador del furgón asignará al alumno a la ruta correspondiente." />
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} deshabilitado={!nombre || !direccion} />
    </Pantalla>
  );
}
