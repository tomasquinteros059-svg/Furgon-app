import type { LatLng } from "../supabase/functions/_shared/core/geo.ts";
import type { ParadaPendiente } from "../supabase/functions/_shared/core/disparo.ts";

/** Plaza de Armas de Santiago, punto de referencia para los tests. */
export const BASE: LatLng = { lat: -33.4378, lng: -70.6505 };

const M_POR_GRADO_LAT = 111_195;

/** Punto a `metros` al norte (positivos) o al sur (negativos) de `desde`. */
export function alNorte(desde: LatLng, metros: number): LatLng {
  return { lat: desde.lat + metros / M_POR_GRADO_LAT, lng: desde.lng };
}

/** Punto a `metros` al este de `desde`. */
export function alEste(desde: LatLng, metros: number): LatLng {
  const mPorGradoLng = M_POR_GRADO_LAT * Math.cos((desde.lat * Math.PI) / 180);
  return { lat: desde.lat, lng: desde.lng + metros / mPorGradoLng };
}

export function parada(id: string, ubicacion: LatLng, extra: Partial<ParadaPendiente> = {}): ParadaPendiente {
  return { id, alumnoId: `alumno-${id}`, ubicacion, minutosAviso: 5, avisado: false, ...extra };
}
