// Conexiones familia ↔ tía/tío (ver supabase/migrations/20261012000001_a_bordo_y_conexiones.sql).
import { supabase } from "./supabase";

export interface Conexion {
  id: string;
  estado: "pendiente" | "aceptada";
  iniciada_por: "apoderado" | "conductor";
  mensaje: string | null;
  creado_en: string;
  otro_id: string;
  otro_nombre: string;
  empresa: string | null;
  comunas: string | null;
  hijos: string[] | null;
}

export async function misConexiones(): Promise<Conexion[]> {
  const { data, error } = await supabase.rpc("mis_conexiones");
  if (error) throw error;
  return (data as Conexion[]) ?? [];
}

