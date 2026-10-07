// Pruebas de las migraciones SQL sobre PGlite (Postgres real en WASM):
// deduplicación atómica, RLS/privacidad y RPC del recorrido.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");
const MIGRACIONES = join(RAIZ, "supabase", "migrations");

let db: PGlite;
const ids: Record<string, string> = {};

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

async function crearUsuario(email: string, meta: Record<string, string>): Promise<string> {
  const r = await uno<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(meta)],
  );
  return r.id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const archivo of readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRACIONES, archivo), "utf8"));
  }

  // Datos base: empresa, admin, invitaciones, conductor, dos apoderados, ruta.
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Transportes Demo') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Admin')`, [ids.admin, ids.empresa]);
  await db.query(`insert into invitaciones (codigo, empresa_id, rol) values ('APOD1234', $1, 'apoderado'), ('COND1234', $1, 'conductor')`, [ids.empresa]);
  ids.conductor = await crearUsuario("conductor@demo.cl", { codigo_invitacion: "cond1234", nombre: "Juan" });
  ids.apoderadoA = await crearUsuario("a@demo.cl", { codigo_invitacion: "APOD1234", nombre: "Ana" });
  ids.apoderadoB = await crearUsuario("b@demo.cl", { codigo_invitacion: "APOD1234", nombre: "Beto" });
  ids.ruta = (await uno<{ id: string }>(
    `insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta tarde', 'vuelta', $2) returning id`,
    [ids.empresa, ids.conductor],
  )).id;

  const registrar = (uid: string, nombre: string, lat: number) =>
    como("authenticated", uid, async () =>
      (await uno<{ id: string }>(`select registrar_alumno($1::jsonb) as id`, [JSON.stringify({
        nombre, colegio: "Colegio Demo", minutos_aviso: 5,
        domicilio: { direccion: `Calle ${nombre} 123`, lat, lng: -70.6 },
        contactos: [{ nombre: "Principal", telefono: "+56911111111", prioridad: 1 }],
      })])).id);
  ids.alumnoA = await registrar(ids.apoderadoA, "Sofía", -33.40);
  ids.alumnoB = await registrar(ids.apoderadoB, "Matías", -33.41);
  await como("authenticated", ids.admin, async () => {
    await db.query(`select asignar_a_ruta($1, $2)`, [ids.alumnoA, ids.ruta]);
    await db.query(`select asignar_a_ruta($1, $2)`, [ids.alumnoB, ids.ruta]);
  });
});

describe("registro con código de invitación", () => {
  it("crea el perfil con el rol del código (no elegido por el usuario)", async () => {
    const p = await uno<{ rol: string; nombre: string }>(`select rol, nombre from perfiles where id = $1`, [ids.conductor]);
    expect(p).toEqual({ rol: "conductor", nombre: "Juan" });
  });

  it("rechaza códigos inválidos", async () => {
    await expect(crearUsuario("x@demo.cl", { codigo_invitacion: "NOEXISTE" })).rejects.toThrow(/inválido/);
  });

  it("un usuario no puede cambiarse el rol", async () => {
    await expect(
      como("authenticated", ids.apoderadoA, () => db.query(`update perfiles set rol = 'admin' where id = $1`, [ids.apoderadoA])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("RLS de alumnos y contactos", () => {
  it("cada apoderado ve solo a sus hijos", async () => {
    const vistos = await como("authenticated", ids.apoderadoA, async () =>
      (await db.query<{ nombre: string }>(`select nombre from alumnos`)).rows.map((r) => r.nombre));
    expect(vistos).toEqual(["Sofía"]);
  });

  it("el conductor ve a los alumnos de su ruta pero NO sus teléfonos", async () => {
    const [alumnos, contactos] = await como("authenticated", ids.conductor, async () => [
      (await db.query(`select id from alumnos`)).rows.length,
      (await db.query(`select id from contactos`)).rows.length,
    ]);
    expect(alumnos).toBe(2);
    expect(contactos).toBe(0);
  });

  it("solo un apoderado puede registrar alumnos", async () => {
    await expect(
      como("authenticated", ids.conductor, () => db.query(`select registrar_alumno('{"nombre":"X"}'::jsonb)`)),
    ).rejects.toThrow(/Solo un apoderado/);
  });
});

describe("recorrido, avisos y privacidad de la ubicación", () => {
  let recorrido: string;
  let paradaA: string;
  let paradaB: string;

  const posicionesVisiblesPara = (uid: string) =>
    como("authenticated", uid, async () => (await db.query(`select id from posiciones where recorrido_id = $1`, [recorrido])).rows.length);

  beforeAll(async () => {
    // Matías no viaja hoy.
    await como("authenticated", ids.apoderadoB, () =>
      db.query(`select marcar_no_viaja($1, (now() at time zone 'America/Santiago')::date, 'vuelta', true)`, [ids.alumnoB]));
    recorrido = await como("authenticated", ids.conductor, async () =>
      (await uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.ruta])).id);
    const filas = (await db.query<{ id: string; alumno_id: string }>(
      `select id, alumno_id from recorrido_alumnos where recorrido_id = $1`, [recorrido])).rows;
    paradaA = filas.find((f) => f.alumno_id === ids.alumnoA)!.id;
    paradaB = filas.find((f) => f.alumno_id === ids.alumnoB)!.id;
    await como("service_role", null, () =>
      db.query(`select registrar_posiciones($1, $2::jsonb)`, [recorrido, JSON.stringify([
        { client_id: crypto.randomUUID(), ts: Date.now(), lat: -33.43, lng: -70.6 },
      ])]));
  });

  it("iniciar_recorrido es idempotente y salta a quien 'hoy no viaja'", async () => {
    const otra = await como("authenticated", ids.conductor, async () =>
      (await uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.ruta])).id);
    expect(otra).toBe(recorrido);
    const pendientes = await como("service_role", null, async () =>
      (await db.query<{ nombre: string }>(`select nombre from paradas_pendientes($1)`, [recorrido])).rows);
    expect(pendientes.map((p) => p.nombre)).toEqual(["Sofía"]);
    expect((await uno<{ estado: string }>(`select estado from recorrido_alumnos where id = $1`, [paradaB])).estado).toBe("no_viaja");
  });

  it("registrar_posiciones ignora duplicados (reenvío de la cola)", async () => {
    const pos = [{ client_id: crypto.randomUUID(), ts: Date.now(), lat: -33.42, lng: -70.6 }];
    const n = await como("service_role", null, async () => [
      (await uno<{ n: number }>(`select registrar_posiciones($1, $2::jsonb) as n`, [recorrido, JSON.stringify(pos)])).n,
      (await uno<{ n: number }>(`select registrar_posiciones($1, $2::jsonb) as n`, [recorrido, JSON.stringify(pos)])).n,
    ]);
    expect(n).toEqual([1, 0]);
  });

  it("el apoderado NO ve el furgón antes de su aviso", async () => {
    expect(await posicionesVisiblesPara(ids.apoderadoA)).toBe(0);
    expect(await posicionesVisiblesPara(ids.conductor)).toBeGreaterThan(0);
    expect(await posicionesVisiblesPara(ids.admin)).toBeGreaterThan(0);
  });

  it("seguimiento en vivo antes del aviso: solo zona aproximada (~1 km) y paradas que faltan", async () => {
    await como("service_role", null, () =>
      db.query(`select registrar_posiciones($1, $2::jsonb)`, [recorrido, JSON.stringify([
        { client_id: crypto.randomUUID(), ts: Date.now(), lat: -33.43187, lng: -70.60321 },
      ])]));
    const s = await como("authenticated", ids.apoderadoA, async () =>
      (await uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.alumnoA])).s);
    expect(s.ubicacion).toMatchObject({ exacta: false, lat: -33.43, lng: -70.6, radio_m: 1000 });
    expect(s.paradas_antes).toBe(0);
    expect(s.conductor).toBe("Juan");
    await expect(
      como("authenticated", ids.apoderadoB, () => db.query(`select seguimiento_furgon($1)`, [ids.alumnoA])),
    ).rejects.toThrow(/No autorizado/);
  });

  it("la columna de última posición del recorrido no es legible por los usuarios", async () => {
    await expect(
      como("authenticated", ids.apoderadoA, () => db.query(`select ultima_lat from recorridos`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("registrar_aviso deduplica de forma atómica y no es invocable desde la app", async () => {
    const [primero, segundo] = await como("service_role", null, async () => [
      (await uno<{ id: string | null }>(`select registrar_aviso($1, 'eta', 290) as id`, [paradaA])).id,
      (await uno<{ id: string | null }>(`select registrar_aviso($1, 'geocerca', 200) as id`, [paradaA])).id,
    ]);
    expect(primero).toMatch(/[0-9a-f-]{36}/);
    expect(segundo).toBeNull();
    ids.aviso = primero!;
    await expect(
      como("authenticated", ids.conductor, () => db.query(`select registrar_aviso($1, 'eta', 1)`, [paradaA])),
    ).rejects.toThrow(/permission denied/);
  });

  it("tras el aviso, el apoderado ve el furgón exacto, pero solo las posiciones desde su aviso", async () => {
    // Las posiciones anteriores al aviso (posibles detenciones en otras casas) siguen ocultas.
    expect(await posicionesVisiblesPara(ids.apoderadoA)).toBe(0);
    await como("service_role", null, () =>
      db.query(`select registrar_posiciones($1, $2::jsonb)`, [recorrido, JSON.stringify([
        { client_id: crypto.randomUUID(), ts: Date.now() + 1000, lat: -33.41234, lng: -70.60111 },
      ])]));
    expect(await posicionesVisiblesPara(ids.apoderadoA)).toBe(1);
    expect(await posicionesVisiblesPara(ids.apoderadoB)).toBe(0);
    const s = await como("authenticated", ids.apoderadoA, async () =>
      (await uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.alumnoA])).s);
    expect(s.ubicacion).toMatchObject({ exacta: true, lat: -33.41234, lng: -70.60111 });
  });

  it("reclamar_llamadas entrega cada llamada programada una sola vez", async () => {
    await db.query(`insert into llamadas (aviso_id, telefono, intento) values ($1, '+56911111111', 1)`, [ids.aviso]);
    const [a, b] = await como("service_role", null, async () => [
      (await db.query(`select * from reclamar_llamadas(10)`)).rows.length,
      (await db.query(`select * from reclamar_llamadas(10)`)).rows.length,
    ]);
    expect([a, b]).toEqual([1, 0]);
  });

  it("marcar entregado cancela llamadas pendientes y corta el acceso del apoderado al mapa", async () => {
    await db.query(
      `insert into llamadas (aviso_id, telefono, intento, programada_para) values ($1, '+56911111111', 2, now() + interval '30 seconds')`,
      [ids.aviso],
    );
    const r = await como("authenticated", ids.conductor, async () =>
      (await uno<{ r: { nombre: string } }>(`select marcar_parada($1, 'entregado') as r`, [paradaA])).r);
    expect(r.nombre).toBe("Sofía");
    expect((await uno<{ estado: string }>(`select estado from llamadas where intento = 2`)).estado).toBe("cancelada");
    expect(await posicionesVisiblesPara(ids.apoderadoA)).toBe(0);
    const s = await como("authenticated", ids.apoderadoA, async () =>
      (await uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.alumnoA])).s);
    expect(s.estado).toBe("entregado");
    expect(s.ubicacion).toBeNull();
  });

  it("otro conductor no puede marcar paradas ajenas", async () => {
    await expect(
      como("authenticated", ids.apoderadoA, () => db.query(`select marcar_parada($1, 'ausente')`, [paradaA])),
    ).rejects.toThrow(/No autorizado/);
  });

  it("al finalizar el recorrido nadie ve más la ubicación", async () => {
    await como("authenticated", ids.conductor, () => db.query(`select finalizar_recorrido($1)`, [recorrido]));
    expect(await posicionesVisiblesPara(ids.conductor)).toBe(0);
    expect(await posicionesVisiblesPara(ids.admin)).toBe(0);
  });
});
