import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from "react-native";
import { Text } from "./icono";
import { SafeAreaView } from "react-native-safe-area-context";

export const colores = {
  amarillo: "#F2B705",
  azul: "#1F3A5F",
  fondo: "#F6F7F9",
  tarjeta: "#FFFFFF",
  texto: "#1B1F24",
  suave: "#5B6573",
  verde: "#1E8E3E",
  rojo: "#C62828",
  borde: "#DDE1E6",
};

export function Pantalla({ children, titulo, accion, desplazable = true }: {
  children: ReactNode;
  titulo?: string;
  accion?: ReactNode;
  desplazable?: boolean;
}) {
  const contenido = (
    <>
      {titulo ? (
        <View style={estilos.encabezado}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {accion}
        </View>
      ) : null}
      {children}
    </>
  );
  return (
    <SafeAreaView style={estilos.pantalla} edges={["top", "left", "right"]}>
      {desplazable ? (
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">{contenido}</ScrollView>
      ) : (
        <View style={[estilos.contenido, { flex: 1 }]}>{contenido}</View>
      )}
    </SafeAreaView>
  );
}

type VarianteBoton = "primario" | "secundario" | "exito" | "peligro" | "texto";

export function Boton({ titulo, onPress, variante = "primario", cargando = false, grande = false, deshabilitado = false, estilo }: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  cargando?: boolean;
  grande?: boolean;
  deshabilitado?: boolean;
  estilo?: ViewStyle;
}) {
  const fondo = {
    primario: colores.azul,
    secundario: colores.tarjeta,
    exito: colores.verde,
    peligro: colores.rojo,
    texto: "transparent",
  }[variante];
  const colorTexto = variante === "secundario" || variante === "texto" ? colores.azul : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={cargando || deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        grande && estilos.botonGrande,
        { backgroundColor: fondo, opacity: pressed || deshabilitado ? 0.6 : 1 },
        variante === "secundario" && { borderWidth: 1, borderColor: colores.borde },
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.botonTexto, grande && estilos.botonTextoGrande, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor="#98A2B3" style={estilos.input} {...props} />
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

export function Aviso({ texto, tipo = "info" }: { texto: string; tipo?: "info" | "error" | "exito" }) {
  const color = tipo === "error" ? colores.rojo : tipo === "exito" ? colores.verde : colores.azul;
  return (
    <View style={[estilos.aviso, { borderLeftColor: color }]}>
      <Text style={{ color: colores.texto }}>{texto}</Text>
    </View>
  );
}

export function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colores.fondo }}>
      <ActivityIndicator size="large" color={colores.azul} />
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 40 },
  encabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  titulo: { fontSize: 24, fontWeight: "700", color: colores.texto, flexShrink: 1 },
  subtitulo: { fontSize: 17, fontWeight: "600", color: colores.texto, marginTop: 8, marginBottom: 8 },
  texto: { fontSize: 15, color: colores.texto },
  textoSuave: { fontSize: 14, color: colores.suave },
  boton: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  botonGrande: { minHeight: 72, borderRadius: 14 },
  botonTexto: { fontSize: 16, fontWeight: "600" },
  botonTextoGrande: { fontSize: 20, fontWeight: "700" },
  etiqueta: { fontSize: 14, fontWeight: "600", color: colores.texto, marginBottom: 6 },
  ayuda: { fontSize: 12, color: colores.suave, marginTop: 4 },
  input: {
    backgroundColor: colores.tarjeta, borderWidth: 1, borderColor: colores.borde, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colores.texto,
  },
  tarjeta: {
    backgroundColor: colores.tarjeta, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colores.borde,
  },
  aviso: { backgroundColor: colores.tarjeta, borderLeftWidth: 4, padding: 12, borderRadius: 8, marginBottom: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
});
