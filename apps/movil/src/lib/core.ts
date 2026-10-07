// Lógica compartida con el backend (misma fuente que usan las Edge Functions y los tests).
export { type AlmacenCola, type PosicionGps, type ResultadoEnvio, vaciarCola } from "../../../../supabase/functions/_shared/core/cola.ts";
export { formatearTelefono, normalizarTelefono } from "../../../../supabase/functions/_shared/core/telefono.ts";
export { decodificarPolilinea } from "../../../../supabase/functions/_shared/core/polilinea.ts";
