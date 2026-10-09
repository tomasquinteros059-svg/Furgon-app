// Casos del QA de la base de datos, reproducidos y corregidos (20261020000001_correcciones_qa.sql).
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const al: string[] = [];
const como = <T>(uid: string, fn: () => Promise<T>) => E.como("authenticated", uid, fn);
const q = (uid: string, sql: string, p: unknown[] = []) => como(uid, () => E.db.query(sql, p));
const hoy = async () => (await como(ids.tia, () => E.uno<{ d: string }>(`select hoy_empresa()::text d`))).d;
const estadoParada = async (rec: string, alumno: string) =>
  (await E.uno<{ estado: string }>(`select estado from recorrido_alumnos where recorrido_id = $1 and alumno_id = $2`, [rec, alumno])).estado;
const tipos = async (alumno: string) => (await E.filas<{ tipo: string }>(`select tipo from inasistencias where alumno_id = $1 order by tipo`, [alumno])).map((x) => x.tipo);

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('X') returning id`)).id;
  ids.admin = await crearUsuario("a@x.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'A')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("t@x.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'T')`, [ids.tia, ids.empresa]);
  ids.mama = await crearUsuario("m@x.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre, telefono) values ($1, $2, 'apoderado', 'M', '+56911111111')`, [ids.mama, ids.empresa]);
  ids.ida = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
  ids.vuelta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
  for (const n of ["Ana", "Beto"]) {
    const r = await como(ids.admin, () => uno<{ r: { alumno_id: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [JSON.stringify({
      nombre: n, domicilio: { direccion: "c", lat: -33.45, lng: -70.6 }, contactos: [{ nombre: "M", telefono: "+56911111111", prioridad: 1 }], ruta_ids: [ids.ida, ids.vuelta] })]));
    al.push(r.r.alumno_id);
    await db.query(`insert into apoderado_alumno (apoderado_id, alumno_id) values ($1, $2)`, [ids.mama, r.r.alumno_id]);
  }
});

describe("correcciones del QA", () => {
  it("«hoy no va»: deshacer la vuelta de un día completo deja marcada la ida y la parada vuelve a pendiente", async () => {
    const d = await hoy();
    const rec = (await como(ids.tia, () => E.uno<{ id: string }>(`select iniciar_recorrido($1) id`, [ids.vuelta]))).id;
    await q(ids.mama, `select marcar_no_viaja($1, $2::date, 'ambos', true)`, [al[0], d]);
    expect(await estadoParada(rec, al[0])).toBe("no_viaja");
    await q(ids.mama, `select marcar_no_viaja($1, $2::date, 'vuelta', false)`, [al[0], d]);
    expect(await tipos(al[0])).toEqual(["ida"]);
    expect(await estadoParada(rec, al[0])).toBe("pendiente");
    // Marcó la vuelta y además el día completo; deshacer el día completo no revive la vuelta.
    await q(ids.mama, `select marcar_no_viaja($1, $2::date, 'vuelta', true)`, [al[1], d]);
    await q(ids.mama, `select marcar_no_viaja($1, $2::date, 'ambos', true)`, [al[1], d]);
    await q(ids.mama, `select marcar_no_viaja($1, $2::date, 'ambos', false)`, [al[1], d]);
    expect(await tipos(al[1])).toEqual(["vuelta"]);
    expect(await estadoParada(rec, al[1])).toBe("no_viaja");
    ids.recVuelta = rec;
  });

  it("la tía no puede devolver a pendiente a quien la familia marcó «hoy no viaja»", async () => {
    const p = await E.uno<{ id: string }>(`select id from recorrido_alumnos where recorrido_id = $1 and alumno_id = $2`, [ids.recVuelta, al[1]]);
    await expect(q(ids.tia, `select marcar_parada($1, 'pendiente')`, [p.id])).rejects.toThrow(/hoy no viaja/);
  });

  it("un recorrido de un día anterior que quedó abierto se cierra y se crea el de hoy", async () => {
    await E.db.query(`update recorridos set iniciado_en = now() - interval '1 day' where id = $1`, [ids.recVuelta]);
    const nuevo = (await como(ids.tia, () => E.uno<{ id: string }>(`select iniciar_recorrido($1) id`, [ids.vuelta]))).id;
    expect(nuevo).not.toBe(ids.recVuelta);
    expect(await E.uno(`select estado from recorridos where id = $1`, [ids.recVuelta])).toEqual({ estado: "finalizado" });
    ids.recHoy = nuevo;
  });

  it("no se registra aviso para un niño ya atendido, y las llamadas que ya no sirven se cancelan", async () => {
    const p = await E.uno<{ id: string }>(`select id from recorrido_alumnos where recorrido_id = $1 and alumno_id = $2`, [ids.recHoy, al[0]]);
    const aviso = (await E.como("service_role", null, () => E.uno<{ id: string }>(`select registrar_aviso($1, 'eta', 300) as id`, [p.id]))).id;
    await E.db.query(`insert into llamadas (aviso_id, telefono, intento) values ($1, '+56911111111', 1)`, [aviso]);
    await q(ids.tia, `select marcar_parada($1, 'entregado')`, [p.id]);
    await E.db.query(`update llamadas set estado = 'programada' where aviso_id = $1`, [aviso]); // como si se hubiera colado
    expect(await E.como("service_role", null, () => E.filas(`select * from reclamar_llamadas(10)`))).toEqual([]);
    expect(await E.uno(`select estado from llamadas where aviso_id = $1`, [aviso])).toEqual({ estado: "cancelada" });
    await E.db.query(`delete from avisos where id = $1`, [aviso]);
    expect(await E.como("service_role", null, () => E.uno<{ id: string | null }>(`select registrar_aviso($1, 'eta', 300) as id`, [p.id]))).toEqual({ id: null });
  });

  it("eliminar la cuenta de la familia anula sus cobros de meses futuros", async () => {
    await como(ids.admin, () => E.db.query(`select generar_cobros((date_trunc('month', hoy_empresa()) + interval '1 month')::date)`));
    await E.como("service_role", null, () => E.db.query(`select eliminar_datos_de_cuenta($1)`, [ids.mama]));
    const c = await E.filas<{ estado: string }>(`select estado from cobros where alumno_id = any($1::uuid[])`, [al]);
    expect(c.map((x) => x.estado)).toEqual(["anulado", "anulado"]);
  });

  it("generar_cobros de un mes pasado incluye a quien se dio de baja después, y no a quien llegó después", async () => {
    const r = await como(ids.admin, () => E.uno<{ r: { alumno_id: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [JSON.stringify({
      nombre: "Nuevo", domicilio: { direccion: "c", lat: -33.45, lng: -70.6 }, contactos: [{ nombre: "M", telefono: "+56922222222", prioridad: 1 }], ruta_ids: [] })]));
    const pasado = await E.uno<{ p: string }>(`select (date_trunc('month', now()) - interval '2 months')::date::text p`);
    await E.db.query(`update alumnos set creado_en = $2::date - interval '10 days' where id = $1`, [al[0], pasado.p]);
    await E.db.query(`update alumnos set fecha_baja = current_date where id = $1`, [al[0]]);
    await como(ids.admin, () => E.db.query(`select generar_cobros($1::date)`, [pasado.p]));
    const quienes = await E.filas<{ alumno_id: string }>(`select alumno_id from cobros where periodo = $1::date`, [pasado.p]);
    expect(quienes.map((x) => x.alumno_id)).toEqual([al[0]]);
    expect(quienes.map((x) => x.alumno_id)).not.toContain(r.r.alumno_id);
  });
});
