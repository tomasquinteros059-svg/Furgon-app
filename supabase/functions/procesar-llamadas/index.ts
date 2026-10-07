// POST /functions/v1/procesar-llamadas  (header: x-cron-secret: $CRON_SECRET)
// Despacha reintentos de llamada vencidos. Es un respaldo: normalmente los despachan
// el StatusCallback de Twilio y cada lote de posiciones. Pensado para pg_cron + pg_net
// o cualquier scheduler externo (ver README).

import { entorno } from "../_shared/entorno.ts";
import { clienteServicio, error, json } from "../_shared/http.ts";
import { despacharLlamadasVencidas, vencerLlamadasApp } from "../_shared/servicio-llamadas.ts";

Deno.serve(async (req) => {
  const secreto = entorno.cronSecret();
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) return error(401, "no_autorizado", "Secreto inválido");
  const sb = clienteServicio();
  const vencidas = await vencerLlamadasApp(sb);
  const iniciadas = await despacharLlamadasVencidas(sb);
  return json({ vencidas, iniciadas });
});
