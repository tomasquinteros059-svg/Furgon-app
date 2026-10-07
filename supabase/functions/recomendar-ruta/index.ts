// POST /functions/v1/recomendar-ruta  { ruta_id }
// Recomienda el orden de las paradas de una ruta con las direcciones de los alumnos.
// Primero calcula el mejor orden por distancia (core/recomendar-ruta.ts) y, si hay clave
// de Google configurada, lo afina con la Routes API (orden óptimo por calles reales).
// No guarda nada: la tía revisa la propuesta y la aplica con la RPC aplicar_orden_ruta.
// { orden: string[] (alumno_id), metros, metrosActual, ahorroM, cambia, fuente: "google" | "estimada" }

import { extremosDeRuta, type ParadaRuta, recomendarRuta, type Recomendacion } from "../_shared/core/recomendar-ruta.ts";
import type { LatLng } from "../_shared/core/geo.ts";
import { clienteUsuario, CORS, error, json } from "../_shared/http.ts";
import { rutaGoogle } from "../_shared/proveedores-eta.ts";

interface FilaRuta {
  tipo: "ida" | "vuelta";
  colegio_lat: number | null;
  colegio_lng: number | null;
  ruta_paradas: { alumno_id: string; orden: number; domicilios: { lat: number; lng: number } | null }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // Se consulta como el usuario: RLS limita la ruta a su empresa.
  const sb = clienteUsuario(req);
  const { data: esAdmin, error: e1 } = await sb.rpc("soy_admin");
  if (e1) return error(401, "sin_sesion", "Inicia sesión nuevamente");
  if (!esAdmin) return error(403, "no_autorizado", "Solo quien administra puede ordenar las rutas");

  const { ruta_id } = await req.json().catch(() => ({})) as { ruta_id?: string };
  if (!ruta_id) return error(400, "datos", "Falta la ruta");
  const { data } = await sb.from("rutas")
    .select("tipo, colegio_lat, colegio_lng, ruta_paradas(alumno_id, orden, domicilios(lat, lng))")
    .eq("id", ruta_id).maybeSingle();
  const ruta = data as unknown as FilaRuta | null;
  if (!ruta) return error(404, "no_encontrada", "Ruta no encontrada");

  const paradas: ParadaRuta[] = [...ruta.ruta_paradas].sort((a, b) => a.orden - b.orden)
    .filter((p) => p.domicilios)
    .map((p) => ({ id: p.alumno_id, lat: p.domicilios!.lat, lng: p.domicilios!.lng }));
  const colegio = ruta.colegio_lat != null && ruta.colegio_lng != null ? { lat: ruta.colegio_lat, lng: ruta.colegio_lng } : null;
  const local = recomendarRuta(paradas, extremosDeRuta(ruta.tipo, colegio));

  try {
    const google = colegio ? await afinarConGoogle(ruta.tipo, colegio, paradas, local) : null;
    if (google) return json({ ...google, fuente: "google" });
  } catch (e) {
    console.warn("recomendar-ruta: Google no respondió, se usa la estimación", e);
  }
  return json({ ...local, fuente: "estimada" });
});

/**
 * Google fija el origen y el destino y ordena los intermedios. En la ida el destino es el
 * colegio y el origen la primera casa de la propuesta local; en la vuelta el origen es el
 * colegio y el destino la última casa de la propuesta local.
 */
async function afinarConGoogle(
  tipo: "ida" | "vuelta", colegio: LatLng, paradas: ParadaRuta[], local: Recomendacion,
): Promise<Recomendacion | null> {
  if (paradas.length < 2) return null;
  const porId = new Map(paradas.map((p) => [p.id, p]));
  const propuesta = local.orden.map((id) => porId.get(id)!);
  const conColegio = (casas: LatLng[]) => (tipo === "ida" ? [...casas, colegio] : [colegio, ...casas]);

  const [actual, optima] = await Promise.all([rutaGoogle(conColegio(paradas), false), rutaGoogle(conColegio(propuesta), true)]);
  if (!actual || !optima) return null;

  // Reconstruye el orden de las casas con los intermedios reordenados por Google.
  const fija = tipo === "ida" ? propuesta[0] : propuesta[propuesta.length - 1];
  const intermedias = tipo === "ida" ? propuesta.slice(1) : propuesta.slice(0, -1);
  const reordenadas = optima.ordenIntermedios.map((i) => intermedias[i]);
  const orden = (tipo === "ida" ? [fija, ...reordenadas] : [...reordenadas, fija]).map((p) => p.id);

  // Si Google no encuentra un ahorro de al menos 50 m, se mantiene el orden actual.
  if (optima.metros > actual.metros - 50) {
    return { orden: paradas.map((p) => p.id), metros: actual.metros, metrosActual: actual.metros, ahorroM: 0, cambia: false };
  }
  return {
    orden, metros: optima.metros, metrosActual: actual.metros, ahorroM: actual.metros - optima.metros,
    cambia: orden.some((id, i) => id !== paradas[i].id),
  };
}
