// POST /functions/v1/posiciones
// El teléfono del conductor envía lotes de posiciones (incluida la cola acumulada
// sin señal). Aquí se guardan y se evalúa si corresponde disparar avisos.
//
// Cuerpo: { recorrido_id, posiciones: [{ client_id, ts, lat, lng, precision_m?, velocidad_ms?, rumbo? }] }
// Respuestas: 200 ok · 401 sin sesión · 403 no es su recorrido · 409 recorrido no activo (el teléfono detiene el GPS)

import { evaluarPosicion } from "../_shared/core/flujo-aviso.ts";
import type { CacheEta } from "../_shared/core/disparo.ts";
import { esCoordenadaValida } from "../_shared/core/geo.ts";
import { enSegundoPlano } from "../_shared/entorno.ts";
import { clienteServicio, CORS, error, json, usuarioDeLaPeticion } from "../_shared/http.ts";
import { cargarParadasPendientes, crearDepsFlujo } from "../_shared/servicio-aviso.ts";
import { despacharLlamadasVencidas } from "../_shared/servicio-llamadas.ts";

interface PosicionEntrada {
  client_id: string;
  ts: number;
  lat: number;
  lng: number;
  precision_m?: number | null;
  velocidad_ms?: number | null;
  rumbo?: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POR_LOTE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");

  const sb = clienteServicio();
  const usuario = await usuarioDeLaPeticion(req, sb);
  if (!usuario) return error(401, "sin_sesion", "Inicia sesión nuevamente");

  let cuerpo: { recorrido_id?: string; posiciones?: PosicionEntrada[] };
  try {
    cuerpo = await req.json();
  } catch {
    return error(400, "json", "Cuerpo inválido");
  }
  const recorridoId = cuerpo.recorrido_id ?? "";
  const posiciones = (cuerpo.posiciones ?? []).filter((p) =>
    UUID.test(p.client_id) && Number.isFinite(p.ts) && esCoordenadaValida({ lat: p.lat, lng: p.lng })
  ).slice(0, MAX_POR_LOTE);
  if (!UUID.test(recorridoId) || posiciones.length === 0) return error(400, "datos", "Faltan datos válidos");

  const { data: recorrido } = await sb
    .from("recorridos")
    .select("id, conductor_id, estado, tipo, eta_cache")
    .eq("id", recorridoId)
    .maybeSingle();
  if (!recorrido || recorrido.conductor_id !== usuario.id) return error(403, "no_autorizado", "No es tu recorrido");
  if (recorrido.estado !== "activo") return error(409, "recorrido_no_activo", "El recorrido ya terminó");

  const { data: insertadas, error: errIns } = await sb.rpc("registrar_posiciones", {
    p_recorrido: recorridoId,
    p_posiciones: posiciones,
  });
  if (errIns) return error(500, "db", errIns.message);

  // Solo la posición más reciente sirve para decidir; las antiguas quedan en el historial.
  const ultima = posiciones.reduce((a, b) => (b.ts > a.ts ? b : a));
  const paradas = await cargarParadasPendientes(sb, recorridoId);
  const resultado = await evaluarPosicion(crearDepsFlujo(sb, recorrido, paradas), {
    recorridoId,
    posicion: { lat: ultima.lat, lng: ultima.lng, registradaEnMs: ultima.ts },
    paradas,
    cache: (recorrido.eta_cache as CacheEta | null) ?? null,
  });

  // Respaldo de los reintentos de llamada programados (ver servicio-llamadas.ts).
  enSegundoPlano(despacharLlamadasVencidas(sb));

  return json({
    insertadas,
    evaluada: resultado.vigente,
    fuente: resultado.fuente,
    avisos_disparados: resultado.avisosCreados.length,
    etas: paradas.map((p, i) => ({ parada_id: p.id, eta_seg: Math.round(resultado.etasSeg[i] ?? -1) })),
  });
});
