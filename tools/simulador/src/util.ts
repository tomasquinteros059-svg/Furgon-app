import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_SIMULADOR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ARCHIVO_DEMO = join(RAIZ_SIMULADOR, ".demo.json");

/** Carga tools/simulador/.env si existe (Node 22: process.loadEnvFile). */
export function cargarEnv(): void {
  const archivo = join(RAIZ_SIMULADOR, ".env");
  if (existsSync(archivo)) process.loadEnvFile(archivo);
}

export function requerida(nombre: string): string {
  const v = process.env[nombre]?.trim();
  if (!v) {
    console.error(`❌ Falta la variable ${nombre}. Copia tools/simulador/.env.example a tools/simulador/.env y complétala.`);
    process.exit(1);
  }
  return v;
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function mmss(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function hhmmss(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  return `${String(h).padStart(2, "0")}:${mmss(s - h * 3600).padStart(5, "0")}`;
}
