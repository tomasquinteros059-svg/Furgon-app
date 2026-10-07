// Piezas del mapa (Google Maps vía react-native-maps): furgón escolar amarillo, casas numeradas,
// estilo de mapa limpio y enlace a la navegación de Google Maps.
import { Linking, Platform, Text, View } from "react-native";
import { PROVIDER_GOOGLE } from "react-native-maps";

/** Google Maps en Android y también en iOS (clave en app.config.ts → react-native-maps). */
export const PROVEEDOR_MAPA = PROVIDER_GOOGLE;

/** Furgón escolar chileno: amarillo, franja negra y letrero "ESCOLAR" en el techo. */
export function Furgon({ haciaIzquierda = false, tamano = 1 }: { haciaIzquierda?: boolean; tamano?: number }) {
  return (
    <View style={{ width: 60 * tamano, height: 50 * tamano, alignItems: "center" }} accessibilityLabel="Furgón escolar">
      <View style={{ position: "absolute", top: 0, left: 16 * tamano, width: 28 * tamano, height: 10 * tamano, backgroundColor: "#15202B", borderRadius: 2 * tamano, alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        <Text style={{ color: "#F5B700", fontSize: 6.5 * tamano, fontWeight: "900", letterSpacing: 0.3 }}>ESCOLAR</Text>
      </View>
      <View style={{ position: "absolute", top: 9 * tamano, width: 58 * tamano, height: 40 * tamano, transform: [{ scaleX: haciaIzquierda ? -1 : 1 }] }}>
        <View style={{ position: "absolute", left: 2 * tamano, top: 0, width: 54 * tamano, height: 27 * tamano, backgroundColor: "#F5B700", borderColor: "#2A2100", borderWidth: 2 * tamano, borderTopLeftRadius: 6 * tamano, borderBottomLeftRadius: 5 * tamano, borderTopRightRadius: 14 * tamano, borderBottomRightRadius: 6 * tamano, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", gap: 3 * tamano, marginTop: 4 * tamano, marginLeft: 4 * tamano }}>
            {[0, 1, 2].map((i) => <View key={i} style={{ width: 10 * tamano, height: 9 * tamano, borderRadius: 2 * tamano, backgroundColor: "#BFE3F5", borderWidth: 1, borderColor: "#2A2100" }} />)}
            <View style={{ width: 9 * tamano, height: 9 * tamano, borderTopRightRadius: 7 * tamano, borderRadius: 2 * tamano, backgroundColor: "#BFE3F5", borderWidth: 1, borderColor: "#2A2100" }} />
          </View>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 5 * tamano, height: 3.5 * tamano, backgroundColor: "#15202B" }} />
          <View style={{ position: "absolute", right: 1 * tamano, bottom: 9 * tamano, width: 4 * tamano, height: 3 * tamano, borderRadius: 1, backgroundColor: "#FFF3B0" }} />
        </View>
        {[10, 40].map((x) => (
          <View key={x} style={{ position: "absolute", left: x * tamano, top: 20 * tamano, width: 12 * tamano, height: 12 * tamano, borderRadius: 6 * tamano, backgroundColor: "#15202B", alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 5 * tamano, height: 5 * tamano, borderRadius: 2.5 * tamano, backgroundColor: "#C4CBD3" }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Pin de casa con el número de parada. */
export function PinCasa({ numero, color }: { numero: number | string; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", elevation: 3 }}>
        <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{numero}</Text>
      </View>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: color, marginTop: -2 }} />
    </View>
  );
}

/** Estilo de Google Maps sin puntos de interés: deja ver bien las calles, las casas y el furgón. */
export const ESTILO_MAPA = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", stylers: [{ color: "#F1F3F5" }] },
  { featureType: "water", stylers: [{ color: "#C9E3F2" }] },
];

/** Abre la navegación de Google Maps (app o web) hacia una casa. */
export function navegarConGoogleMaps(lat: number, lng: number): void {
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
  const app = Platform.OS === "ios" ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving` : `google.navigation:q=${lat},${lng}&mode=d`;
  Linking.openURL(app).catch(() => Linking.openURL(web));
}
