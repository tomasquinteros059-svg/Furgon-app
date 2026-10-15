// POST /functions/v1/marcar-parada  { parada_id, estado: "entregado" | "ausente" | "pendiente" }
// El conductor marca con un toque; el apoderado recibe la confirmación por push.
// También { recorrido_id, destino_id, deshacer? }: llegó al colegio (ida) o salió de él (vuelta).

import { horaChile, mensajeColegio, mensajeEstadoParada, type TipoRecorrido } from "../_shared/core/mensajes.ts";
import { clienteServicio, clienteUsuario, CORS, error, json } from "../_shared/http.ts";
import { notificarApoderados } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");

  const cuerpo = await req.json().catch(() => ({})) as { parada_id?: string; estado?: string; recorrido_id?: string; destino_id?: string; deshacer?: boolean };
  if (cuerpo.destino_id) return await llegadaAlColegio(req, cuerpo.recorrido_id, cuerpo.destino_id, !!cuerpo.deshacer);
  const { parada_id, estado } = cuerpo;
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
        porIdioma: (idioma) => mensajeEstadoParada({ tipo: info.tipo, nombreAlumno: info.nombre, estado, hora: horaChile(new Date()), idioma }),
        recorridoAlumnoId: parada_id,
        data: { recorridoId: info.recorrido_id, alumnoId: info.alumno_id },
      });
    } catch (e) {
      console.error("push de entrega falló", e);
    }
  }
  return json({ ok: true, notificados });
});

/** La tía marca el colegio: se avisa a las familias de los niños de ese colegio (una sola vez). */
async function llegadaAlColegio(req: Request, recorridoId: string | undefined, destinoId: string, deshacer: boolean): Promise<Response> {
  if (!recorridoId) return error(400, "datos", "Faltan datos válidos");
  const { data, error: err } = await clienteUsuario(req).rpc("llegar_a_destino", { p_recorrido: recorridoId, p_destino: destinoId, p_deshacer: deshacer });
  if (err) return error(err.code === "42501" ? 403 : 400, "rpc", err.message);
  const info = data as { tipo: TipoRecorrido; destino: string; alumnos: { alumno_id: string; nombre: string; parada_id: string }[] };
  const hora = horaChile(new Date());
  const sb = clienteServicio();
  const resultados = await Promise.allSettled(info.alumnos.map((a) => {
    const textos = mensajeColegio({ tipo: info.tipo, nombreAlumno: a.nombre, colegio: info.destino, hora });
    return notificarApoderados(sb, a.alumno_id, {
      tipo: "colegio",
      titulo: textos.titulo,
      cuerpo: textos.cuerpo,
      porIdioma: (idioma) => mensajeColegio({ tipo: info.tipo, nombreAlumno: a.nombre, colegio: info.destino, hora, idioma }),
      recorridoAlumnoId: a.parada_id,
      data: { recorridoId, alumnoId: a.alumno_id },
    });
  }));
  for (const r of resultados) if (r.status === "rejected") console.error("push de colegio falló", r.reason);
  const notificados = resultados.reduce((s, r) => s + (r.status === "fulfilled" ? r.value : 0), 0);
  return json({ ok: true, notificados });
}
