// Simulador de recorrido: mueve un "furgón" virtual por una ruta y envía posiciones
// GPS falsas al backend exactamente como lo haría la app del conductor (cola local,
// lotes, reenvío tras perder señal). Permite probar los avisos sin salir a manejar.
//
//   npm run simular -- --tipo vuelta --acelerar 4
//   npm run simular -- --seco                # sin backend: evalúa los avisos localmente
//   npm run simular -- --sin-senal 120-300   # corta la señal entre los segundos 120 y 300
//   npm run simular -- --archivo ruta.geojson
//
// Opciones:
//   --tipo ida|vuelta     ruta de la demo a recorrer (por defecto: vuelta)
//   --velocidad <km/h>    velocidad del furgón (30)
//   --intervalo <s>       segundos simulados entre posiciones GPS (10)
//   --acelerar <x>        compresión del tiempo; 4 = 4 veces más rápido (1)
//   --detencion <s>       tiempo detenido en cada casa (30)
//   --sin-senal <a-b>     ventana (segundos simulados) sin conexión
//   --archivo <ruta>      GeoJSON LineString o [[lng,lat],...] a seguir en lugar de la ruta generada
//   --no-entregar         no marcar "entregado" automáticamente al llegar a cada casa
//   --seco                no usa Supabase: aplica la misma lógica de disparo en memoria

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { AlmacenColaEnMemoria, type PosicionGps, type ResultadoEnvio, vaciarCola } from "../../../supabase/functions/_shared/core/cola.ts";
import { CONFIG_DISPARO_POR_DEFECTO, type CacheEta, type ParadaPendiente } from "../../../supabase/functions/_shared/core/disparo.ts";
import { RegistroAvisosEnMemoria } from "../../../supabase/functions/_shared/core/dedup.ts";
import { evaluarPosicion } from "../../../supabase/functions/_shared/core/flujo-aviso.ts";
import { distanciaM, interpolar, type LatLng, rumbo } from "../../../supabase/functions/_shared/core/geo.ts";
import { mensajeAviso } from "../../../supabase/functions/_shared/core/mensajes.ts";
import { ALUMNOS_DEMO, BASE_FURGON, COLEGIO, trazarRuta } from "./ruta-demo.ts";
import { ARCHIVO_DEMO, cargarEnv, dormir, hhmmss, mmss, requerida } from "./util.ts";

cargarEnv();

const { values: op } = parseArgs({
  options: {
    tipo: { type: "string", default: "vuelta" },
    velocidad: { type: "string", default: "30" },
    intervalo: { type: "string", default: "10" },
    acelerar: { type: "string", default: "1" },
    detencion: { type: "string", default: "30" },
    "sin-senal": { type: "string" },
    archivo: { type: "string" },
    "no-entregar": { type: "boolean", default: false },
    seco: { type: "boolean", default: false },
  },
});

const tipo = op.tipo === "ida" ? "ida" : "vuelta";
const velocidadMs = Number(op.velocidad) / 3.6;
const intervaloSeg = Number(op.intervalo);
const acelerar = Math.max(0.1, Number(op.acelerar));
const detencionSeg = Number(op.detencion);
const [sinSenalDesde, sinSenalHasta] = (op["sin-senal"] ?? "-1--1").split("-").map(Number);

interface Parada {
  id: string;
  nombre: string;
  ubicacion: LatLng;
  minutosAviso: number;
}

/** Conexión con el backend (o su imitación en memoria con --seco). */
interface Backend {
  iniciar(): Promise<{ recorridoId: string; paradas: Parada[] }>;
  enviar(recorridoId: string, lote: PosicionGps[], relojSimMs: number): Promise<ResultadoEnvio & { resumen?: string }>;
  marcar(paradaId: string): Promise<void>;
  finalizar(recorridoId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Backend real (Supabase)
// ---------------------------------------------------------------------------

async function backendSupabase(): Promise<Backend> {
  const url = requerida("SUPABASE_URL");
  const sb: SupabaseClient = createClient(url, requerida("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
  if (!existsSync(ARCHIVO_DEMO)) {
    console.error("❌ No encontré la demo. Ejecuta primero: npm run demo:preparar");
    process.exit(1);
  }
  const demo = JSON.parse(readFileSync(ARCHIVO_DEMO, "utf8"));
  const { error } = await sb.auth.signInWithPassword({ email: demo.usuarios.conductor, password: demo.password });
  if (error) throw new Error(`login conductor: ${error.message}`);

  const llamar = async (funcion: string, cuerpo: unknown) => {
    const { data: s } = await sb.auth.getSession();
    return fetch(`${url}/functions/v1/${funcion}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  };

  return {
    async iniciar() {
      const { data: recorridoId, error } = await sb.rpc("iniciar_recorrido", { p_ruta: demo.rutas[tipo] });
      if (error) throw new Error(`iniciar_recorrido: ${error.message}`);
      const { data, error: e2 } = await sb
        .from("recorrido_alumnos")
        .select("id, orden, estado, alumnos(nombre, minutos_aviso), domicilios(lat, lng)")
        .eq("recorrido_id", recorridoId)
        .eq("estado", "pendiente")
        .order("orden");
      if (e2) throw new Error(e2.message);
      const paradas = (data ?? []).map((r) => {
        const a = r.alumnos as unknown as { nombre: string; minutos_aviso: number };
        const d = r.domicilios as unknown as LatLng;
        return { id: r.id, nombre: a.nombre, minutosAviso: a.minutos_aviso, ubicacion: { lat: d.lat, lng: d.lng } };
      });
      return { recorridoId, paradas };
    },
    async enviar(recorridoId, lote) {
      try {
        const resp = await llamar("posiciones", {
          recorrido_id: recorridoId,
          posiciones: lote.map((p) => ({
            client_id: p.clientId, ts: p.registradaEnMs, lat: p.lat, lng: p.lng,
            precision_m: p.precisionM, velocidad_ms: p.velocidadMs, rumbo: p.rumbo,
          })),
        });
        const cuerpo = await resp.json().catch(() => ({}));
        if (resp.ok) {
          const avisos = cuerpo.avisos_disparados ? `  🔔 ${cuerpo.avisos_disparados} AVISO(S) DISPARADO(S)` : "";
          return { ok: true, resumen: `fuente=${cuerpo.fuente ?? "-"}${avisos}` };
        }
        // 4xx: el servidor rechazó el lote (p. ej. recorrido finalizado): no reintentar.
        return { ok: false, reintentable: resp.status >= 500, error: `HTTP ${resp.status} ${cuerpo.error ?? ""}` };
      } catch (e) {
        return { ok: false, reintentable: true, error: String(e) };
      }
    },
    async marcar(paradaId) {
      const resp = await llamar("marcar-parada", { parada_id: paradaId, estado: "entregado" });
      if (!resp.ok) console.warn("   ⚠️  no se pudo marcar entregado:", resp.status, await resp.text());
    },
    async finalizar(recorridoId) {
      await sb.rpc("finalizar_recorrido", { p_recorrido: recorridoId });
    },
  };
}

// ---------------------------------------------------------------------------
// Backend en memoria (--seco): misma lógica de disparo, sin red ni API de mapas
// ---------------------------------------------------------------------------

function backendSeco(): Backend {
  const paradas: (Parada & { estado: string; alumnoId: string })[] = (tipo === "ida" ? [...ALUMNOS_DEMO].reverse() : ALUMNOS_DEMO)
    .map((a, i) => ({
      id: `parada-${i + 1}`, alumnoId: `alumno-${i + 1}`, nombre: a.nombre, minutosAviso: 5,
      ubicacion: a.ubicacion, estado: "pendiente",
    }));
  const registro = new RegistroAvisosEnMemoria();
  let cache: CacheEta | null = null;

  return {
    iniciar: () => Promise.resolve({ recorridoId: "recorrido-seco", paradas }),
    async enviar(recorridoId, lote, relojSimMs) {
      const ultima = lote.reduce((a, b) => (b.registradaEnMs > a.registradaEnMs ? b : a));
      const pendientes: ParadaPendiente[] = paradas.filter((p) => p.estado === "pendiente").map((p) => ({
        id: p.id, alumnoId: p.alumnoId, ubicacion: p.ubicacion, minutosAviso: p.minutosAviso,
        avisado: registro.avisos.has(`${recorridoId}:${p.alumnoId}`),
      }));
      const avisos: string[] = [];
      const r = await evaluarPosicion({
        ahoraMs: () => relojSimMs,
        config: CONFIG_DISPARO_POR_DEFECTO,
        proveedorEta: null,
        timeoutProveedorMs: 0,
        registro,
        guardarEtas: (_r, _e, c) => {
          if (c) cache = c;
          return Promise.resolve();
        },
        notificar: (_id, d) => {
          const p = paradas.find((x) => x.id === d.paradaId)!;
          avisos.push(mensajeAviso({ tipo, nombreAlumno: p.nombre, etaSeg: d.etaSeg, motivo: d.motivo }).cuerpo);
          return Promise.resolve();
        },
      }, {
        recorridoId,
        posicion: { lat: ultima.lat, lng: ultima.lng, registradaEnMs: ultima.registradaEnMs },
        paradas: pendientes,
        cache,
      });
      const resumen = `fuente=${r.fuente ?? "-"}` + avisos.map((t) => `\n   🔔 PUSH + LLAMADA: "${t}"`).join("");
      return { ok: true, resumen };
    },
    marcar(paradaId) {
      paradas.find((p) => p.id === paradaId)!.estado = "entregado";
      return Promise.resolve();
    },
    finalizar: () => Promise.resolve(),
  };
}

// ---------------------------------------------------------------------------
// Trayecto
// ---------------------------------------------------------------------------

function leerArchivoRuta(ruta: string): LatLng[] {
  const datos = JSON.parse(readFileSync(ruta, "utf8"));
  const coords: [number, number][] =
    datos.type === "FeatureCollection" ? datos.features[0].geometry.coordinates
    : datos.type === "Feature" ? datos.geometry.coordinates
    : datos.type === "LineString" ? datos.coordinates
    : datos;
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

class Trayecto {
  private acumulado: number[] = [0];
  constructor(readonly puntos: LatLng[]) {
    for (let i = 1; i < puntos.length; i++) {
      this.acumulado.push(this.acumulado[i - 1] + distanciaM(puntos[i - 1], puntos[i]));
    }
  }
  get largo() {
    return this.acumulado.at(-1)!;
  }
  /** Posición y rumbo a `d` metros del inicio. */
  en(d: number): { punto: LatLng; rumbo: number } {
    const dd = Math.min(Math.max(d, 0), this.largo);
    let i = this.acumulado.findIndex((a) => a >= dd);
    if (i <= 0) i = 1;
    const tramo = this.acumulado[i] - this.acumulado[i - 1] || 1;
    const t = (dd - this.acumulado[i - 1]) / tramo;
    return { punto: interpolar(this.puntos[i - 1], this.puntos[i], t), rumbo: rumbo(this.puntos[i - 1], this.puntos[i]) };
  }
  /** Distancia desde el inicio hasta el punto del trayecto más cercano a `p`. */
  distanciaHasta(p: LatLng): number {
    let mejor = 0;
    let menor = Infinity;
    for (let d = 0; d <= this.largo; d += 10) {
      const dist = distanciaM(this.en(d).punto, p);
      if (dist < menor) [menor, mejor] = [dist, d];
    }
    return mejor;
  }
}

// ---------------------------------------------------------------------------
// Bucle principal
// ---------------------------------------------------------------------------

async function main() {
  const backend = op.seco ? backendSeco() : await backendSupabase();
  const { recorridoId, paradas } = await backend.iniciar();
  if (paradas.length === 0) {
    console.log("No hay alumnos pendientes en este recorrido.");
    return;
  }

  const casas = paradas.map((p) => p.ubicacion);
  const puntos = op.archivo
    ? leerArchivoRuta(op.archivo)
    : trazarRuta(tipo === "ida" ? [BASE_FURGON, ...casas, COLEGIO] : [COLEGIO, ...casas]);
  const trayecto = new Trayecto(puntos);
  const metasParadas = paradas.map((p) => ({ ...p, enMetro: trayecto.distanciaHasta(p.ubicacion) }));

  console.log(`🚐 Recorrido de ${tipo} ${op.seco ? "(modo seco, sin backend)" : recorridoId}`);
  console.log(`   ${(trayecto.largo / 1000).toFixed(1)} km a ${op.velocidad} km/h, posición cada ${intervaloSeg}s, x${acelerar}`);
  metasParadas.forEach((p, i) => console.log(`   ${i + 1}. ${p.nombre} (aviso ${p.minutosAviso} min)`));
  console.log("");

  const cola = new AlmacenColaEnMemoria();
  const inicioReal = Date.now();
  let t = 0; // segundos simulados
  let recorrido = 0; // metros recorridos
  let detenidoHasta: number | null = null;
  let siguiente = 0;

  while (true) {
    const reloj = op.seco ? inicioReal + t * 1000 : Date.now();
    const { punto, rumbo: r } = trayecto.en(recorrido);
    await cola.agregar([{
      clientId: randomUUID(), recorridoId, registradaEnMs: reloj, lat: punto.lat, lng: punto.lng,
      precisionM: 8, velocidadMs: detenidoHasta === null ? velocidadMs : 0, rumbo: r,
    }]);

    const meta = metasParadas[siguiente];
    const estado = meta ? `${((meta.enMetro - recorrido) / 1000).toFixed(2)} km a ${meta.nombre}` : "rumbo al final";
    let linea = `[${hhmmss(t)}] 📍 ${estado}`;
    if (t >= sinSenalDesde && t <= sinSenalHasta) {
      linea += `  📵 sin señal (en cola: ${await cola.contar()})`;
    } else {
      let resumen = "";
      const r = await vaciarCola(cola, async (rid, lote) => {
        const res = await backend.enviar(rid, lote, reloj);
        if ("resumen" in res && res.resumen) resumen = res.resumen;
        return res;
      });
      linea += `  ↑${r.enviadas}` + (r.error ? `  ⚠️ ${r.error}` : "") + (resumen ? `  ${resumen}` : "");
    }
    console.log(linea);

    if (detenidoHasta === null && meta && recorrido >= meta.enMetro) {
      console.log(`   🏠 Llegó donde ${meta.nombre}. Detenido ${detencionSeg}s.`);
      detenidoHasta = t + detencionSeg;
    } else if (detenidoHasta !== null && t >= detenidoHasta) {
      if (!op["no-entregar"]) {
        await backend.marcar(meta.id);
        console.log(`   ✅ ${meta.nombre} marcado como ${tipo === "ida" ? "recogido" : "entregado"}.`);
      }
      siguiente++;
      detenidoHasta = null;
    } else if (detenidoHasta === null && !meta && recorrido >= trayecto.largo) {
      break;
    }

    if (detenidoHasta === null) {
      // Avanza sin pasarse de la próxima casa, para detenerse justo en ella.
      const tope = metasParadas[siguiente]?.enMetro ?? trayecto.largo;
      recorrido = Math.min(tope, recorrido + velocidadMs * intervaloSeg);
    }
    t += intervaloSeg;
    await dormir(op.seco && acelerar >= 50 ? 0 : (intervaloSeg * 1000) / acelerar);
  }

  await backend.finalizar(recorridoId);
  console.log(`\n🏁 Recorrido finalizado en ${mmss(t)} simulados.`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
