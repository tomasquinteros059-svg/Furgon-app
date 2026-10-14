import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, type TextInputProps, View, type ViewStyle } from "react-native";
import { Text } from "./icono";
import { colores, crearEstilos } from "./tema";
import { SafeAreaView } from "react-native-safe-area-context";

// Colores y estilos del tema actual (paleta 70 / 20 / 10 con modo oscuro): ver componentes/tema.tsx.
export { colores } from "./tema";

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

type VarianteBoton = "primario" | "secundario" | "exito" | "peligro" | "texto" | "contornoPeligro";

export function Boton({ titulo, onPress, variante = "primario", cargando = false, grande = false, deshabilitado = false, estilo }: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  cargando?: boolean;
  grande?: boolean;
  deshabilitado?: boolean;
  estilo?: ViewStyle;
}) {
  // Rediseño «Trazo y relleno»: botones píldora con borde de 2 px. El principal es amarillo y se
  // hunde al tocarlo, como una tecla; el secundario es blanco con borde del color del texto.
  const fondo = {
    primario: colores.amarillo,
    secundario: colores.superficie,
    exito: colores.verde,
    peligro: colores.rojo,
    texto: "transparent",
    contornoPeligro: "transparent",
  }[variante];
  const borde = { primario: colores.amarilloBorde, secundario: colores.texto, exito: colores.verde, peligro: colores.rojo, texto: "transparent", contornoPeligro: colores.rojo }[variante];
  const colorTexto = variante === "primario" ? colores.sobreAmarillo : variante === "secundario" ? colores.texto
    : variante === "texto" ? colores.marino : variante === "contornoPeligro" ? colores.rojo : colores.fondo;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={cargando || deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        grande && estilos.botonGrande,
        { backgroundColor: fondo, borderColor: borde, opacity: deshabilitado ? 0.45 : 1 },
        variante === "primario" && { borderBottomWidth: pressed ? 2 : 5, transform: [{ translateY: pressed ? 3 : 0 }] },
        variante !== "primario" && pressed && { opacity: 0.75 },
        variante === "texto" && { minHeight: 44, borderWidth: 0 },
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.botonTexto, grande && estilos.botonTextoGrande, { color: colorTexto }, variante === "texto" && { fontWeight: "600", fontSize: 15 }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={colores.suave} style={estilos.input} {...props} />
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

export function Aviso({ texto, tipo = "info" }: { texto: string; tipo?: "info" | "error" | "exito" }) {
  const color = tipo === "error" ? colores.rojo : tipo === "exito" ? colores.verde : colores.marino;
  return (
    <View style={[estilos.aviso, { borderLeftColor: color }]}>
      <Text style={{ color: colores.texto }}>{texto}</Text>
    </View>
  );
}

export function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colores.fondo }}>
      <ActivityIndicator size="large" color={colores.amarillo} />
    </View>
  );
}

export const estilos = crearEstilos((colores) => ({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 40 },
  encabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  titulo: { fontSize: 27, fontWeight: "700", color: colores.texto, flexShrink: 1, letterSpacing: -0.3 },
  subtitulo: { fontSize: 17, fontWeight: "600", color: colores.texto, marginTop: 4, marginBottom: 6 },
  texto: { fontSize: 15, color: colores.texto },
  textoSuave: { fontSize: 14, color: colores.suave },
  boton: { minHeight: 52, borderRadius: 999, borderWidth: 2, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginVertical: 5 },
  botonGrande: { minHeight: 60 },
  botonTexto: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  botonTextoGrande: { fontSize: 18, fontWeight: "700" },
  etiqueta: { fontSize: 14, fontWeight: "600", color: colores.texto, marginBottom: 6 },
  ayuda: { fontSize: 12, color: colores.suave, marginTop: 4 },
  input: {
    backgroundColor: colores.tarjeta, borderWidth: 2, borderColor: colores.borde, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colores.texto, fontFamily: "Poppins_400Regular",
  },
  tarjeta: {
    // Borde de 2 px (el trazo de los íconos) y abajo más grueso: la sombra «de sello» del diseño.
    backgroundColor: colores.tarjeta, borderRadius: 22, padding: 16, marginBottom: 14,
    borderWidth: 2, borderBottomWidth: 5, borderColor: colores.borde,
  },
  aviso: { backgroundColor: colores.superficie2, borderLeftWidth: 4, padding: 14, borderRadius: 16, marginBottom: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
}));

/** Fila tocable de menú (pantalla «Más»): ícono o foto a la izquierda, título, detalle y «›». */
export function FilaMenu({ titulo, detalle, izquierda, punto = false, onPress }: {
  titulo: string; detalle?: string; izquierda?: ReactNode; punto?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={onPress}
      style={({ pressed }) => [estilos.tarjeta, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, marginBottom: 10, opacity: pressed ? 0.75 : 1 }]}>
      {izquierda}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[estilos.texto, { fontWeight: "700" }]}>{titulo}</Text>
        {detalle ? <Text style={estilos.textoSuave}>{detalle}</Text> : null}
      </View>
      {punto ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colores.rojo }} /> : null}
      <Text style={{ fontSize: 22, color: colores.suave }}>›</Text>
    </Pressable>
  );
}
