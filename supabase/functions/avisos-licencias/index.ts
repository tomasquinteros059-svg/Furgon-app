// POST /functions/v1/avisos-licencias  (header: x-cron-secret: $CRON_SECRET)
// Una vez al día: avisa a cada tía o tío cuya licencia vence en 60, 30, 15, 7 o 1 días,
// o que ya venció. Cada umbral se avisa una sola vez (tabla avisos_licencia).
// El administrador ve lo mismo en el panel web (Furgones y Panel).

import { mensajeVencimientoLicencia } from "../_shared/core/mensajes.ts";
import { entorno } from "../_shared/entorno.ts";
import { clienteServicio, error, json } from "../_shared/http.ts";
import { notificarPerfil } from "../_shared/push.ts";

Deno.serve(async (req) => {
  const secreto = entorno.cronSecret();
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) return error(401, "no_autorizado", "Secreto inválido");
  const sb = clienteServicio();
  const { data, error: e } = await sb.rpc("licencias_para_avisar");
  if (e) return error(500, "consulta", e.message);
  let enviados = 0;
  for (const l of (data ?? []) as { conductor_id: string; conductor: string; vence_en: string; dias: number }[]) {
    const m = mensajeVencimientoLicencia({ nombre: l.conductor, dias: l.dias, venceEn: l.vence_en });
    enviados += await notificarPerfil(sb, l.conductor_id, {
      tipo: "licencia", titulo: m.titulo, cuerpo: m.cuerpo, data: { pantalla: "licencia" },
      porIdioma: (idioma) => mensajeVencimientoLicencia({ nombre: l.conductor, dias: l.dias, venceEn: l.vence_en, idioma }),
    });
  }
  return json({ licencias: (data ?? []).length, enviados });
});
