import { Share } from "react-native";
import { t } from "./idioma";
import { supabase } from "./supabase";

/** Mensaje para que la familia se registre con su código y quede ligada al alumno. */
export async function compartirCodigo(alumnoId: string, nombre: string): Promise<void> {
  const { data, error } = await supabase.rpc("codigo_familia", { p_alumno: alumnoId });
  if (error) throw error;
  await Share.share({
    message: t("Hola. Para recibir los avisos del furgón de {nombre}:\n1) Descarga la app «Furgón Escolar».\n2) Toca «Crear cuenta» y escribe este código: {codigo}\n¡Listo! Te avisaremos unos 5 minutos antes de que llegue el furgón.", { nombre, codigo: String(data) }),
  });
}
