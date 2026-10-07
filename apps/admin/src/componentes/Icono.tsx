// Íconos propios de Furgón Escolar en el panel web (fuente única: diseno/iconos.ts).
import { type NombreIcono, svgIcono } from "../../../../diseno/iconos.ts";

export type { NombreIcono };

/** Ícono en línea: toma el color y el tamaño del texto que lo rodea; el acento es el amarillo escolar. */
export function Icono({ n, tam = "1.15em", titulo }: { n: NombreIcono; tam?: string | number; titulo?: string }) {
  return (
    <span className="ico" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svgIcono(n, { tam, acento: "var(--ico-acento, #F5B700)" }) }} />
  );
}
