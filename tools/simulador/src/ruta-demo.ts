// Datos geográficos de la demo (Santiago, Ñuñoa → La Reina → Las Condes → Providencia).
import type { LatLng } from "../../../supabase/functions/_shared/core/geo.ts";

export const COLEGIO = { nombre: "Colegio Demo (Plaza Ñuñoa)", lat: -33.4565, lng: -70.5978 };
export const BASE_FURGON: LatLng = { lat: -33.4705, lng: -70.6130 };

export const ALUMNOS_DEMO = [
  { nombre: "Sofía Pérez", curso: "3° Básico", apoderado: 0, direccion: "Av. Ossa 1200, La Reina", ubicacion: { lat: -33.4495, lng: -70.5560 } },
  { nombre: "Matías Soto", curso: "5° Básico", apoderado: 1, direccion: "Av. Tomás Moro 300, Las Condes", ubicacion: { lat: -33.4180, lng: -70.5540 } },
  { nombre: "Isidora Rojas", curso: "1° Básico", apoderado: 0, direccion: "Av. Pedro de Valdivia 900, Providencia", ubicacion: { lat: -33.4260, lng: -70.6100 } },
] as const;

/**
 * Recorrido "tipo cuadrícula" entre puntos: inserta una esquina intermedia para que
 * el trayecto se parezca más a calles que a una línea recta.
 */
export function trazarRuta(puntos: LatLng[]): LatLng[] {
  const ruta: LatLng[] = [];
  puntos.forEach((p, i) => {
    if (i > 0) {
      const prev = puntos[i - 1];
      ruta.push({ lat: prev.lat, lng: p.lng });
    }
    ruta.push(p);
  });
  return ruta;
}
