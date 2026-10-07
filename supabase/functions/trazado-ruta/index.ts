// POST /functions/v1/trazado-ruta  { recorrido_id, lat, lng }
// Ruta por calles (Google Routes API) desde la posición de la conductora pasando por las
// paradas pendientes, para dibujarla en su mapa. { polilinea: string | null }

import { esCoordenadaValida } from "../_shared/core/geo.ts";
import { clienteServicio, CORS, error, json, usuarioDeLaPeticion } from "../_shared/http.ts";
import { trazadoGoogle } from "../_shared/proveedores-eta.ts";
import { cargarParadasPendientes } from "../_shared/servicio-aviso.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = clienteServicio();
  const usuario = await usuarioDeLaPeticion(req, sb);
  if (!usuario) return error(401, "sin_sesion", "Inicia sesión nuevamente");
  const { recorrido_id, lat, lng } = await req.json().catch(() => ({})) as { recorrido_id?: string; lat?: number; lng?: number };
  if (!recorrido_id || !esCoordenadaValida({ lat: Number(lat), lng: Number(lng) })) return error(400, "datos", "Faltan datos válidos");

  const { data: recorrido } = await sb.from("recorridos")
    .select("conductor_id, estado, tipo, rutas(colegio_lat, colegio_lng)").eq("id", recorrido_id).maybeSingle();
  if (!recorrido || recorrido.conductor_id !== usuario.id) return error(403, "no_autorizado", "No es tu recorrido");
  if (recorrido.estado !== "activo") return json({ polilinea: null });

  const paradas = await cargarParadasPendientes(sb, recorrido_id);
  const destinos = paradas.map((p) => p.ubicacion);
  // En la ida, el trazado termina en el colegio.
  const ruta = recorrido.rutas as unknown as { colegio_lat: number | null; colegio_lng: number | null } | null;
  if (recorrido.tipo === "ida" && ruta?.colegio_lat != null && ruta.colegio_lng != null) {
    destinos.push({ lat: ruta.colegio_lat, lng: ruta.colegio_lng });
  }
  try {
    return json({ polilinea: await trazadoGoogle({ lat: Number(lat), lng: Number(lng) }, destinos) });
  } catch (e) {
    console.warn("trazado-ruta", e);
    return json({ polilinea: null });
  }
});
