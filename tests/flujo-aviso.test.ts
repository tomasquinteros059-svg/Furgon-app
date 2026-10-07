import { describe, expect, it, vi } from "vitest";
import { CONFIG_DISPARO_POR_DEFECTO as CFG, type CacheEta, type ParadaPendiente } from "../supabase/functions/_shared/core/disparo.ts";
import { dispararUnaVez, RegistroAvisosEnMemoria } from "../supabase/functions/_shared/core/dedup.ts";
import { evaluarPosicion, type DepsFlujo, type ProveedorEta } from "../supabase/functions/_shared/core/flujo-aviso.ts";
import { distanciaM, type LatLng } from "../supabase/functions/_shared/core/geo.ts";
import { alNorte, BASE, parada } from "./helpers.ts";

/** Proveedor falso: 10 m/s por calles (36 km/h) en cada tramo. */
function proveedorFalso(): ProveedorEta & { consultas: number } {
  return {
    nombre: "falso",
    consultas: 0,
    duracionesTramos(origen: LatLng, destinos: LatLng[]) {
      this.consultas++;
      let previo = origen;
      return Promise.resolve(destinos.map((d) => {
        const t = distanciaM(previo, d) / 10;
        previo = d;
        return t;
      }));
    },
  };
}

function crearEntorno(proveedor: ProveedorEta | null = proveedorFalso()) {
  let ahora = 1_000_000;
  let cache: CacheEta | null = null;
  const registro = new RegistroAvisosEnMemoria();
  const notificados: { avisoId: string; paradaId: string; motivo: string; etaSeg: number }[] = [];
  const deps: DepsFlujo = {
    ahoraMs: () => ahora,
    config: CFG,
    proveedorEta: proveedor,
    timeoutProveedorMs: 50,
    registro,
    guardarEtas: (_r, _e, nuevo) => {
      if (nuevo) cache = nuevo;
      return Promise.resolve();
    },
    notificar: (avisoId, d) => {
      notificados.push({ avisoId, paradaId: d.paradaId, motivo: d.motivo, etaSeg: d.etaSeg });
      return Promise.resolve();
    },
  };
  return {
    deps,
    registro,
    notificados,
    avanzar: (seg: number) => (ahora += seg * 1000),
    ahora: () => ahora,
    evaluar: (posicion: LatLng, paradas: ParadaPendiente[]) => {
      // Simula la base de datos: las paradas con aviso registrado vienen marcadas.
      const marcadas = paradas.map((p) => ({ ...p, avisado: registro.avisos.has(`rec-1:${p.alumnoId}`) }));
      return evaluarPosicion(deps, {
        recorridoId: "rec-1",
        posicion: { ...posicion, registradaEnMs: ahora },
        paradas: marcadas,
        cache,
      });
    },
  };
}

describe("flujo completo de aviso", () => {
  it("avisa una sola vez a cada alumno, cuando el ETA con tráfico entra en los 5 minutos", async () => {
    const env = crearEntorno();
    const paradas = [parada("A", alNorte(BASE, 6000)), parada("B", alNorte(BASE, 9000))];
    // El furgón avanza hacia el norte a 10 m/s, reportando cada 15 s.
    for (let s = 0; s <= 900; s += 15) {
      const pos = alNorte(BASE, Math.min(s * 10, 9000));
      const pendientes = paradas.filter((p) => p.ubicacion.lat > pos.lat - 1e-6);
      await env.evaluar(pos, pendientes);
      env.avanzar(15);
    }
    expect(env.notificados.map((n) => n.paradaId)).toEqual(["A", "B"]);
    for (const n of env.notificados) {
      expect(n.motivo).toBe("eta");
      expect(n.etaSeg).toBeLessThanOrEqual(5 * 60 + CFG.margenSeg);
      expect(n.etaSeg).toBeGreaterThan(5 * 60 - 30); // no avisa demasiado temprano
    }
  });

  it("no duplica el aviso aunque el furgón entre y salga del radio varias veces", async () => {
    const env = crearEntorno();
    const casa = parada("A", alNorte(BASE, 2000));
    const posiciones = [0, 600, 0, 700, 100, 800, -500, 900];
    for (const m of posiciones) {
      await env.evaluar(alNorte(BASE, m), [casa]);
      env.avanzar(61); // invalida el cache cada vez
    }
    expect(env.notificados).toHaveLength(1);
    expect(env.registro.avisos.size).toBe(1);
  });

  it("no duplica el aviso si llegan dos lotes de posiciones al mismo tiempo", async () => {
    const env = crearEntorno();
    const casa = parada("A", alNorte(BASE, 1500));
    await Promise.all([env.evaluar(BASE, [casa]), env.evaluar(alNorte(BASE, 10), [casa])]);
    expect(env.notificados).toHaveLength(1);
  });

  it("usa la geocerca de respaldo si la API de mapas falla", async () => {
    const roto: ProveedorEta = { nombre: "roto", duracionesTramos: () => Promise.reject(new Error("HTTP 503")) };
    const env = crearEntorno(roto);
    const r = await env.evaluar(BASE, [parada("A", alNorte(BASE, 1200))]);
    expect(r.errorProveedor).toBe("HTTP 503");
    expect(r.fuente).toBe("geocerca");
    expect(env.notificados).toMatchObject([{ paradaId: "A", motivo: "geocerca" }]);
  });

  it("usa la geocerca de respaldo si la API de mapas no responde a tiempo", async () => {
    const lento: ProveedorEta = { nombre: "lento", duracionesTramos: () => new Promise(() => {}) };
    const env = crearEntorno(lento);
    const r = await env.evaluar(BASE, [parada("A", alNorte(BASE, 1200))]);
    expect(r.errorProveedor).toMatch(/timeout/);
    expect(env.notificados).toHaveLength(1);
  });

  it("rechaza respuestas incoherentes del proveedor y cae al respaldo", async () => {
    const malo: ProveedorEta = { nombre: "malo", duracionesTramos: () => Promise.resolve([NaN]) };
    const env = crearEntorno(malo);
    const r = await env.evaluar(BASE, [parada("A", alNorte(BASE, 5000))]);
    expect(r.fuente).toBe("geocerca");
  });

  it("no gasta consultas a la API cuando el furgón está lejos ni cuando el ETA es reciente", async () => {
    const proveedor = proveedorFalso();
    const env = crearEntorno(proveedor);
    const casa = parada("A", alNorte(BASE, 30_000));
    await env.evaluar(BASE, [casa]);
    expect(proveedor.consultas).toBe(0);

    const cerca = parada("B", alNorte(BASE, 4000));
    await env.evaluar(BASE, [cerca]);
    env.avanzar(15);
    await env.evaluar(alNorte(BASE, 150), [cerca]);
    expect(proveedor.consultas).toBe(1);
    env.avanzar(60);
    await env.evaluar(alNorte(BASE, 300), [cerca]);
    expect(proveedor.consultas).toBe(2);
  });

  it("una posición vieja (cola reenviada) no dispara avisos ni consulta la API", async () => {
    const proveedor = proveedorFalso();
    const env = crearEntorno(proveedor);
    const r = await evaluarPosicion(env.deps, {
      recorridoId: "rec-1",
      posicion: { ...BASE, registradaEnMs: env.ahora() - 5 * 60_000 },
      paradas: [parada("A", alNorte(BASE, 100))],
      cache: null,
    });
    expect(r.vigente).toBe(false);
    expect(env.notificados).toHaveLength(0);
    expect(proveedor.consultas).toBe(0);
  });

  it("si falla el envío de la notificación, el aviso queda registrado y no se reintenta en bucle", async () => {
    const env = crearEntorno();
    const log = vi.fn();
    env.deps.log = log;
    env.deps.notificar = () => Promise.reject(new Error("Expo caído"));
    const casa = parada("A", alNorte(BASE, 200));
    const r = await env.evaluar(BASE, [casa]);
    expect(r.avisosCreados).toHaveLength(1);
    expect(log).toHaveBeenCalled();
    const r2 = await env.evaluar(BASE, [casa]);
    expect(r2.avisosCreados).toHaveLength(0);
  });
});

describe("dispararUnaVez", () => {
  it("permite un aviso por alumno en cada recorrido distinto (ida y vuelta)", async () => {
    const registro = new RegistroAvisosEnMemoria();
    const enviados: string[] = [];
    const d = { paradaId: "p", alumnoId: "sofia", motivo: "eta" as const, etaSeg: 300 };
    const enviar = (id: string) => {
      enviados.push(id);
      return Promise.resolve();
    };
    await dispararUnaVez("ida-lunes", [d], registro, enviar);
    await dispararUnaVez("ida-lunes", [d], registro, enviar);
    await dispararUnaVez("vuelta-lunes", [d], registro, enviar);
    expect(enviados).toHaveLength(2);
  });
});
