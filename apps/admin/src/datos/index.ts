import { crearDatosDemo } from "./demo";
import { crearDatosSupabase } from "./supabase";
import type { Datos } from "./tipos";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const forzarDemo = import.meta.env.VITE_MODO_DEMO === "1";

/** Sin credenciales de Supabase (o en el build de demostración) se usan datos de ejemplo. */
export const datos: Datos = !forzarDemo && url && anon ? crearDatosSupabase(url, anon) : crearDatosDemo();
export * from "./tipos";
