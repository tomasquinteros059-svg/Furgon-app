// Mapa (OpenStreetMap + Leaflet) para ubicar la casa del alumno con un pin exacto.
import L from "leaflet";
import { useEffect, useRef } from "react";
import { idioma, t } from "../i18n";

const icono = L.divIcon({
  className: "pin-casa",
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 3 26 3 16a14 14 0 1 1 28 0c0 10-14 27-14 27z" fill="#C4281C" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

export interface Punto { lat: number; lng: number }

export function MapaPin({ punto, onCambio, alto = 300, soloLectura = false }: {
  punto: Punto | null;
  onCambio?: (p: Punto) => void;
  alto?: number;
  soloLectura?: boolean;
}) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const cambio = useRef(onCambio);
  cambio.current = onCambio;

  useEffect(() => {
    if (!div.current) return;
    const m = L.map(div.current, { scrollWheelZoom: false }).setView(punto ? [punto.lat, punto.lng] : [-33.4489, -70.6693], punto ? 16 : 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: t("© colaboradores de OpenStreetMap"),
    }).addTo(m);
    if (!soloLectura) m.on("click", (e: L.LeafletMouseEvent) => cambio.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapa.current = m;
    return () => { m.remove(); mapa.current = null; marcador.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current; if (!m) return;
    if (!punto) { marcador.current?.remove(); marcador.current = null; return; }
    if (!marcador.current) {
      marcador.current = L.marker([punto.lat, punto.lng], { icon: icono, draggable: !soloLectura }).addTo(m);
      marcador.current.on("dragend", () => { const ll = marcador.current!.getLatLng(); cambio.current?.({ lat: ll.lat, lng: ll.lng }); });
      m.setView([punto.lat, punto.lng], Math.max(m.getZoom(), 16));
    } else {
      marcador.current.setLatLng([punto.lat, punto.lng]);
      m.panTo([punto.lat, punto.lng]); // una nueva búsqueda lleva el mapa a la dirección encontrada
    }
  }, [punto?.lat, punto?.lng, soloLectura]);

  return <div ref={div} className="mapa-pin" style={{ height: alto }} role="application" aria-label={t("Mapa: toca o arrastra el pin para ubicar la casa")} />;
}

/** Busca una dirección con Nominatim (OpenStreetMap). */
export async function buscarDireccion(q: string): Promise<Punto | null> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`, {
    headers: { "Accept-Language": idioma() },
  });
  const d = await r.json() as { lat: string; lon: string }[];
  return d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon) } : null;
}
