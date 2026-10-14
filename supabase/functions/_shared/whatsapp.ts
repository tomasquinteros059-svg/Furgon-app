// Envía el aviso por WhatsApp a las familias del alumno que lo activaron en «Mi perfil».
// Nunca lanza: un WhatsApp que falla no debe frenar la alarma ni la llamada.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type Idioma, idiomaValido } from "./core/mensajes.ts";
import { leerRespuestaWhatsapp, pedidoWhatsapp, type ProveedorWhatsapp, proveedorWhatsapp } from "./core/whatsapp.ts";

const leer = (n: string) => { const v = Deno.env.get(n)?.trim(); return v ? v : undefined; };

export function whatsappConfigurado(): ProveedorWhatsapp | null {
  return proveedorWhatsapp(leer);
}

export async function avisarPorWhatsapp(
  sb: SupabaseClient,
  alumnoId: string,
  avisoId: string,
  textoPorIdioma: (idioma: Idioma) => string,
): Promise<number> {
  const proveedor = whatsappConfigurado();
  if (!proveedor) return 0;
  const { data, error } = await sb.from("apoderado_alumno")
    .select("apoderado_id, perfiles!inner(telefono, idioma, aviso_whatsapp)")
    .eq("alumno_id", alumnoId).eq("perfiles.aviso_whatsapp", true).not("perfiles.telefono", "is", null);
  if (error) { console.error("whatsapp: no se pudieron leer las familias", error.message); return 0; }

  let enviados = 0;
  for (const fila of data ?? []) {
    const perfil = fila.perfiles as unknown as { telefono: string; idioma: string | null };
    // Se reserva primero: si la función se reintenta, el mismo aviso no sale dos veces.
    const { data: reserva } = await sb.from("envios_whatsapp")
      .upsert({ aviso_id: avisoId, apoderado_id: fila.apoderado_id, proveedor: proveedor.tipo }, { onConflict: "aviso_id,apoderado_id", ignoreDuplicates: true })
      .select("id").maybeSingle();
    if (!reserva) continue;
    try {
      const idioma = idiomaValido(perfil.idioma);
      const pedido = pedidoWhatsapp(proveedor, perfil.telefono, textoPorIdioma(idioma), idioma);
      const resp = await fetch(pedido.url, { method: "POST", headers: pedido.headers, body: pedido.body, signal: AbortSignal.timeout(10_000) });
      const r = leerRespuestaWhatsapp(proveedor, resp.ok, await resp.json().catch(() => null));
      await sb.from("envios_whatsapp").update(r.error ? { estado: "fallido", error: r.error } : { estado: "enviado", mensaje_id: r.id }).eq("id", reserva.id);
      if (!r.error) enviados++;
      else console.warn("whatsapp: falló el envío", r.error);
    } catch (e) {
      await sb.from("envios_whatsapp").update({ estado: "fallido", error: String(e).slice(0, 300) }).eq("id", reserva.id);
    }
  }
  return enviados;
}
