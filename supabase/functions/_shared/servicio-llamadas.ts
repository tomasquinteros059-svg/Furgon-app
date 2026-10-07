// Llamadas automáticas con Twilio Voice (Fase 2).
//
// La lógica de la escalera vive en core/llamadas.ts (con tests). Aquí solo se
// persiste cada intento en la tabla `llamadas` y se habla con la API de Twilio.

import type { SupabaseClient } from "@supabase/supabase-js";
import { type IntentoLlamada, type PasoLlamada, type ResultadoLlamada, siguienteLlamada } from "./core/llamadas.ts";
import { enSegundoPlano, entorno } from "./entorno.ts";

const RESULTADOS: ReadonlySet<string> = new Set<ResultadoLlamada>([
  "confirmada", "sin_confirmar", "no_contesto", "ocupado", "fallida", "cancelada",
]);

/** Calcula y persiste el próximo intento de la escalera para un aviso. */
export async function programarSiguienteLlamada(sb: SupabaseClient, avisoId: string): Promise<PasoLlamada> {
  const { data: aviso, error } = await sb
    .from("avisos")
    .select("id, alumno_id, confirmado_en, recorrido_alumnos!inner(estado), recorridos!inner(estado)")
    .eq("id", avisoId)
    .single();
  if (error) throw error;

  const parada = aviso.recorrido_alumnos as unknown as { estado: string };
  const recorrido = aviso.recorridos as unknown as { estado: string };
  const detener = aviso.confirmado_en !== null || parada.estado !== "pendiente" || recorrido.estado !== "activo";

  const [{ data: contactos }, { data: llamadas }] = await Promise.all([
    sb.from("contactos").select("id, telefono, prioridad").eq("alumno_id", aviso.alumno_id),
    sb.from("llamadas").select("contacto_id, estado, intento").eq("aviso_id", avisoId).order("intento"),
  ]);

  const intentos: IntentoLlamada[] = (llamadas ?? []).map((l) => ({
    contactoId: l.contacto_id ?? "",
    resultado: RESULTADOS.has(l.estado) ? (l.estado as ResultadoLlamada) : null,
  }));
  const paso = siguienteLlamada({ contactos: contactos ?? [], intentos, detener });

  if (paso.tipo === "llamar") {
    // UNIQUE(aviso_id, intento): si dos callbacks compiten, solo uno inserta.
    await sb.from("llamadas").upsert({
      aviso_id: avisoId,
      contacto_id: paso.contactoId,
      telefono: paso.telefono,
      intento: paso.intento,
      programada_para: new Date(Date.now() + paso.esperaSeg * 1000).toISOString(),
    }, { onConflict: "aviso_id,intento", ignoreDuplicates: true });

    if (paso.esperaSeg === 0) {
      await despacharLlamadasVencidas(sb);
    } else {
      // Despacho diferido. Respaldo: cada lote de posiciones y procesar-llamadas
      // también despachan las llamadas vencidas.
      enSegundoPlano(esperar(paso.esperaSeg * 1000).then(() => despacharLlamadasVencidas(sb)));
    }
  }
  return paso;
}

/** Toma las llamadas programadas vencidas (de forma atómica) y las inicia en Twilio. */
export async function despacharLlamadasVencidas(sb: SupabaseClient): Promise<number> {
  if (!entorno.llamadasHabilitadas()) return 0;
  const { data: llamadas, error } = await sb.rpc("reclamar_llamadas", { p_limite: 20 });
  if (error) throw error;

  let iniciadas = 0;
  for (const llamada of (llamadas ?? []) as { id: string; aviso_id: string; telefono: string }[]) {
    try {
      const sid = await crearLlamadaTwilio(llamada.id, llamada.telefono);
      await sb.from("llamadas").update({ twilio_sid: sid }).eq("id", llamada.id);
      iniciadas++;
    } catch (e) {
      await sb.from("llamadas").update({
        estado: "fallida",
        finalizada_en: new Date().toISOString(),
        error: e instanceof Error ? e.message.slice(0, 500) : String(e),
      }).eq("id", llamada.id);
      await programarSiguienteLlamada(sb, llamada.aviso_id);
    }
  }
  return iniciadas;
}

async function crearLlamadaTwilio(llamadaId: string, telefono: string): Promise<string> {
  const sid = entorno.twilioAccountSid();
  const base = `${entorno.funcionesUrlPublica()}/twilio-webhook`;
  const form = new URLSearchParams({
    To: telefono,
    From: entorno.twilioNumeroOrigen(),
    Url: `${base}?accion=voz&llamada=${llamadaId}`,
    Method: "POST",
    StatusCallback: `${base}?accion=estado&llamada=${llamadaId}`,
    StatusCallbackMethod: "POST",
    // Segundos que suena antes de considerarse "no contestó".
    Timeout: "25",
  });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${entorno.twilioAuthToken()}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const datos = await resp.json() as { sid?: string; message?: string };
  if (!resp.ok || !datos.sid) throw new Error(`Twilio HTTP ${resp.status}: ${datos.message ?? "sin detalle"}`);
  return datos.sid;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
