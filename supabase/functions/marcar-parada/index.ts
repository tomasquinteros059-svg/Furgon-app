// POST /functions/v1/marcar-parada  { parada_id, estado: "entregado" | "ausente" | "pendiente" }
// El conductor marca con un toque; el apoderado recibe la confirmación por push.

import { horaChile, mensajeEstadoParada, type TipoRecorrido } from "../_shared/core/mensajes.ts";
import { clienteServicio, clienteUsuario, CORS, error, json } from "../_shared/http.ts";
import { notificarApoderados } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");

  const { parada_id, estado } = await req.json().catch(() => ({})) as { parada_id?: string; estado?: string };
  if (!parada_id || !["entregado", "ausente", "pendiente"].includes(estado ?? "")) {
    return error(400, "datos", "Faltan datos válidos");
  }

  // La RPC valida (con auth.uid()) que la parada pertenece a un recorrido activo del conductor.
  const { data, error: err } = await clienteUsuario(req).rpc("marcar_parada", { p_parada: parada_id, p_estado: estado });
  if (err) return error(err.code === "42501" ? 403 : 400, "rpc", err.message);

  const info = data as { recorrido_id: string; alumno_id: string; nombre: string; tipo: TipoRecorrido };
  let notificados = 0;
  if (estado === "entregado" || estado === "ausente") {
    const textos = mensajeEstadoParada({ tipo: info.tipo, nombreAlumno: info.nombre, estado, hora: horaChile(new Date()) });
    try {
      notificados = await notificarApoderados(clienteServicio(), info.alumno_id, {
        tipo: estado,
        titulo: textos.titulo,
        cuerpo: textos.cuerpo,
        recorridoAlumnoId: parada_id,
        data: { recorridoId: info.recorrido_id, alumnoId: info.alumno_id },
      });
    } catch (e) {
      console.error("push de entrega falló", e);
    }
  }
  return json({ ok: true, notificados });
});
