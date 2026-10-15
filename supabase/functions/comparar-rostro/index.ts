// POST /functions/v1/comparar-rostro  { licencia_id }
// Compara la foto de la cara de la tía con la foto de su licencia (AWS Rekognition CompareFaces) y
// guarda el resultado para que la empresa lo vea al aprobarla. Sin claves de AWS queda
// «sin_servicio»: la empresa compara las dos fotos a simple vista en el panel.

import { firmarAws, leerCompareFaces } from "../_shared/core/aws.ts";
import { clienteServicio, clienteUsuario, CORS, error, json } from "../_shared/http.ts";

const leer = (n: string) => { const v = Deno.env.get(n)?.trim(); return v ? v : undefined; };

function aBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return error(405, "metodo", "Usa POST");
  const { licencia_id } = await req.json().catch(() => ({})) as { licencia_id?: string };
  if (!licencia_id) return error(400, "datos", "Faltan datos válidos");

  // Con el cliente del usuario: RLS deja ver solo la licencia propia (o, a la empresa, las suyas).
  const { data: lic, error: err } = await clienteUsuario(req).from("licencias")
    .select("id, foto_frente, foto_rostro").eq("id", licencia_id).maybeSingle();
  if (err || !lic) return error(404, "licencia", "Licencia no encontrada");
  if (!lic.foto_rostro || !lic.foto_frente) return error(400, "fotos", "Falta la foto de tu cara");

  const sb = clienteServicio();
  const guardar = (resultado: string, similitud: number | null) =>
    sb.rpc("guardar_comparacion_rostro", { p_licencia: lic.id, p_resultado: resultado, p_similitud: similitud });

  const accessKeyId = leer("AWS_ACCESS_KEY_ID"), secretAccessKey = leer("AWS_SECRET_ACCESS_KEY");
  if (!accessKeyId || !secretAccessKey) {
    await guardar("sin_servicio", null);
    return json({ resultado: "sin_servicio", similitud: null });
  }

  const [cara, licencia] = await Promise.all([lic.foto_rostro, lic.foto_frente].map((ruta) => sb.storage.from("licencias").download(ruta)));
  if (cara.error || licencia.error || !cara.data || !licencia.data) {
    await guardar("error", null);
    return error(500, "fotos", "No se pudieron leer las fotos");
  }

  const region = leer("AWS_REGION") ?? "us-east-1";
  const url = `https://rekognition.${region}.amazonaws.com/`;
  const cuerpo = JSON.stringify({
    SourceImage: { Bytes: aBase64(new Uint8Array(await cara.data.arrayBuffer())) },
    TargetImage: { Bytes: aBase64(new Uint8Array(await licencia.data.arrayBuffer())) },
    SimilarityThreshold: 0,
    QualityFilter: "AUTO",
  });
  const fecha = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const encabezados = await firmarAws({
    metodo: "POST", url, servicio: "rekognition", cred: { accessKeyId, secretAccessKey, region }, cuerpo, fecha,
    encabezados: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "RekognitionService.CompareFaces" },
  });
  try {
    const resp = await fetch(url, { method: "POST", headers: encabezados, body: cuerpo, signal: AbortSignal.timeout(15_000) });
    const r = leerCompareFaces(resp.ok, await resp.json().catch(() => null));
    if (r.detalle) console.warn("comparar-rostro:", r.detalle);
    await guardar(r.resultado, r.similitud);
    return json({ resultado: r.resultado, similitud: r.similitud });
  } catch (e) {
    console.error("comparar-rostro falló", e);
    await guardar("error", null);
    return error(502, "rekognition", "No se pudo comparar ahora");
  }
});
