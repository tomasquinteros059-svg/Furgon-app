// Comprueba que la clave de servidor de Google funciona con la Routes API:
// pide el tiempo de viaje con tráfico entre dos puntos de Santiago y una ruta optimizada.
//
//   GOOGLE_MAPS_API_KEY=… node scripts/verificar-google.mjs

const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
if (!key) { console.error("Falta GOOGLE_MAPS_API_KEY en el entorno."); process.exit(1); }

const wp = (lat, lng) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
async function rutas(cuerpo, campos) {
  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": campos },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = datos?.error?.message ?? `HTTP ${r.status}`;
    console.error(`✗ Google respondió: ${m}`);
    if (/not been used|disabled|SERVICE_DISABLED/i.test(m)) console.error("  → Habilita «Routes API» en Google Cloud (APIs y servicios → Biblioteca).");
    if (/API key not valid|API_KEY_INVALID/i.test(m)) console.error("  → La clave no es válida: cópiala de nuevo desde Credenciales.");
    if (/billing/i.test(m)) console.error("  → El proyecto necesita una cuenta de facturación activa.");
    if (/referer|referrer|ip address|android|ios/i.test(m)) console.error("  → La clave de servidor no debe tener restricción de sitio web, app ni IP; solo «Restringir clave → Routes API».");
    process.exit(1);
  }
  return datos;
}

const colegio = wp(-33.4565, -70.5978), casa = wp(-33.4495, -70.556);
const a = await rutas({ origin: colegio, destination: casa, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" },
  "routes.duration,routes.distanceMeters");
const r0 = a.routes?.[0];
console.log(`✓ ETA con tráfico: ${Math.round(parseFloat(r0.duration) / 60)} min, ${(r0.distanceMeters / 1000).toFixed(1)} km (colegio → casa de prueba).`);

const b = await rutas({
  origin: colegio, destination: wp(-33.426, -70.61),
  intermediates: [wp(-33.418, -70.554), wp(-33.456, -70.59), wp(-33.442, -70.575)],
  travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", optimizeWaypointOrder: true,
}, "routes.distanceMeters,routes.optimizedIntermediateWaypointIndex");
console.log(`✓ Ruta recomendada por Google: orden ${JSON.stringify(b.routes?.[0]?.optimizedIntermediateWaypointIndex)}, ${(b.routes[0].distanceMeters / 1000).toFixed(1)} km.`);
console.log("La clave sirve para el ETA, la ruta por calles y la ruta recomendada.");
