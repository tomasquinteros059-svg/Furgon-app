// Utilidades geográficas sin dependencias (válidas en Deno, Node y React Native).

export interface LatLng {
  lat: number;
  lng: number;
}

const RADIO_TIERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en línea recta (gran círculo) entre dos puntos, en metros. */
export function distanciaM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distancias acumuladas en línea recta desde `origen` pasando por cada punto en orden.
 * Es una cota inferior de la distancia real por calles para llegar a cada punto
 * siguiendo ese orden (cada tramo por calle es >= su tramo en línea recta).
 */
export function distanciasAcumuladasM(origen: LatLng, puntos: LatLng[]): number[] {
  const res: number[] = [];
  let total = 0;
  let previo = origen;
  for (const p of puntos) {
    total += distanciaM(previo, p);
    res.push(total);
    previo = p;
  }
  return res;
}

/** Punto intermedio a la fracción `t` (0..1) entre a y b (interpolación lineal, suficiente en tramos cortos). */
export function interpolar(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Rumbo en grados (0 = norte) de a hacia b. */
export function rumbo(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function esCoordenadaValida(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
  );
}
