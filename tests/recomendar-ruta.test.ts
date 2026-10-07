import { describe, expect, it } from "vitest";
import { distanciaM, type LatLng } from "../supabase/functions/_shared/core/geo.ts";
import {
  extremosDeRuta, FACTOR_CALLES, largoRutaM, type ParadaRuta, recomendarRuta,
} from "../supabase/functions/_shared/core/recomendar-ruta.ts";

const COLEGIO: LatLng = { lat: -33.4565, lng: -70.5978 };
// Punto a `norte`/`este` metros del colegio.
const cerca = (id: string, norte: number, este: number): ParadaRuta => ({
  id, lat: COLEGIO.lat + norte / 111_195, lng: COLEGIO.lng + este / (111_195 * Math.cos((COLEGIO.lat * Math.PI) / 180)),
});

// Casas en línea recta hacia el norte del colegio, a 1, 2, 3, 4 y 5 km.
const enLinea = [cerca("c3", 3000, 0), cerca("c1", 1000, 0), cerca("c5", 5000, 0), cerca("c2", 2000, 0), cerca("c4", 4000, 0)];

describe("recomendarRuta", () => {
  it("vuelta: parte del colegio y deja primero a la casa más cercana", () => {
    const r = recomendarRuta(enLinea, extremosDeRuta("vuelta", COLEGIO));
    expect(r.orden).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(r.cambia).toBe(true);
    expect(r.metros).toBeCloseTo(5000 * FACTOR_CALLES, -1);
    expect(r.ahorroM).toBeGreaterThan(0);
  });

  it("ida: termina en el colegio, así que empieza por la casa más lejana", () => {
    const r = recomendarRuta(enLinea, extremosDeRuta("ida", COLEGIO));
    expect(r.orden).toEqual(["c5", "c4", "c3", "c2", "c1"]);
  });

  it("si el orden actual ya es el mejor, no propone cambios", () => {
    const ordenado = ["c1", "c2", "c3", "c4", "c5"].map((id) => enLinea.find((p) => p.id === id)!);
    const r = recomendarRuta(ordenado, extremosDeRuta("vuelta", COLEGIO));
    expect(r.cambia).toBe(false);
    expect(r.ahorroM).toBe(0);
    expect(r.orden).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("no cambia el orden por ahorros insignificantes (menos de 50 m)", () => {
    // Dos casas casi en el mismo lugar: da lo mismo cuál va primero.
    const casas = [cerca("b", 2000, 10), cerca("a", 2000, 0), cerca("z", 4000, 0)];
    const r = recomendarRuta(casas, extremosDeRuta("vuelta", COLEGIO));
    expect(r.orden.slice(0, 2).sort()).toEqual(["a", "b"]);
    expect(r.orden[0]).toBe("b"); // conserva el orden actual entre las dos
  });

  it("casos borde: sin paradas, una parada y sin colegio", () => {
    expect(recomendarRuta([], extremosDeRuta("vuelta", COLEGIO)).orden).toEqual([]);
    expect(recomendarRuta([enLinea[0]], extremosDeRuta("ida", COLEGIO))).toMatchObject({ orden: ["c3"], cambia: false });
    // Sin colegio el recorrido queda libre en ambos extremos: igual sale en línea.
    const r = recomendarRuta(enLinea, extremosDeRuta("vuelta", null));
    expect([r.orden.join(), [...r.orden].reverse().join()]).toContain("c1,c2,c3,c4,c5");
  });

  it("con más de 8 paradas (heurística) encuentra el orden en una cuadrícula", () => {
    // 12 casas en un círculo de 2 km alrededor de un punto al norte del colegio, desordenadas.
    const centro = { norte: 4000, este: 0 };
    const casas = Array.from({ length: 12 }, (_, i) => {
      const ang = (i / 12) * 2 * Math.PI;
      return cerca(`k${i}`, centro.norte + 2000 * Math.cos(ang), centro.este + 2000 * Math.sin(ang));
    });
    const desordenadas = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11].map((i) => casas[i]);
    const ext = extremosDeRuta("vuelta", COLEGIO);
    const r = recomendarRuta(desordenadas, ext);
    expect(new Set(r.orden)).toEqual(new Set(casas.map((c) => c.id)));
    // El óptimo recorre el círculo partiendo del punto más cercano al colegio (k6):
    // 2 km hasta él + 11 de los 12 lados del dodecágono (lado = 2·2000·sen(15°)).
    const optimo = (2000 + 11 * 2 * 2000 * Math.sin(Math.PI / 12)) * FACTOR_CALLES;
    expect(r.metros).toBeLessThan(optimo * 1.03);
    expect(r.metros).toBeLessThan(r.metrosActual / 2);
    expect(largoRutaM(r.orden.map((id) => casas.find((c) => c.id === id)!), ext)).toBeCloseTo(r.metros, 3);
  });

  it("con pocas paradas, el resultado es el óptimo exacto", () => {
    // Puntos pseudoaleatorios determinísticos; se compara con fuerza bruta.
    let s = 7;
    const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 20; caso++) {
      const casas = Array.from({ length: 6 }, (_, i) => cerca(`p${i}`, azar() * 6000 - 1000, azar() * 6000 - 3000));
      const ext = extremosDeRuta(caso % 2 ? "ida" : "vuelta", COLEGIO);
      const r = recomendarRuta(casas, ext);
      let mejor = Infinity;
      const permutar = (resto: ParadaRuta[], hecho: ParadaRuta[]) => {
        if (!resto.length) { mejor = Math.min(mejor, largoRutaM(hecho, ext)); return; }
        resto.forEach((p, i) => permutar([...resto.slice(0, i), ...resto.slice(i + 1)], [...hecho, p]));
      };
      permutar(casas, []);
      expect(r.metros).toBeLessThanOrEqual(mejor + 50 * FACTOR_CALLES);
    }
  });

  it("largoRutaM suma los tramos con el factor de calles", () => {
    const a = cerca("a", 1000, 0);
    expect(largoRutaM([a], { inicio: COLEGIO })).toBeCloseTo(distanciaM(COLEGIO, a) * FACTOR_CALLES, 6);
    expect(largoRutaM([a], { inicio: COLEGIO, fin: COLEGIO })).toBeCloseTo(2 * distanciaM(COLEGIO, a) * FACTOR_CALLES, 6);
  });
});
