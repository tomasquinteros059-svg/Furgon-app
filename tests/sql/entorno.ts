// Postgres en memoria (PGlite) con las migraciones reales y utilidades para actuar como un usuario.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRACIONES = join(__dirname, "..", "..", "supabase", "migrations");

export async function crearBaseDeDatos() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const archivo of readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRACIONES, archivo), "utf8"));
  }

  async function como<T>(rol: "authenticated" | "service_role", uid: string | null, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role ${rol}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  }
  const uno = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
  const filas = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  async function crearUsuario(email: string, meta: Record<string, string>): Promise<string> {
    const r = await uno<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)]);
    return r.id;
  }
  /** Sesión anónima de Supabase Auth (entrar con código, sin correo). */
  async function crearUsuarioAnonimo(meta: Record<string, string>): Promise<string> {
    const r = await uno<{ id: string }>(`insert into auth.users (is_anonymous, raw_user_meta_data) values (true, $1) returning id`, [JSON.stringify(meta)]);
    return r.id;
  }
  return { db, como, uno, filas, crearUsuario, crearUsuarioAnonimo };
}
