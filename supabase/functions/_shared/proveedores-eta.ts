// Proveedores de ETA con tráfico. Ambos devuelven la duración de cada tramo de la
// ruta origen → d1 → d2 → ... en el orden dado (sin reordenar paradas).

import type { ProveedorEta } from "./core/flujo-aviso.ts";
import type { LatLng } from "./core/geo.ts";
import { entorno } from "./entorno.ts";

/** Google Maps Platform — Routes API (computeRoutes, TRAFFIC_AWARE). */
export class ProveedorGoogleRoutes implements ProveedorEta {
  readonly nombre = "google-routes";
  constructor(private readonly apiKey: string) {}

  async duracionesTramos(origen: LatLng, destinos: LatLng[]): Promise<number[]> {
    if (destinos.length === 0) return [];
    const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
    signal: AbortSignal.timeout(5_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "routes.legs.duration",
      },
      body: JSON.stringify({
        origin: wp(origen),
        destination: wp(destinos[destinos.length - 1]),
        intermediates: destinos.slice(0, -1).map(wp),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "es-419",
        units: "METRIC",
      }),
    });
    if (!resp.ok) throw new Error(`Routes API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const datos = await resp.json() as { routes?: { legs?: { duration?: string }[] }[] };
    const tramos = datos.routes?.[0]?.legs ?? [];
    // La duración viene como "123s".
    return tramos.map((t) => parseFloat((t.duration ?? "").replace(/s$/, "")));
  }
}

/**
 * Mapbox Directions (perfil driving-traffic). El perfil con tráfico admite pocas
 * coordenadas por consulta, así que la ruta se pide en trozos encadenados en paralelo.
 */
export class ProveedorMapbox implements ProveedorEta {
  readonly nombre = "mapbox";
  constructor(private readonly token: string, private readonly paradasPorConsulta = 2) {}

  async duracionesTramos(origen: LatLng, destinos: LatLng[]): Promise<number[]> {
    const puntos = [origen, ...destinos];
    const trozos: LatLng[][] = [];
    for (let i = 0; i < destinos.length; i += this.paradasPorConsulta) {
      trozos.push(puntos.slice(i, i + this.paradasPorConsulta + 1));
    }
    const resultados = await Promise.all(trozos.map((t) => this.consultar(t)));
    return resultados.flat();
  }

  private async consultar(puntos: LatLng[]): Promise<number[]> {
    const coords = puntos.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
      `?overview=false&steps=false&access_token=${encodeURIComponent(this.token)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!resp.ok) throw new Error(`Mapbox HTTP ${resp.status}`);
    const datos = await resp.json() as { routes?: { legs?: { duration?: number }[] }[] };
    return (datos.routes?.[0]?.legs ?? []).map((l) => Number(l.duration));
  }
}

export function proveedorDesdeEntorno(): ProveedorEta | null {
  switch (entorno.etaProveedor()) {
    case "google": {
      const key = entorno.googleMapsKey();
      return key ? new ProveedorGoogleRoutes(key) : null;
    }
    case "mapbox": {
      const token = entorno.mapboxToken();
      return token ? new ProveedorMapbox(token) : null;
    }
    default:
      return null;
  }
}

/**
 * Trazado por calles (polilínea codificada) de origen → paradas en orden, para dibujar
 * la ruta en el mapa de la conductora. Devuelve null si no hay clave de Google configurada.
 */
export async function trazadoGoogle(origen: LatLng, destinos: LatLng[]): Promise<string | null> {
  const key = entorno.googleMapsKey();
  if (!key || destinos.length === 0) return null;
  // Google acepta hasta 25 paradas intermedias: en rutas más largas se dibujan las próximas 26.
  destinos = destinos.slice(0, 26);
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.polyline.encodedPolyline" },
    body: JSON.stringify({
      origin: wp(origen),
      destination: wp(destinos[destinos.length - 1]),
      intermediates: destinos.slice(0, -1).map(wp),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });
  if (!resp.ok) throw new Error(`Routes API HTTP ${resp.status}`);
  const datos = await resp.json() as { routes?: { polyline?: { encodedPolyline?: string } }[] };
  return datos.routes?.[0]?.polyline?.encodedPolyline ?? null;
}

/**
 * Largo por calles (Routes API) de puntos[0] → intermedios → último punto. Con `optimizar`,
 * Google reordena los intermedios (origen y destino quedan fijos) y devuelve el nuevo orden.
 * Sin clave de Google, o con más de 25 intermedios, devuelve null.
 */
export async function rutaGoogle(
  puntos: LatLng[],
  optimizar: boolean,
): Promise<{ metros: number; ordenIntermedios: number[] } | null> {
  const key = entorno.googleMapsKey();
  if (!key || puntos.length < 2 || puntos.length - 2 > 25) return null;
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const intermedios = puntos.slice(1, -1);
  const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify({
      origin: wp(puntos[0]),
      destination: wp(puntos[puntos.length - 1]),
      intermediates: intermedios.map(wp),
      travelMode: "DRIVE",
      // La optimización del orden no admite TRAFFIC_AWARE_OPTIMAL; para planificar basta sin tráfico.
      routingPreference: "TRAFFIC_UNAWARE",
      optimizeWaypointOrder: optimizar && intermedios.length > 1,
    }),
  });
  if (!resp.ok) throw new Error(`Routes API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const datos = await resp.json() as { routes?: { distanceMeters?: number; optimizedIntermediateWaypointIndex?: number[] }[] };
  const r = datos.routes?.[0];
  if (!r || typeof r.distanceMeters !== "number") return null;
  const indices = r.optimizedIntermediateWaypointIndex;
  const valido = Array.isArray(indices) && indices.length === intermedios.length && indices.every((i) => i >= 0);
  return { metros: r.distanceMeters, ordenIntermedios: valido ? indices : intermedios.map((_, i) => i) };
}
