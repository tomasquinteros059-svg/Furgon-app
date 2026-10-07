// POST /functions/v1/llamada-app  { llamada_id, accion: "acuse" | "confirmar" | "rechazar" }
// La app del apoderado informa sobre la llamada gratis por internet:
//   acuse     → el teléfono la recibió (tiene internet): ya no se pasa al teléfono con costo.
//   confirmar → presionó "1 · Confirmar": fin de la escalera.
//   rechazar  → colgó / "No puedo": cuenta como no contestada y sigue la escalera.

import { clienteServicio, CORS, error, json, usuarioDeLaPeticion } from "../_shared/http.ts";
import { terminarLlamadaApp } from "../_shared/servicio-llamadas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");

  const sb = clienteServicio();
  const usuario = await usuarioDeLaPeticion(req, sb);
  if (!usuario) return error(401, "sin_sesion", "Inicia sesión nuevamente");

  const { llamada_id, accion } = await req.json().catch(() => ({})) as { llamada_id?: string; accion?: string };
  if (!llamada_id || !["acuse", "confirmar", "rechazar"].includes(accion ?? "")) return error(400, "datos", "Faltan datos válidos");

  const { data: llamada } = await sb
    .from("llamadas")
    .select("id, aviso_id, canal, estado, acuse_en, avisos!inner(alumno_id)")
    .eq("id", llamada_id)
    .maybeSingle();
  if (!llamada || llamada.canal !== "app") return error(404, "no_existe", "Llamada no encontrada");

  // Solo un apoderado del alumno puede responder.
  const alumnoId = (llamada.avisos as unknown as { alumno_id: string }).alumno_id;
  const { data: vinculo } = await sb.from("apoderado_alumno").select("alumno_id")
    .eq("apoderado_id", usuario.id).eq("alumno_id", alumnoId).maybeSingle();
  if (!vinculo) return error(403, "no_autorizado", "No autorizado");

  if (llamada.estado !== "en_curso") return json({ ok: true, estado: llamada.estado });

  if (accion === "acuse") {
    if (!llamada.acuse_en) {
      await sb.from("llamadas").update({ acuse_en: new Date().toISOString() }).eq("id", llamada.id).is("acuse_en", null);
    }
    return json({ ok: true, estado: "en_curso" });
  }
  const resultado = accion === "confirmar" ? "confirmada" : "no_contesto";
  await terminarLlamadaApp(sb, llamada.id, resultado, llamada.aviso_id);
  return json({ ok: true, estado: resultado });
});
