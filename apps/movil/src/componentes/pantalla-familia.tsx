// Pantallas de la familia: arriba «FAMILIA · Familia Martínez» (diseño de la familia, octubre 2026).
import type { ReactNode } from "react";
import { useSesion } from "../lib/sesion";
import { t } from "../lib/idioma";
import { Pantalla } from "./ui";

/** «Familia Martínez» con el apellido del perfil; si no hay apellido, «Familia de Carolina». */
export function tituloFamilia(nombre: string | null | undefined): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return t("Familia {apellido}", { apellido: partes[partes.length - 1] });
  return partes.length ? t("Familia de {nombre}", { nombre: partes[0] }) : t("Familia");
}

export function PantallaFamilia({ children, desplazable }: { children: ReactNode; desplazable?: boolean }) {
  const { perfil } = useSesion();
  return <Pantalla antetitulo={t("Familia")} titulo={tituloFamilia(perfil?.nombre)} desplazable={desplazable}>{children}</Pantalla>;
}
