// Llamada entrante gratis (por internet): el mensaje se lee en voz alta en el propio teléfono.
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Vibration, View } from "react-native";
import { Text } from "../../../componentes/icono";
import { SafeAreaView } from "react-native-safe-area-context";
import { responderLlamada } from "../../../llamadas-app";
import { locale, t } from "../../../lib/idioma";

const TIMBRE_SEG = 30; // igual a CONFIG_LLAMADAS_POR_DEFECTO.timbreAppSeg

export default function LlamadaEntrante() {
  const { id, alumno, voz } = useLocalSearchParams<{ id: string; alumno?: string; voz?: string }>();
  const [quedan, setQuedan] = useState(TIMBRE_SEG);
  const [estado, setEstado] = useState<"sonando" | "confirmada" | "rechazada" | "vencida">("sonando");
  const activa = useRef(true);
  // «voz» ya viene en el idioma de la persona desde el servidor.
  const texto = `${voz || t("El furgón escolar está por llegar.")} ${t("Para confirmar, presione 1.")}`;

  useEffect(() => {
    responderLlamada(id, "acuse");
    Vibration.vibrate([0, 800, 600], true);
    const hablar = () => {
      if (!activa.current) return;
      Speech.speak(texto, {
        language: locale(),
        rate: 0.95,
        onDone: () => {
          setTimeout(hablar, 1500);
        },
      });
    };
    hablar();
    const reloj = setInterval(() => setQuedan((q) => Math.max(0, q - 1)), 1000);
    return () => {
      activa.current = false;
      clearInterval(reloj);
      Speech.stop();
      Vibration.cancel();
    };
  }, [id, texto]);

  useEffect(() => {
    if (quedan === 0 && estado === "sonando") terminar("vencida");
  }, [quedan, estado]);

  function terminar(nuevo: "confirmada" | "rechazada" | "vencida") {
    activa.current = false;
    Speech.stop();
    Vibration.cancel();
    setEstado(nuevo);
    if (nuevo === "confirmada") responderLlamada(id, "confirmar");
    if (nuevo === "rechazada") responderLlamada(id, "rechazar");
    // "vencida": el servidor la cuenta como no contestada y sigue la escalera.
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace("/")), 1500);
  }

  return (
    <SafeAreaView style={e.fondo}>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={e.suave}>{t("Llamada por internet · sin costo")}</Text>
        <Text style={e.quien}>Furgón Escolar</Text>{/* i18n-ignorar: marca */}
        <Text style={e.suave}>{alumno ? t("Aviso de {alumno}", { alumno }) : t("Aviso de llegada")}</Text>
      </View>
      <View style={e.voz}>
        <Text style={{ color: "#fff", fontSize: 16 }}>🗣️ “{texto}”</Text>
      </View>
      {estado === "sonando" ? (
        <View style={{ alignItems: "center", gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 32 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Presionar 1 para confirmar")} onPress={() => terminar("confirmada")} style={[e.tecla, { backgroundColor: "#1D7F45" }]}>
              <Text style={{ color: "#fff", fontSize: 34, fontWeight: "800" }}>1</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Colgar")} onPress={() => terminar("rechazada")} style={[e.tecla, { backgroundColor: "#C4281C" }]}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{t("Colgar")}</Text>
            </Pressable>
          </View>
          <Text style={e.suave}>{t("Si no confirmas en {seg} s, volveremos a llamar.", { seg: quedan })}</Text>
        </View>
      ) : (
        <Text style={[e.quien, { fontSize: 24, textAlign: "center" }]}>
          {estado === "confirmada" ? t("✅ Aviso confirmado") : estado === "rechazada" ? t("Llamada terminada") : t("Sin respuesta")}
        </Text>
      )}
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "#0F2236", padding: 24, justifyContent: "space-between", paddingVertical: 48 },
  quien: { color: "#fff", fontSize: 36, fontWeight: "800" },
  suave: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  voz: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 },
  tecla: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
});
