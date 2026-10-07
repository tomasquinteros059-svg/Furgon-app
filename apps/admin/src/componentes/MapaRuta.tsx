// Mapa (OpenStreetMap + Leaflet) de una ruta: el colegio, las casas numeradas en orden y el
// trazado. Se usa para revisar la ruta recomendada antes de aplicarla.
import L from "leaflet";
import { useEffect, useRef } from "react";
import { svgIcono } from "../../../../diseno/iconos.ts";

export interface CasaRuta { id: string; nombre: string; lat: number; lng: number; noVa?: boolean }

// Dentro del pin va un número o, para el colegio, el ícono propio en blanco.
const contenidoPin = (texto: string) => texto === "colegio"
  ? svgIcono("colegio", { tam: 15, color: "#fff", acento: "rgba(255,255,255,0.3)" }).replace("<svg ", '<svg x="7.5" y="7" ')
  : `<text x="15" y="19" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#fff">${texto}</text>`;

const pin = (texto: string, color: string) => L.divIcon({
  className: "pin-casa",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39C15 39 2.5 24 2.5 14.5a12.5 12.5 0 1 1 25 0C27.5 24 15 39 15 39z" fill="${color}" stroke="#fff" stroke-width="2.5"/>${contenidoPin(texto)}</svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

export function MapaRuta({ casas, colegio, tipo, alto = 280 }: {
  casas: CasaRuta[];
  colegio: { lat: number; lng: number; nombre?: string | null } | null;
  tipo: "ida" | "vuelta";
  alto?: number;
}) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!div.current) return;
    const m = L.map(div.current, { scrollWheelZoom: false }).setView([-33.4489, -70.6693], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© colaboradores de OpenStreetMap",
    }).addTo(m);
    mapa.current = m;
    capa.current = L.layerGroup().addTo(m);
    return () => { m.remove(); mapa.current = null; capa.current = null; };
  }, []);

  const clave = JSON.stringify([casas, colegio, tipo]);
  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    const van = casas.filter((c) => !c.noVa);
    const puntos: L.LatLngExpression[] = van.map((c) => [c.lat, c.lng]);
    if (colegio) {
      if (tipo === "ida") puntos.push([colegio.lat, colegio.lng]); else puntos.unshift([colegio.lat, colegio.lng]);
      L.marker([colegio.lat, colegio.lng], { icon: pin("colegio", "#15202B"), title: colegio.nombre ?? "Colegio" }).addTo(g);
    }
    if (puntos.length > 1) {
      L.polyline(puntos, { color: "#FFFFFF", weight: 8, opacity: 1 }).addTo(g);
      L.polyline(puntos, { color: "#16324F", weight: 4, opacity: .9 }).addTo(g);
    }
    let n = 0;
    casas.forEach((c) => {
      L.marker([c.lat, c.lng], { icon: pin(c.noVa ? "–" : String(++n), c.noVa ? "#8A95A1" : "#C4281C"), title: c.noVa ? `${c.nombre} (hoy no va)` : c.nombre }).addTo(g);
    });
    const todos: L.LatLngExpression[] = [...casas.map((c) => [c.lat, c.lng] as L.LatLngTuple), ...(colegio ? [[colegio.lat, colegio.lng] as L.LatLngTuple] : [])];
    if (todos.length) m.fitBounds(L.latLngBounds(todos), { padding: [30, 30], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return <div ref={div} className="mapa-pin" style={{ height: alto }} role="img" aria-label="Mapa de la ruta con las casas numeradas en orden" />;
}
