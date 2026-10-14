// Letra de la app: Poppins (elegida en el rediseño de octubre 2026). Cada grosor es un archivo
// distinto, así que el «fontWeight» de los estilos se traduce a su familia Poppins.
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { Poppins_800ExtraBold } from "@expo-google-fonts/poppins/800ExtraBold";
import type { TextStyle } from "react-native";

export const FUENTES = { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold };

/** Familia Poppins para un grosor ("bold", "600", 700…). */
export function familia(peso: TextStyle["fontWeight"]): string {
  const n = peso === "bold" ? 700 : peso === "normal" || peso == null ? 400 : Number(peso) || 400;
  if (n >= 800) return "Poppins_800ExtraBold";
  if (n >= 700) return "Poppins_700Bold";
  if (n >= 600) return "Poppins_600SemiBold";
  if (n >= 500) return "Poppins_500Medium";
  return "Poppins_400Regular";
}

/** Estilo con la familia Poppins correcta y sin fontWeight (en Android lo duplicaría). */
export function conLetra(plano: TextStyle): TextStyle {
  if (plano.fontFamily && !plano.fontFamily.startsWith("Poppins")) return plano; // p. ej. monospace
  return { fontFamily: familia(plano.fontWeight), fontWeight: undefined };
}
