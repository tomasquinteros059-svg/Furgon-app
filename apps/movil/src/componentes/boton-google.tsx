// Botón «Continuar con Google»: solo aparece si el servidor lo tiene activado.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { entrarConGoogle, googleDisponible } from "../lib/google";
import { t } from "../lib/idioma";
import { mensajeError } from "../lib/supabase";
import { Text } from "./icono";
import { colores } from "./ui";

export function BotonGoogle({ onError }: { onError: (mensaje: string | null) => void }) {
  const [disponible, setDisponible] = useState(false);
  const [cargando, setCargando] = useState(false);
  useEffect(() => { googleDisponible().then(setDisponible); }, []);
  if (!disponible) return null;

  async function entrar() {
    onError(null);
    setCargando(true);
    try {
      await entrarConGoogle(); // al haber sesión, la app cambia de pantalla sola
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("Continuar con Google")} onPress={entrar} disabled={cargando}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 56, borderRadius: 999,
        borderWidth: 2, borderColor: colores.borde, backgroundColor: colores.superficie, opacity: pressed || cargando ? 0.7 : 1, marginVertical: 6,
      })}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADCE0", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#4285F4" }}>G</Text>{/* i18n-ignorar: logo */}
      </View>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{cargando ? t("Abriendo Google…") : t("Continuar con Google")}</Text>
    </Pressable>
  );
}
