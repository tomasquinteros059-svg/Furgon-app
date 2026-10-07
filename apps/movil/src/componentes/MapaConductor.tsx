// Mapa de la conductora: Google Maps con el furgón amarillo en su posición real (GPS de su
// celular), las casas por visitar y la ruta por calles que entrega Google.
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./icono";
import MapView, { Marker, Polyline } from "react-native-maps";
import { decodificarPolilinea } from "../lib/core";
import { llamarFuncion } from "../lib/supabase";
import { estiloMapa, Furgon, PinCasa, PROVEEDOR_MAPA } from "./mapa";
import { colores } from "./ui";
import { esOscuro } from "./tema";

export interface CasaMapa {
  id: string;
  numero: number;
  lat: number;
  lng: number;
  estado: "pendiente" | "entregado" | "ausente" | "no_viaja";
  avisado: boolean;
}

type Punto = { latitude: number; longitude: number };

export function MapaConductor({ recorridoId, casas, alto = 280 }: { recorridoId: string; casas: CasaMapa[]; alto?: number }) {
  const mapa = useRef<MapView>(null);
  const [yo, setYo] = useState<Punto | null>(null);
  const [haciaIzquierda, setHaciaIzquierda] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const [ruta, setRuta] = useState<Punto[] | null>(null);
  const ultimoTrazado = useRef<{ clave: string; t: number }>({ clave: "", t: 0 });
  const pendientes = casas.filter((c) => c.estado === "pendiente");

  // Posición en pantalla (la que se envía al servidor la toma la tarea en segundo plano).
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (l) => {
      setYo((previo) => {
        if (previo && Math.abs(l.coords.longitude - previo.longitude) > 0.00003) setHaciaIzquierda(l.coords.longitude < previo.longitude);
        return { latitude: l.coords.latitude, longitude: l.coords.longitude };
      });
    }).then((s) => { sub = s; }).catch(() => {});
    return () => sub?.remove();
  }, []);

  // Ruta por calles desde Google: al empezar, cuando cambian las paradas y cada 2 minutos.
  useEffect(() => {
    if (!yo) return;
    const clave = pendientes.map((c) => c.id).join(",");
    const ahora = Date.now();
    if (clave === ultimoTrazado.current.clave && ahora - ultimoTrazado.current.t < 120_000) return;
    ultimoTrazado.current = { clave, t: ahora };
    llamarFuncion<{ polilinea: string | null }>("trazado-ruta", { recorrido_id: recorridoId, lat: yo.latitude, lng: yo.longitude })
      .then((r) => setRuta(r.polilinea ? decodificarPolilinea(r.polilinea).map((p) => ({ latitude: p.lat, longitude: p.lng })) : null))
      .catch(() => setRuta(null));
  }, [yo, recorridoId, pendientes.map((c) => c.id).join(",")]);

  // Cámara que acompaña al furgón, salvo que la conductora mueva el mapa.
  useEffect(() => {
    if (yo && seguir) mapa.current?.animateCamera({ center: yo, zoom: 16 }, { duration: 600 });
  }, [yo, seguir]);

  const respaldo: Punto[] = yo ? [yo, ...pendientes.map((c) => ({ latitude: c.lat, longitude: c.lng }))] : [];
  const inicial = yo ?? (casas[0] ? { latitude: casas[0].lat, longitude: casas[0].lng } : { latitude: -33.4489, longitude: -70.6693 });

  return (
    <View style={{ height: alto, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colores.borde }}>
      <MapView
        ref={mapa}
        provider={PROVEEDOR_MAPA}
        style={{ flex: 1 }}
        customMapStyle={estiloMapa(esOscuro())}
        initialRegion={{ ...inicial, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsTraffic
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        onPanDrag={() => setSeguir(false)}
      >
        {ruta ? (
          <>
            <Polyline coordinates={ruta} strokeColor="#FFFFFF" strokeWidth={10} />
            <Polyline coordinates={ruta} strokeColor={colores.azul} strokeWidth={6} />
          </>
        ) : respaldo.length > 1 ? (
          <Polyline coordinates={respaldo} strokeColor={colores.azul} strokeWidth={4} lineDashPattern={[8, 8]} />
        ) : null}
        {casas.filter((c) => c.estado !== "no_viaja").map((c) => (
          <Marker key={c.id} coordinate={{ latitude: c.lat, longitude: c.lng }} anchor={{ x: 0.5, y: 1 }} title={`Parada ${c.numero}`}>
            <PinCasa numero={c.estado === "entregado" ? "✓" : c.numero}
              color={c.estado === "entregado" ? colores.verde : c.estado === "ausente" ? colores.suave : c.avisado ? colores.rojo : colores.azul} />
          </Marker>
        ))}
        {yo ? (
          <Marker coordinate={yo} anchor={{ x: 0.5, y: 0.85 }} zIndex={10} title="Tu furgón">
            <Furgon haciaIzquierda={haciaIzquierda} />
          </Marker>
        ) : null}
      </MapView>
      {!seguir ? (
        <Pressable onPress={() => setSeguir(true)} accessibilityRole="button"
          style={{ position: "absolute", right: 10, bottom: 10, backgroundColor: colores.tarjeta, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 4 }}>
          <Text style={{ fontWeight: "700", color: colores.azul }}>◎ Centrar</Text>
        </Pressable>
      ) : null}
      {!yo ? (
        <View style={{ position: "absolute", left: 10, top: 10, backgroundColor: colores.tarjeta, borderRadius: 12, padding: 8 }}>
          <Text style={{ color: colores.suave }}>Buscando tu ubicación…</Text>
        </View>
      ) : null}
    </View>
  );
}
