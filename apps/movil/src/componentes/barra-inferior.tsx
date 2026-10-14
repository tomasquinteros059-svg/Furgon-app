// Barra de pestañas fija abajo (como en las apps de uso diario): ícono + nombre, la pestaña
// activa resaltada y un punto rojo cuando algo espera respuesta.
import { router, usePathname } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NombreIcono } from "../../../../diseno/iconos.ts";
import { Icono, Text } from "./icono";
import { colores } from "./ui";

export interface Pestana {
  titulo: string;
  icono: NombreIcono;
  ruta: string;
  /** Si es true, solo se marca activa con la ruta exacta (p. ej. Inicio). */
  exacta?: boolean;
  punto?: boolean;
}

export function BarraInferior({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  const { bottom } = useSafeAreaInsets();
  const activa = (p: Pestana) => (p.exacta ? ruta === p.ruta : ruta === p.ruta || ruta.startsWith(`${p.ruta}/`));
  return (
    <View style={{
      flexDirection: "row", backgroundColor: colores.superficie, borderTopWidth: 2, borderColor: colores.borde,
      paddingTop: 8, paddingBottom: Math.max(bottom, 8), paddingHorizontal: 6,
    }}>
      {pestanas.map((p) => {
        const on = activa(p);
        const color = on ? colores.sobreAmarillo : colores.suave;
        return (
          <Pressable key={p.ruta} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.titulo}
            onPress={() => { if (!on) router.navigate(p.ruta as never); }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {/* Activa: píldora amarilla llena con el ícono y el nombre adentro. */}
            <View style={{ alignItems: "center", gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: on ? colores.amarillo : "transparent", borderWidth: 2, borderColor: on ? colores.amarilloHondo : "transparent" }}>
              <View>
                <Icono nombre={p.icono} tam={26} color={color} acento="transparent" />
                {p.punto ? <View style={{ position: "absolute", top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: colores.rojo }} /> : null}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 13, color, fontWeight: on ? "700" : "500" }}>{p.titulo}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
