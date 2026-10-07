import { describe, expect, it } from "vitest";
import { PALETA } from "../diseno/colores.ts";

// Contraste WCAG entre dos colores #RRGGBB.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

describe("paleta 70 / 20 / 10", () => {
  for (const [modo, p] of Object.entries(PALETA)) {
    it(`modo ${modo}: textos legibles (WCAG AA)`, () => {
      expect(contraste(p.texto, p.fondo)).toBeGreaterThanOrEqual(7);
      expect(contraste(p.texto, p.superficie)).toBeGreaterThanOrEqual(7);
      expect(contraste(p.suave, p.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.suave, p.superficie2)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.sobreAmarillo, p.amarillo)).toBeGreaterThanOrEqual(7); // botón principal
      expect(contraste(p.marino, p.fondo)).toBeGreaterThanOrEqual(4.5); // enlaces
    });
    it(`modo ${modo}: el amarillo destaca sobre el fondo y el gris es sutil`, () => {
      expect(contraste(p.amarillo, p.fondo)).toBeGreaterThan(1.6);
      expect(contraste(p.borde, p.fondo)).toBeLessThan(1.6);
    });
  }
});
