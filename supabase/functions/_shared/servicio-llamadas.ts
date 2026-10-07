// Llamadas automáticas (Fase 2): primero gratis por la app, con costo (Twilio) si no hay internet.
//
// La lógica de la escalera vive en core/llamadas.ts (con tests). Aquí solo se
// persiste cada intento en la tabla `llamadas`, se envía la llamada por la app
// (push de alta prioridad) o se habla con la API de Twilio, y se vencen las
// llamadas por la app que no tuvieron acuse o respuesta.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIG_LLAMADAS_POR_DEFECTO,
  type CanalLlamada,
  type IntentoLlamada,
  type PasoLlamada,
  type ResultadoLlamada,
  siguienteLlamada,
  vencimientoLlamadaApp,
} from "./core/llamadas.ts";
import { mensajeAviso, type TipoRecorrido } from "./core/mensajes.ts";
import { enSegundoPlano, entorno } from "./entorno.ts";
import { enviarLlamadaApp } from "./push.ts";

const RESULTADOS: ReadonlySet<string> = new Set<ResultadoLlamada>([
  "confirmada", "sin_confirmar", "no_contesto", "ocupado", "fallida", "cancelada", "sin_internet",
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
    sb.rpc("contactos_llamada", { p_alumno: aviso.alumno_id }),
    sb.from("llamadas").select("contacto_id, estado, intento, canal").eq("aviso_id", avisoId).order("intento"),
  ]);

  const intentos: IntentoLlamada[] = (llamadas ?? []).map((l) => ({
    contactoId: l.contacto_id ?? "",
    canal: l.canal as CanalLlamada,
    resultado: RESULTADOS.has(l.estado) ? (l.estado as ResultadoLlamada) : null,
  }));
  const paso = siguienteLlamada({
    contactos: ((contactos ?? []) as { id: string; telefono: string; prioridad: number; tiene_app: boolean }[])
      .map((c) => ({ id: c.id, telefono: c.telefono, prioridad: c.prioridad, tieneApp: c.tiene_app })),
    intentos,
    detener,
  });

  if (paso.tipo === "llamar") {
    // UNIQUE(aviso_id, intento): si dos callbacks compiten, solo uno inserta.
    await sb.from("llamadas").upsert({
      aviso_id: avisoId,
      contacto_id: paso.contactoId,
      telefono: paso.telefono,
      intento: paso.intento,
      canal: paso.canal,
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

/** Toma las llamadas programadas vencidas (de forma atómica) y las inicia por su canal. */
export async function despacharLlamadasVencidas(sb: SupabaseClient): Promise<number> {
  if (!entorno.llamadasHabilitadas()) return 0;
  const { data: llamadas, error } = await sb.rpc("reclamar_llamadas", { p_limite: 20 });
  if (error) throw error;

  let iniciadas = 0;
  for (const llamada of (llamadas ?? []) as { id: string; aviso_id: string; telefono: string; canal: CanalLlamada; contacto_id: string | null }[]) {
    try {
      if (llamada.canal === "app") {
        const entregadas = await iniciarLlamadaApp(sb, llamada);
        if (entregadas === 0) {
          // Nadie a quién enviarla (sin dispositivos o push rechazada): se pasa al teléfono.
          await terminarLlamadaApp(sb, llamada.id, "sin_internet", llamada.aviso_id);
          continue;
        }
        // Vence sola si no hay acuse (sin internet) o nadie contesta.
        const cfg = CONFIG_LLAMADAS_POR_DEFECTO;
        enSegundoPlano(esperar(cfg.esperaAcuseAppSeg * 1000 + 500).then(() => vencerLlamadasApp(sb)));
        enSegundoPlano(esperar((cfg.esperaAcuseAppSeg + cfg.timbreAppSeg) * 1000 + 500).then(() => vencerLlamadasApp(sb)));
      } else {
        const sid = await crearLlamadaTwilio(llamada.id, llamada.telefono);
        await sb.from("llamadas").update({ twilio_sid: sid }).eq("id", llamada.id);
      }
      iniciadas++;
    } catch (e) {
      await sb.from("llamadas").update({
        estado: llamada.canal === "app" ? "sin_internet" : "fallida",
        finalizada_en: new Date().toISOString(),
        error: e instanceof Error ? e.message.slice(0, 500) : String(e),
      }).eq("id", llamada.id);
      await programarSiguienteLlamada(sb, llamada.aviso_id);
    }
  }
  return iniciadas;
}

/** Llamada gratis: push de alta prioridad; la app la muestra como llamada y lee el mensaje en voz alta. */
async function iniciarLlamadaApp(sb: SupabaseClient, llamada: { id: string; aviso_id: string; contacto_id: string | null }): Promise<number> {
  if (!llamada.contacto_id) return 0;
  const { data: aviso } = await sb
    .from("avisos")
    .select("alumno_id, eta_seg, motivo, alumnos!inner(nombre), recorridos!inner(tipo)")
    .eq("id", llamada.aviso_id)
    .single();
  if (!aviso) return 0;
  const alumno = aviso.alumnos as unknown as { nombre: string };
  const recorrido = aviso.recorridos as unknown as { tipo: TipoRecorrido };
  const textos = mensajeAviso({ tipo: recorrido.tipo, nombreAlumno: alumno.nombre, etaSeg: aviso.eta_seg ?? 300, motivo: aviso.motivo });
  return enviarLlamadaApp(sb, llamada.contacto_id, {
    tipo: "llamada",
    titulo: "📞 Llamada del furgón escolar",
    cuerpo: textos.cuerpo,
    avisoId: llamada.aviso_id,
    data: { llamadaId: llamada.id, avisoId: llamada.aviso_id, alumnoId: aviso.alumno_id, alumno: alumno.nombre, voz: textos.voz },
  });
}

/**
 * Cierra una llamada por la app con un resultado (solo si sigue en curso) y programa el
 * siguiente paso de la escalera. Devuelve false si otro proceso ya la había cerrado.
 */
export async function terminarLlamadaApp(
  sb: SupabaseClient,
  llamadaId: string,
  resultado: "sin_internet" | "no_contesto" | "confirmada",
  avisoId: string,
): Promise<boolean> {
  const ahora = new Date().toISOString();
  const { data } = await sb.from("llamadas")
    .update({ estado: resultado, finalizada_en: ahora })
    .eq("id", llamadaId).eq("estado", "en_curso")
    .select("id");
  if (!data?.length) return false;
  if (resultado === "confirmada") {
    await sb.from("avisos").update({ confirmado_en: ahora }).eq("id", avisoId).is("confirmado_en", null);
    await sb.from("llamadas").update({ estado: "cancelada", finalizada_en: ahora }).eq("aviso_id", avisoId).eq("estado", "programada");
  } else {
    await programarSiguienteLlamada(sb, avisoId);
  }
  return true;
}

/** Vence las llamadas por la app sin acuse (→ teléfono, con costo) o sin respuesta (→ reintento). */
export async function vencerLlamadasApp(sb: SupabaseClient): Promise<number> {
  if (!entorno.llamadasHabilitadas()) return 0;
  const { data } = await sb.from("llamadas")
    .select("id, aviso_id, iniciada_en, acuse_en")
    .eq("canal", "app").eq("estado", "en_curso");
  let vencidas = 0;
  for (const l of (data ?? []) as { id: string; aviso_id: string; iniciada_en: string | null; acuse_en: string | null }[]) {
    const resultado = vencimientoLlamadaApp({
      iniciadaEnMs: Date.parse(l.iniciada_en ?? new Date().toISOString()),
      acuseEnMs: l.acuse_en ? Date.parse(l.acuse_en) : null,
      ahoraMs: Date.now(),
    });
    if (resultado && await terminarLlamadaApp(sb, l.id, resultado, l.aviso_id)) vencidas++;
  }
  return vencidas;
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
