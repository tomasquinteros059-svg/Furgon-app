// Íconos propios de Furgón Escolar en la app (fuente única: diseno/iconos.ts).
import { Children, type ReactNode } from "react";
import { Text as RNText, type StyleProp, StyleSheet, type TextProps, type TextStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { iconoDeEmoji, type NombreIcono, REGEX_EMOJI, svgIcono } from "../../../../diseno/iconos.ts";

export type { NombreIcono };

export function Icono({ nombre, tam = 20, color = "#1B1F24", acento }: { nombre: NombreIcono; tam?: number; color?: string; acento?: string }) {
  return <SvgXml xml={svgIcono(nombre, { tam, color, acento })} width={tam} height={tam} />;
}

/** Parte un texto y reemplaza sus emojis por íconos en línea, del tamaño y color del texto. */
function iconizar(texto: string, estilo: StyleProp<TextStyle>): ReactNode[] {
  const plano = StyleSheet.flatten(estilo) ?? {};
  const tam = Math.round((plano.fontSize ?? 16) * 1.15);
  const color = typeof plano.color === "string" ? plano.color : "#1B1F24";
  // Sobre fondos amarillos o de color, el acento amarillo no se vería: va translúcido.
  const acento = color === "#fff" || color === "#FFFFFF" ? "rgba(255,255,255,0.38)" : undefined;
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(REGEX_EMOJI)) {
    const nombre = iconoDeEmoji(m[0]);
    if (!nombre) continue;
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(<Icono key={`${m.index}-${nombre}`} nombre={nombre} tam={tam} color={color} acento={acento} />);
    ultimo = m.index + m[0].length;
  }
  if (ultimo === 0) return [texto];
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/**
 * Igual que <Text> de React Native, pero los emojis del texto se dibujan con los íconos
 * propios de la app (diseño consistente en Android y iPhone, sin emojis genéricos).
 */
export function Text(props: TextProps) {
  const { children, style } = props;
  const hijos = Children.map(children, (c) => (typeof c === "string" ? iconizar(c, style) : c));
  return <RNText {...props}>{hijos}</RNText>;
}
