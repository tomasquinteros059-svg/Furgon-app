// Foto de perfil redonda (bucket privado «fotos-perfil», con enlace firmado por una hora) o, si no
// hay foto, las iniciales sobre amarillo.
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Text } from "./icono";
import { colores } from "./ui";

const enlaces = new Map<string, { url: string; vence: number }>();

export async function urlFoto(ruta: string): Promise<string | null> {
  const guardado = enlaces.get(ruta);
  if (guardado && guardado.vence > Date.now()) return guardado.url;
  const { data } = await supabase.storage.from("fotos-perfil").createSignedUrl(ruta, 3600);
  if (!data?.signedUrl) return null;
  enlaces.set(ruta, { url: data.signedUrl, vence: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

const iniciales = (nombre: string, letras: number) =>
  nombre.trim().split(/\s+/).slice(0, letras).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

/** `uri` sirve para mostrar una foto recién elegida antes de subirla. */
export function Avatar({ nombre, foto, uri, tam = 40, letras = 2 }: { nombre: string; foto?: string | null; uri?: string | null; tam?: number; letras?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setUrl(null);
    if (foto && !uri) urlFoto(foto).then((u) => { if (vivo) setUrl(u); });
    return () => { vivo = false; };
  }, [foto, uri]);
  const fuente = uri ?? url;
  const estilo = { width: tam, height: tam, borderRadius: tam / 2 };
  return fuente ? (
    <Image source={{ uri: fuente }} style={[estilo, { backgroundColor: colores.superficie2 }]} accessibilityLabel={nombre} />
  ) : (
    <View style={[estilo, { backgroundColor: colores.amarillo, borderWidth: 3, borderColor: colores.borde, alignItems: "center", justifyContent: "center" }]} accessibilityLabel={nombre}>
      <Text style={{ color: colores.sobreAmarillo, fontWeight: "700", fontSize: tam * (letras === 1 ? 0.42 : 0.36) }}>{iniciales(nombre, letras)}</Text>
    </View>
  );
}
