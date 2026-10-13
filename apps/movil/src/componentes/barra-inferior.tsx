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
      flexDirection: "row", backgroundColor: colores.superficie, borderTopWidth: 1, borderColor: colores.borde,
      paddingTop: 6, paddingBottom: Math.max(bottom, 6),
    }}>
      {pestanas.map((p) => {
        const on = activa(p);
        const color = on ? colores.texto : colores.suave;
        return (
          <Pressable key={p.ruta} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.titulo}
            onPress={() => { if (!on) router.navigate(p.ruta as never); }}
            style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 }}>
            <View>
              <Icono nombre={p.icono} tam={24} color={color} acento={on ? undefined : "transparent"} />
              {p.punto ? <View style={{ position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: colores.rojo }} /> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, color, fontWeight: on ? "700" : "500" }}>{p.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
