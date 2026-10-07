// Tema de la app: paleta 70 / 20 / 10 (diseno/colores.ts) con modo claro, oscuro o automático.
// `colores` y los estilos creados con `crearEstilos` leen siempre el tema actual; al cambiarlo,
// el proveedor vuelve a dibujar la app completa con la nueva paleta.
import Storage from "expo-sqlite/kv-store";
import { StatusBar } from "expo-status-bar";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { PALETA, type Paleta, type PreferenciaTema } from "../../../../diseno/colores.ts";
import { Text } from "./icono";

export type Colores = Paleta & {
  /** Nombres anteriores, se mantienen para no romper pantallas. */
  azul: string;
  tarjeta: string;
};

let oscuroActual = false;
const conAlias = (p: Paleta): Colores => ({ ...p, azul: p.marino, tarjeta: p.superficie });
const PALETAS = { claro: conAlias(PALETA.claro), oscuro: conAlias(PALETA.oscuro) };

/** Colores del tema actual (se leen al dibujar). */
export const colores: Colores = new Proxy({} as Colores, {
  get: (_, k: string) => PALETAS[oscuroActual ? "oscuro" : "claro"][k as keyof Colores],
});
export const esOscuro = () => oscuroActual;

/** StyleSheet que se recalcula para cada tema. */
export function crearEstilos<T extends StyleSheet.NamedStyles<T>>(fn: (c: Colores) => T): T {
  const cache: { claro?: T; oscuro?: T } = {};
  const actuales = () => {
    const t = oscuroActual ? "oscuro" : "claro";
    return (cache[t] ??= StyleSheet.create(fn(PALETAS[t])));
  };
  return new Proxy({} as T, { get: (_, k: string) => actuales()[k as keyof T] });
}

const CLAVE = "tema";
const Contexto = createContext<{ preferencia: PreferenciaTema; cambiar: (p: PreferenciaTema) => void } | null>(null);

export function ProveedorTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>("sistema");
  useEffect(() => {
    Storage.getItem(CLAVE).then((v) => { if (v === "claro" || v === "oscuro" || v === "sistema") setPreferencia(v); }).catch(() => {});
  }, []);
  const oscuro = preferencia === "oscuro" || (preferencia === "sistema" && sistema === "dark");
  oscuroActual = oscuro;
  const cambiar = (p: PreferenciaTema) => { setPreferencia(p); Storage.setItem(CLAVE, p).catch(() => {}); };
  return (
    <Contexto.Provider value={{ preferencia, cambiar }}>
      <StatusBar style={oscuro ? "light" : "dark"} />
      {/* La clave obliga a redibujar todo con la paleta nueva. */}
      <View key={oscuro ? "oscuro" : "claro"} style={{ flex: 1, backgroundColor: PALETAS[oscuro ? "oscuro" : "claro"].fondo }}>{children}</View>
    </Contexto.Provider>
  );
}

export function useTema() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useTema debe usarse dentro de ProveedorTema");
  return v;
}

/** Selector Automático · Claro · Oscuro. */
export function SelectorTema() {
  const { preferencia, cambiar } = useTema();
  const opciones: [PreferenciaTema, string][] = [["sistema", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]];
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colores.texto }}>Apariencia</Text>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: 3, gap: 3, backgroundColor: colores.superficie2 }}>
        {opciones.map(([v, nombre]) => {
          const activo = preferencia === v;
          return (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: activo }} onPress={() => cambiar(v)}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: activo ? colores.amarillo : "transparent" }}>
              <Text style={{ fontWeight: "700", color: activo ? colores.sobreAmarillo : colores.suave }}>{nombre}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
