// Orden recomendado de la ruta, «hoy no va» desde la ruta de la tía y precios editables.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const alumnos: string[] = [];

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgón de la tía') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueño')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Tía Marcela')`, [ids.tia, ids.empresa]);
  ids.otraTia = await crearUsuario("otra@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Otra tía')`, [ids.otraTia, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
  for (const nombre of ["Ana", "Beto", "Caro"]) {
    const r = await E.como("authenticated", ids.admin, () => uno<{ r: { alumno_id: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [JSON.stringify({
      nombre, domicilio: { direccion: "Calle 1", lat: -33.45, lng: -70.6 },
      contactos: [{ nombre: "Mamá", telefono: "+56911112222", prioridad: 1 }], ruta_ids: [ids.ruta],
    })]));
    alumnos.push(r.r.alumno_id);
  }
});

const comoAdmin = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.admin, fn);
const comoTia = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.tia, fn);
const ordenRuta = async () => (await E.filas<{ alumno_id: string }>(`select alumno_id from ruta_paradas where ruta_id = $1 order by orden`, [ids.ruta])).map((x) => x.alumno_id);

describe("aplicar_orden_ruta", () => {
  it("guarda el orden recomendado completo", async () => {
    const nuevo = [alumnos[2], alumnos[0], alumnos[1]];
    await comoAdmin(() => E.db.query(`select aplicar_orden_ruta($1, $2::uuid[])`, [ids.ruta, nuevo]));
    expect(await ordenRuta()).toEqual(nuevo);
  });

  it("rechaza un orden que no trae exactamente a los alumnos de la ruta", async () => {
    await expect(comoAdmin(() => E.db.query(`select aplicar_orden_ruta($1, $2::uuid[])`, [ids.ruta, [alumnos[0], alumnos[1]]]))).rejects.toThrow(/La ruta cambió/);
    await expect(comoAdmin(() => E.db.query(`select aplicar_orden_ruta($1, $2::uuid[])`, [ids.ruta, [alumnos[0], alumnos[0], alumnos[1]]]))).rejects.toThrow(/La ruta cambió/);
  });

  it("una tía sin permiso de administrar no puede reordenar", async () => {
    await expect(comoTia(() => E.db.query(`select aplicar_orden_ruta($1, $2::uuid[])`, [ids.ruta, alumnos]))).rejects.toThrow(/Solo el administrador/);
  });
});

describe("hoy no va", () => {
  it("la tía marca «hoy no va» a un alumno de su ruta y el recorrido se lo salta", async () => {
    const hoy = (await comoTia(() => E.uno<{ d: string }>(`select hoy_empresa()::text as d`))).d;
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const recorrido = await comoTia(async () => (await E.uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.ruta])).id);
    await comoTia(() => E.db.query(`select marcar_no_viaja($1, $2::date, 'vuelta', true)`, [alumnos[1], hoy]));
    const estado = async () => (await E.uno<{ estado: string }>(`select estado from recorrido_alumnos where recorrido_id = $1 and alumno_id = $2`, [recorrido, alumnos[1]])).estado;
    expect(await estado()).toBe("no_viaja");
    expect(await comoTia(() => E.filas(`select id from inasistencias where alumno_id = $1`, [alumnos[1]]))).toHaveLength(1);
    // Deshacer: vuelve a quedar pendiente.
    await comoTia(() => E.db.query(`select marcar_no_viaja($1, $2::date, 'vuelta', false)`, [alumnos[1], hoy]));
    expect(await estado()).toBe("pendiente");
  });

  it("otra tía que no lleva al alumno no puede marcarlo", async () => {
    await expect(E.como("authenticated", ids.otraTia, () => E.db.query(`select marcar_no_viaja($1, current_date, 'vuelta', true)`, [alumnos[0]]))).rejects.toThrow(/No autorizado/);
  });
});

describe("precios", () => {
  it("fijar_mensualidad cambia el precio y los cobros pendientes desde el mes indicado", async () => {
    await comoAdmin(() => E.db.query(`select generar_cobros(date_trunc('month', current_date)::date)`));
    const pagado = (await E.uno<{ id: string }>(`select id from cobros where alumno_id = $1`, [alumnos[1]])).id;
    await comoAdmin(() => E.db.query(`select registrar_pago($1, 'efectivo')`, [pagado]));
    for (const a of [alumnos[0], alumnos[1]]) {
      await comoAdmin(() => E.db.query(`select fijar_mensualidad($1, 45000, current_date)`, [a]));
    }
    const montos = await E.filas<{ alumno_id: string; monto: number; estado: string }>(`select alumno_id, monto, estado from cobros order by alumno_id`);
    expect(montos.find((m) => m.alumno_id === alumnos[0])?.monto).toBe(45000);
    // Un cobro ya pagado no cambia.
    expect(montos.find((m) => m.alumno_id === alumnos[1])).toMatchObject({ estado: "pagado", monto: 60000 });
    expect((await E.uno<{ m: number }>(`select mensualidad as m from alumnos where id = $1`, [alumnos[1]])).m).toBe(45000);
  });

  it("cambiar_monto_cobro edita un cobro pendiente y rechaza montos negativos o cobros pagados", async () => {
    const pendiente = (await E.uno<{ id: string }>(`select id from cobros where alumno_id = $1`, [alumnos[2]])).id;
    await comoAdmin(() => E.db.query(`select cambiar_monto_cobro($1, 30000, 'Medio mes')`, [pendiente]));
    expect(await E.uno(`select monto, nota from cobros where id = $1`, [pendiente])).toEqual({ monto: 30000, nota: "Medio mes" });
    await expect(comoAdmin(() => E.db.query(`select cambiar_monto_cobro($1, -1)`, [pendiente]))).rejects.toThrow(/negativo/);
    const pagado = (await E.uno<{ id: string }>(`select id from cobros where alumno_id = $1`, [alumnos[1]])).id;
    await expect(comoAdmin(() => E.db.query(`select cambiar_monto_cobro($1, 1000)`, [pagado]))).rejects.toThrow(/pendiente/);
    await expect(comoTia(() => E.db.query(`select cambiar_monto_cobro($1, 1000)`, [pendiente]))).rejects.toThrow(/Solo el administrador/);
  });
});
