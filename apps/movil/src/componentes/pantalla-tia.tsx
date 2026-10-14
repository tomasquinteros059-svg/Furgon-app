// Pantallas de la tía: siempre con el saludo «TÍA DEL FURGÓN · Hola, …» arriba y, debajo, una línea
// que explica la pantalla (diseño de la tía, octubre 2026).
import type { ReactNode } from "react";
import { useSesion } from "../lib/sesion";
import { t } from "../lib/idioma";
import { Text } from "./icono";
import { colores, Pantalla } from "./ui";

export function PantallaTia({ descripcion, children }: { descripcion?: string; children: ReactNode }) {
  const { perfil } = useSesion();
  return (
    <Pantalla antetitulo={t("Tía del furgón")} titulo={t("Hola, {nombre}", { nombre: perfil?.nombre ?? "" })}>
      {descripcion ? <Text style={{ fontSize: 17, color: colores.suave, marginBottom: 16, lineHeight: 25 }}>{descripcion}</Text> : null}
      {children}
    </Pantalla>
  );
}
