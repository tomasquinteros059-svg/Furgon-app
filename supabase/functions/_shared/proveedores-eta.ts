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
    const resp = await fetch(url);
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
