import { describe, expect, it } from "vitest";
import {
  combinarEtas,
  CONFIG_DISPARO_POR_DEFECTO as CFG,
  decidirConsultaEta,
  etasDesdeCache,
  etasDesdeTramos,
  etasRespaldo,
  evaluarDisparos,
  posicionVigente,
  radioGeocercaM,
  type CacheEta,
} from "../supabase/functions/_shared/core/disparo.ts";
import { distanciaM } from "../supabase/functions/_shared/core/geo.ts";
import { alEste, alNorte, BASE, parada } from "./helpers.ts";

describe("geo", () => {
  it("calcula distancias en metros con precisión suficiente", () => {
    expect(distanciaM(BASE, alNorte(BASE, 1000))).toBeCloseTo(1000, -1);
    expect(distanciaM(BASE, alEste(BASE, 2500))).toBeCloseTo(2500, -1);
  });
});

describe("ETA acumulado a lo largo de la ruta", () => {
  it("suma los tramos y el tiempo detenido en cada parada intermedia", () => {
    expect(etasDesdeTramos([100, 200, 300], CFG)).toEqual([100, 360, 720]);
  });

  it("el respaldo usa distancia acumulada × factor de calles a velocidad urbana", () => {
    const p1 = parada("1", alNorte(BASE, 1000));
    const p2 = parada("2", alNorte(BASE, 2000));
    const [e1, e2] = etasRespaldo(BASE, [p1, p2], CFG);
    const v = CFG.velocidadRespaldoKmh / 3.6;
    expect(e1).toBeCloseTo((1000 * CFG.factorCalles) / v, -1);
    expect(e2).toBeCloseTo((2000 * CFG.factorCalles) / v + CFG.tiempoPorParadaSeg, -1);
  });

  it("combina ETA del proveedor con extrapolación del respaldo para las paradas no consultadas", () => {
    expect(combinarEtas([100, 300], [150, 400, 700, 900])).toEqual([100, 300, 600, 800]);
    expect(combinarEtas([], [10, 20])).toEqual([10, 20]);
  });

  it("descuenta el tiempo transcurrido al reutilizar el cache", () => {
    const cache: CacheEta = { calculadaEnMs: 0, origen: BASE, paradaIds: ["a", "b"], etasSeg: [100, 20] };
    expect(etasDesdeCache(cache, 30_000)).toEqual([70, 0]);
  });
});

describe("evaluarDisparos", () => {
  const lejos = parada("x", alNorte(BASE, 5000));

  it("dispara cuando el ETA entra en la ventana (5 min + margen)", () => {
    const limite = 5 * 60 + CFG.margenSeg;
    const dentro = evaluarDisparos({ posicion: BASE, paradas: [lejos], etasSeg: [limite], fuente: "eta", config: CFG });
    const fuera = evaluarDisparos({ posicion: BASE, paradas: [lejos], etasSeg: [limite + 1], fuente: "eta", config: CFG });
    expect(dentro).toEqual([{ paradaId: "x", alumnoId: "alumno-x", motivo: "eta", etaSeg: limite }]);
    expect(fuera).toEqual([]);
  });

  it("respeta el tiempo de aviso configurado por alumno", () => {
    const diezMin = parada("d", alNorte(BASE, 5000), { minutosAviso: 10 });
    const r = evaluarDisparos({ posicion: BASE, paradas: [diezMin, lejos], etasSeg: [540, 540], fuente: "eta", config: CFG });
    expect(r.map((d) => d.paradaId)).toEqual(["d"]);
  });

  it("no vuelve a disparar paradas ya avisadas", () => {
    const avisada = { ...lejos, avisado: true };
    expect(evaluarDisparos({ posicion: BASE, paradas: [avisada], etasSeg: [10], fuente: "eta", config: CFG })).toEqual([]);
  });

  it("red de seguridad: dispara por proximidad aunque el ETA diga otra cosa", () => {
    const cerca = parada("c", alNorte(BASE, 200));
    const r = evaluarDisparos({ posicion: BASE, paradas: [cerca], etasSeg: [900], fuente: "eta", config: CFG });
    expect(r).toEqual([{ paradaId: "c", alumnoId: "alumno-c", motivo: "proximidad", etaSeg: 900 }]);
  });

  it("pasar a 200 m de una casa que viene mucho después en la ruta no dispara su aviso", () => {
    const primera = parada("1", alNorte(BASE, -6000));
    const despues = parada("8", alNorte(BASE, 200));
    const r = evaluarDisparos({ posicion: BASE, paradas: [primera, despues], etasSeg: [900, 2400], fuente: "eta", config: CFG });
    expect(r).toEqual([]);
  });

  it("en la ida, una casa cercana que viene más adelante en la ruta NO se avisa antes de tiempo", () => {
    // El furgón pasa a 800 m de la casa 3, pero antes debe ir a buscar a 1 y 2 al otro lado.
    const p1 = parada("1", alNorte(BASE, -3000));
    const p2 = parada("2", alNorte(BASE, -4000));
    const p3 = parada("3", alNorte(BASE, 800));
    const etas = etasRespaldo(BASE, [p1, p2, p3], CFG);
    const r = evaluarDisparos({ posicion: BASE, paradas: [p1, p2, p3], etasSeg: etas, fuente: "geocerca", config: CFG });
    expect(r).toEqual([]);
    // Una distancia directa de 800 m sí habría entrado en la geocerca de 5 minutos:
    expect(800).toBeLessThan(radioGeocercaM(5, CFG));
  });

  it("el respaldo equivale a una geocerca de ~1,4 km para 5 minutos", () => {
    const radio = radioGeocercaM(5, CFG);
    expect(radio).toBeGreaterThan(1300);
    expect(radio).toBeLessThan(1500);
    const dentro = parada("in", alNorte(BASE, radio - 50));
    const fuera = parada("out", alEste(BASE, radio + 50));
    for (const [p, esperado] of [[dentro, 1], [fuera, 0]] as const) {
      const r = evaluarDisparos({ posicion: BASE, paradas: [p], etasSeg: etasRespaldo(BASE, [p], CFG), fuente: "geocerca", config: CFG });
      expect(r.length).toBe(esperado);
      if (esperado) expect(r[0].motivo).toBe("geocerca");
    }
  });
});

describe("posicionVigente", () => {
  it("descarta posiciones viejas (p. ej. reenviadas tras perder señal)", () => {
    expect(posicionVigente(0, 59_000, CFG)).toBe(true);
    expect(posicionVigente(0, 61_000, CFG)).toBe(false);
    expect(posicionVigente(120_000, 0, CFG)).toBe(false); // reloj del teléfono muy adelantado
  });
});

describe("decidirConsultaEta (control de costo de la API)", () => {
  const p = parada("p", alNorte(BASE, 3000));
  const base = { posicion: BASE, ahoraMs: 100_000, paradas: [p], cache: null, config: CFG };

  it("no consulta si es imposible llegar dentro de la ventana ni a velocidad máxima", () => {
    expect(decidirConsultaEta({ ...base, paradas: [parada("far", alNorte(BASE, 20_000))] })).toBe("no_necesario");
  });

  it("no consulta si todas las paradas ya fueron avisadas", () => {
    expect(decidirConsultaEta({ ...base, paradas: [{ ...p, avisado: true }] })).toBe("no_necesario");
  });

  it("consulta cuando una parada podría estar en la ventana", () => {
    expect(decidirConsultaEta(base)).toBe("consultar");
  });

  it("reutiliza el cache si es reciente y el furgón casi no se movió", () => {
    const cache: CacheEta = { calculadaEnMs: 70_000, origen: alNorte(BASE, -100), paradaIds: ["p"], etasSeg: [400] };
    expect(decidirConsultaEta({ ...base, cache })).toBe("reusar_cache");
    expect(decidirConsultaEta({ ...base, cache: { ...cache, calculadaEnMs: 30_000 } })).toBe("consultar");
    expect(decidirConsultaEta({ ...base, cache: { ...cache, origen: alNorte(BASE, -500) } })).toBe("consultar");
    expect(decidirConsultaEta({ ...base, cache: { ...cache, paradaIds: ["otra"] } })).toBe("consultar");
  });
});
