import { Children, type ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, type TextInputProps, View, type ViewStyle } from "react-native";
import type { NombreIcono } from "../../../../diseno/iconos.ts";
import { Icono, Text } from "./icono";
import { colores, crearEstilos } from "./tema";
import { SafeAreaView } from "react-native-safe-area-context";

// Colores y estilos del tema actual (paleta 70 / 20 / 10 con modo oscuro): ver componentes/tema.tsx.
export { colores } from "./tema";

export function Pantalla({ children, titulo, antetitulo, accion, desplazable = true }: {
  children: ReactNode;
  titulo?: string;
  /** Línea chica en mayúsculas sobre el título (p. ej. «TÍA DEL FURGÓN»). */
  antetitulo?: string;
  accion?: ReactNode;
  desplazable?: boolean;
}) {
  // Encabezado fijo arriba (el contenido pasa por debajo), separado por una línea, como el diseño.
  const encabezado = titulo ? (
    <View style={estilos.encabezado}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {antetitulo ? <Text style={estilos.antetitulo}>{antetitulo.toUpperCase()}</Text> : null}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>
      {accion}
    </View>
  ) : null;
  return (
    <SafeAreaView style={estilos.pantalla} edges={["top", "left", "right"]}>
      {encabezado}
      {desplazable ? (
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[estilos.contenido, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type VarianteBoton = "primario" | "secundario" | "exito" | "peligro" | "texto" | "contornoPeligro";

export function Boton({ titulo, onPress, variante = "primario", cargando = false, grande = false, deshabilitado = false, estilo, icono }: {
  titulo: string;
  icono?: NombreIcono;
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
  const borde = { primario: colores.amarilloHondo, secundario: colores.texto, exito: colores.verde, peligro: colores.rojo, texto: "transparent", contornoPeligro: colores.rojo }[variante];
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
        variante === "primario" && { borderBottomWidth: pressed ? 2 : 4, transform: [{ translateY: pressed ? 2 : 0 }] },
        variante !== "primario" && pressed && { opacity: 0.75 },
        variante === "texto" && { minHeight: 44, borderWidth: 0 },
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {icono ? <Icono nombre={icono} tam={grande ? 28 : 22} color={colorTexto} acento="transparent" /> : null}
          <Text style={[estilos.botonTexto, grande && estilos.botonTextoGrande, { color: colorTexto }, variante === "texto" && { fontWeight: "600", fontSize: 15 }]}>{titulo}</Text>
        </View>
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
  contenido: { padding: 18, paddingBottom: 40 },
  encabezado: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 2, borderColor: colores.borde, backgroundColor: colores.fondo,
  },
  antetitulo: { fontSize: 13, fontWeight: "600", color: colores.suave, letterSpacing: 1.2, marginBottom: 2 },
  titulo: { fontSize: 28, fontWeight: "700", color: colores.texto, flexShrink: 1, letterSpacing: -0.3 },
  subtitulo: { fontSize: 17, fontWeight: "600", color: colores.texto, marginTop: 4, marginBottom: 6 },
  texto: { fontSize: 15, color: colores.texto },
  textoSuave: { fontSize: 14, color: colores.suave },
  boton: { minHeight: 52, borderRadius: 999, borderWidth: 2, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginVertical: 5 },
  botonGrande: { minHeight: 68 },
  botonTexto: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  botonTextoGrande: { fontSize: 22, fontWeight: "600" },
  etiqueta: { fontSize: 14, fontWeight: "600", color: colores.texto, marginBottom: 6 },
  ayuda: { fontSize: 12, color: colores.suave, marginTop: 4 },
  input: {
    backgroundColor: colores.tarjeta, borderWidth: 2, borderColor: colores.borde, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colores.texto, fontFamily: "Poppins_400Regular",
  },
  tarjeta: {
    // Tarjeta blanca, esquinas muy redondeadas y borde suave de 2 px (diseño de la tía, oct. 2026).
    backgroundColor: colores.tarjeta, borderRadius: 28, padding: 20, marginBottom: 18,
    borderWidth: 2, borderColor: colores.borde,
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

/** Lista agrupada en una sola tarjeta, con una línea entre filas (pantallas «Más»). */
export function GrupoMenu({ children }: { children: ReactNode }) {
  const filas = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 28, marginBottom: 16, overflow: "hidden" }}>
      {filas.map((f, i) => (
        <View key={i} style={i ? { borderTopWidth: 2, borderColor: colores.borde } : undefined}>{f}</View>
      ))}
    </View>
  );
}

/** Fila de un GrupoMenu: ícono, título y «›». Con `children`, al tocarla se despliega lo de adentro. */
export function FilaGrupo({ titulo, detalle, icono, peligro = false, punto = false, onPress, children }: {
  titulo: string; detalle?: string; icono: NombreIcono; peligro?: boolean; punto?: boolean; onPress?: () => void; children?: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const color = peligro ? colores.rojo : colores.texto;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={titulo} accessibilityState={children ? { expanded: abierta } : undefined}
        onPress={children ? () => setAbierta(!abierta) : onPress}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 20, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1 })}>
        <Icono nombre={icono} tam={26} color={color} acento="transparent" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color }}>{titulo}</Text>
          {detalle ? <Text style={{ fontSize: 14, color: colores.suave }}>{detalle}</Text> : null}
        </View>
        {punto ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colores.amarillo }} /> : null}
        <Text style={{ fontSize: 22, color: colores.suave }}>{children && abierta ? "⌄" : "›"}</Text>
      </Pressable>
      {children && abierta ? <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
}
