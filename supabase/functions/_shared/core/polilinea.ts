// Decodificador del formato "encoded polyline" de Google (Routes/Directions API).
import type { LatLng } from "./geo.ts";

export function decodificarPolilinea(codificada: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const puntos: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  const siguiente = () => {
    let resultado = 0, desplazamiento = 0, b: number;
    do {
      b = codificada.charCodeAt(i++) - 63;
      resultado |= (b & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (b >= 0x20 && i <= codificada.length);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };
  while (i < codificada.length) {
    lat += siguiente();
    lng += siguiente();
    puntos.push({ lat: lat / factor, lng: lng / factor });
  }
  return puntos;
}
