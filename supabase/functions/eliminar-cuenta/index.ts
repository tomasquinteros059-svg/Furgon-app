// POST /functions/v1/eliminar-cuenta  { confirmar: "ELIMINAR" }
// Elimina la cuenta de quien llama (lo exigen Apple y Google): borra sus datos con
// eliminar_datos_de_cuenta(), las fotos de su licencia y, al final, el usuario de auth.

import { clienteServicio, CORS, error, json, usuarioDeLaPeticion } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");

  const sb = clienteServicio();
  const usuario = await usuarioDeLaPeticion(req, sb);
  if (!usuario) return error(401, "sin_sesion", "Inicia sesión nuevamente");

  const { confirmar } = await req.json().catch(() => ({})) as { confirmar?: string };
  if (confirmar !== "ELIMINAR") return error(400, "sin_confirmar", "Falta confirmar la eliminación");

  const { data: fotos, error: e1 } = await sb.rpc("eliminar_datos_de_cuenta", { p_usuario: usuario.id });
  if (e1) return error(500, "datos", "No pudimos eliminar tus datos. Intenta de nuevo.");

  if (Array.isArray(fotos) && fotos.length) {
    const { error: e2 } = await sb.storage.from("licencias").remove(fotos as string[]);
    if (e2) console.error("eliminar-cuenta: fotos de licencia", e2.message);
  }

  const { error: e3 } = await sb.auth.admin.deleteUser(usuario.id);
  if (e3) return error(500, "usuario", "No pudimos eliminar tu cuenta. Intenta de nuevo.");
  return json({ ok: true });
});
