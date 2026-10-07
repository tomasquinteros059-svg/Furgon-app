// Webhooks de Twilio Voice (sin JWT; se valida X-Twilio-Signature).
//   ?accion=voz&llamada=ID        → TwiML con el mensaje y "presione 1 para confirmar"
//   ?accion=confirmar&llamada=ID  → resultado de la tecla presionada
//   ?accion=estado&llamada=ID     → StatusCallback: fin de la llamada → siguiente paso de la escalera

import { resultadoDesdeTwilio } from "../_shared/core/llamadas.ts";
import { mensajeAviso, type TipoRecorrido } from "../_shared/core/mensajes.ts";
import { twimlAviso, twimlRespuestaConfirmacion, validarFirmaTwilio } from "../_shared/core/twilio.ts";
import { entorno } from "../_shared/entorno.ts";
import { clienteServicio } from "../_shared/http.ts";
import { despacharLlamadasVencidas, programarSiguienteLlamada } from "../_shared/servicio-llamadas.ts";

const xml = (cuerpo: string) => new Response(cuerpo, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
const VACIO = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const params = Object.fromEntries(new URLSearchParams(await req.text()));

  // La firma se calcula sobre la URL pública exacta que Twilio invocó.
  const urlPublica = `${entorno.funcionesUrlPublica()}/twilio-webhook${url.search}`;
  const firmaOk = await validarFirmaTwilio(
    entorno.twilioAuthToken(), req.headers.get("X-Twilio-Signature"), urlPublica, params,
  );
  if (!firmaOk) return new Response("firma inválida", { status: 403 });

  const accion = url.searchParams.get("accion");
  const llamadaId = url.searchParams.get("llamada") ?? "";
  const sb = clienteServicio();
  const voz = entorno.twilioVoz();

  const { data: llamada } = await sb
    .from("llamadas")
    .select("id, aviso_id, estado, avisos!inner(eta_seg, motivo, alumnos!inner(nombre), recorridos!inner(tipo))")
    .eq("id", llamadaId)
    .maybeSingle();
  if (!llamada) return accion === "estado" ? new Response(null, { status: 204 }) : xml(VACIO);

  if (accion === "voz") {
    const aviso = llamada.avisos as unknown as {
      eta_seg: number | null; motivo: string; alumnos: { nombre: string }; recorridos: { tipo: TipoRecorrido };
    };
    const { voz: texto } = mensajeAviso({
      tipo: aviso.recorridos.tipo,
      nombreAlumno: aviso.alumnos.nombre,
      etaSeg: aviso.eta_seg ?? 300,
      motivo: aviso.motivo,
    });
    const urlConfirmar = `${entorno.funcionesUrlPublica()}/twilio-webhook?accion=confirmar&llamada=${llamada.id}`;
    return xml(twimlAviso(texto, urlConfirmar, voz));
  }

  if (accion === "confirmar") {
    const confirmada = params.Digits === "1";
    if (confirmada) {
      const ahora = new Date().toISOString();
      await sb.from("llamadas").update({ estado: "confirmada", finalizada_en: ahora }).eq("id", llamada.id);
      await sb.from("avisos").update({ confirmado_en: ahora }).eq("id", llamada.aviso_id).is("confirmado_en", null);
      await sb.from("llamadas").update({ estado: "cancelada", finalizada_en: ahora })
        .eq("aviso_id", llamada.aviso_id).eq("estado", "programada");
    }
    return xml(twimlRespuestaConfirmacion(confirmada, voz));
  }

  if (accion === "estado") {
    const resultado = resultadoDesdeTwilio(params.CallStatus ?? "", llamada.estado === "confirmada");
    if (resultado === null) return new Response(null, { status: 204 });
    if (llamada.estado !== "confirmada") {
      await sb.from("llamadas").update({
        estado: resultado,
        finalizada_en: new Date().toISOString(),
        duracion_seg: params.CallDuration ? Number(params.CallDuration) : null,
      }).eq("id", llamada.id);
    }
    await programarSiguienteLlamada(sb, llamada.aviso_id);
    await despacharLlamadasVencidas(sb);
    return new Response(null, { status: 204 });
  }

  return new Response("acción desconocida", { status: 400 });
});
