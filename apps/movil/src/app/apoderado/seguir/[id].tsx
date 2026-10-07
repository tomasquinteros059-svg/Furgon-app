// Seguimiento en vivo del furgón (estilo Uber).
//  - Antes del aviso: zona aproximada (~1 km) que se mueve, paradas que faltan y ETA.
//  - Desde el aviso hasta la entrega: furgón exacto y trayecto recorrido desde el aviso.
// Las reglas de privacidad las aplica el servidor (seguimiento_furgon y RLS de posiciones).
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Boton, colores } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";

interface Punto {
  latitude: number;
  longitude: number;
}

interface Seguimiento {
  recorrido_id: string;
  tipo: "ida" | "vuelta";
  iniciado_en: string;
  estado: "pendiente" | "entregado" | "ausente" | "no_viaja";
  eta_seg: number | null;
  marcado_en: string | null;
  paradas_antes: number;
  aviso_en: string | null;
  confirmado_en: string | null;
  conductor: string | null;
  patente: string | null;
  furgon: string | null;
  casa: { lat: number; lng: number };
  ubicacion: { exacta: boolean; lat: number; lng: number; radio_m?: number; en: string } | null;
}

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(iso));

export default function SeguirFurgon() {
  const { id: alumnoId, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const mapa = useRef<MapView>(null);
  const [s, setS] = useState<Seguimiento | null | undefined>(undefined);
  const [trazo, setTrazo] = useState<Punto[]>([]);

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc("seguimiento_furgon", { p_alumno: alumnoId });
    const seg = (data as Seguimiento | null) ?? null;
    setS(seg);
    if (seg?.ubicacion?.exacta && seg.aviso_en) {
      // RLS solo entrega las posiciones registradas desde el aviso.
      const { data: pos } = await supabase
        .from("posiciones")
        .select("lat, lng")
        .eq("recorrido_id", seg.recorrido_id)
        .order("registrada_en")
        .limit(500);
      setTrazo((pos ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })));
    } else {
      setTrazo([]);
    }
  }, [alumnoId]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 5_000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Tiempo real: cada posición nueva (visible solo dentro de la ventana permitida).
  useEffect(() => {
    if (!s?.recorrido_id) return;
    const canal = supabase
      .channel(`seguir-${s.recorrido_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posiciones", filter: `recorrido_id=eq.${s.recorrido_id}` }, () => cargar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [s?.recorrido_id, cargar]);

  const casa: Punto | null = s ? { latitude: s.casa.lat, longitude: s.casa.lng } : null;
  const furgon: Punto | null = s?.ubicacion ? { latitude: s.ubicacion.lat, longitude: s.ubicacion.lng } : null;

  // Cámara: encuadra el furgón (o su zona) y la casa, como en las apps de transporte.
  useEffect(() => {
    if (!casa) return;
    const puntos = furgon ? [casa, furgon] : [casa];
    mapa.current?.fitToCoordinates(puntos, {
      edgePadding: { top: 120, right: 60, bottom: 340, left: 60 },
      animated: true,
    });
  }, [casa?.latitude, casa?.longitude, furgon?.latitude, furgon?.longitude]);

  const exacta = !!s?.ubicacion?.exacta;
  const titulo = !s ? "" : s.estado === "entregado" ? `${nombre ?? "Tu hijo/a"} llegó a casa`
    : s.estado !== "pendiente" ? "Hoy no viaja"
    : s.eta_seg !== null && s.eta_seg < 90 ? "El furgón está llegando"
    : s.eta_seg !== null ? `Llega en ${Math.max(1, Math.round(s.eta_seg / 60))} min` : "Furgón en camino";

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <MapView
        ref={mapa}
        style={StyleSheet.absoluteFill}
        initialRegion={casa ? { ...casa, latitudeDelta: 0.03, longitudeDelta: 0.03 } : undefined}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
      >
        {casa ? (
          <Marker coordinate={casa} title="Tu casa" anchor={{ x: 0.5, y: 1 }}>
            <Text style={{ fontSize: 34 }}>🏠</Text>
          </Marker>
        ) : null}
        {exacta && trazo.length > 1 ? (
          <Polyline coordinates={trazo} strokeColor={colores.azul} strokeWidth={5} />
        ) : null}
        {exacta && furgon && casa ? (
          <Polyline coordinates={[furgon, casa]} strokeColor={colores.azul} strokeWidth={3} lineDashPattern={[6, 8]} />
        ) : null}
        {furgon && !exacta ? (
          <Circle center={furgon} radius={s?.ubicacion?.radio_m ?? 1000}
            fillColor="rgba(242,183,5,0.25)" strokeColor="rgba(242,183,5,0.9)" strokeWidth={2} />
        ) : null}
        {furgon && exacta ? (
          <Marker coordinate={furgon} anchor={{ x: 0.5, y: 0.5 }} title="Furgón">
            <View style={estilos.van}><Text style={{ fontSize: 22 }}>🚐</Text></View>
          </Marker>
        ) : null}
      </MapView>

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <Pressable onPress={() => router.back()} style={estilos.volver} accessibilityRole="button">
          <Text style={{ fontSize: 16, fontWeight: "700", color: colores.azul }}>‹ Volver</Text>
        </Pressable>
      </SafeAreaView>

      <View style={estilos.hoja}>
        {s === undefined ? (
          <Text style={estilos.suave}>Cargando…</Text>
        ) : s === null ? (
          <>
            <Text style={estilos.titulo}>Sin recorrido en curso</Text>
            <Text style={estilos.suave}>El mapa se activa cuando la tía inicia el recorrido.</Text>
            <Boton titulo="Volver" variante="secundario" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Text style={estilos.titulo}>{titulo}</Text>
            <Text style={estilos.suave}>
              {s.estado === "entregado" && s.marcado_en ? `Entregado/a a las ${hora(s.marcado_en)}.`
                : exacta ? `Aviso enviado a las ${hora(s.aviso_en!)}${s.confirmado_en ? " · confirmado ✓" : ""}. Ubicación exacta en vivo.`
                : s.paradas_antes > 0 ? `Faltan ${s.paradas_antes} parada${s.paradas_antes === 1 ? "" : "s"} antes de tu casa. Ubicación aproximada.`
                : "Tu casa es la próxima parada. Ubicación aproximada hasta el aviso."}
            </Text>
            <View style={estilos.pasos}>
              {[
                { ok: true, txt: s.tipo === "ida" ? "Salió a buscar" : "Salió del colegio" },
                { ok: !!s.aviso_en, txt: "Aviso" },
                { ok: s.estado === "entregado", txt: s.tipo === "ida" ? "Subió" : "En casa" },
              ].map((p, i) => (
                <View key={i} style={{ flex: 1, gap: 4 }}>
                  <View style={[estilos.barra, { backgroundColor: p.ok ? colores.verde : colores.borde }]} />
                  <Text style={[estilos.suave, { fontSize: 12 }]}>{p.txt}</Text>
                </View>
              ))}
            </View>
            <View style={estilos.conductor}>
              <View style={estilos.avatar}><Text style={{ fontWeight: "700", fontSize: 18 }}>{(s.conductor ?? "?")[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 16, color: colores.texto }}>{s.conductor ?? "Conductor/a"}</Text>
                <Text style={estilos.suave}>{s.furgon ?? "Furgón"}</Text>
              </View>
              {s.patente ? <Text style={estilos.patente}>{s.patente}</Text> : null}
            </View>
            <Text style={[estilos.suave, { fontSize: 12 }]}>
              🔒 Por privacidad, la ubicación exacta se muestra solo desde tu aviso hasta la entrega.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  volver: { margin: 12, alignSelf: "flex-start", backgroundColor: colores.tarjeta, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 3 },
  hoja: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colores.tarjeta, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: 32, gap: 10, elevation: 12, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12,
  },
  titulo: { fontSize: 26, fontWeight: "800", color: colores.texto },
  suave: { fontSize: 14, color: colores.suave },
  pasos: { flexDirection: "row", gap: 6 },
  barra: { height: 5, borderRadius: 3 },
  conductor: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: colores.borde, paddingTop: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colores.amarillo, alignItems: "center", justifyContent: "center" },
  patente: { fontWeight: "800", borderWidth: 2, borderColor: colores.texto, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, color: colores.texto },
  van: { backgroundColor: colores.amarillo, borderRadius: 18, padding: 4, borderWidth: 2, borderColor: "#2A2100" },
});
