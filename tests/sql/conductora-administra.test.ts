// La tía del furgón con permiso de administrar: puede gestionar alumnos, rutas y cobros
// de su empresa, pero no darse el permiso a sí misma.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgón de la tía') returning id`)).id;
  ids.otra = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Otra empresa') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueño plataforma')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Tía Marcela')`, [ids.tia, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
});

const alumno = (nombre: string) => JSON.stringify({
  nombre, domicilio: { direccion: "Calle 1", lat: -33.45, lng: -70.6 },
  contactos: [{ nombre: "Mamá", telefono: "+56911112222", prioridad: 1 }], ruta_ids: [ids.ruta],
});
const comoTia = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.tia, fn);

describe("conductora que administra", () => {
  it("sin el permiso, la tía no puede administrar", async () => {
    await expect(comoTia(() => E.db.query(`select admin_crear_alumno($1::jsonb)`, [alumno("X")]))).rejects.toThrow(/Solo el administrador/);
    expect(await comoTia(async () => (await E.uno<{ v: boolean }>(`select soy_admin() as v`)).v)).toBe(false);
  });

  it("la tía no puede darse el permiso a sí misma", async () => {
    await expect(comoTia(() => E.db.query(`update perfiles set puede_administrar = true where id = $1`, [ids.tia]))).rejects.toThrow(/permission denied/);
    await expect(comoTia(() => E.db.query(`select permitir_administrar($1, true)`, [ids.tia]))).rejects.toThrow(/administrador principal/);
  });

  it("el administrador principal le da el permiso", async () => {
    await E.como("authenticated", ids.admin, () => E.db.query(`select permitir_administrar($1, true)`, [ids.tia]));
    expect(await comoTia(async () => (await E.uno<{ v: boolean }>(`select soy_admin() as v`)).v)).toBe(true);
  });

  it("con el permiso, agrega alumnos a su ruta, ordena, cobra e invita familias", async () => {
    const a = await comoTia(async () => (await E.uno<{ r: { alumno_id: string; codigo: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [alumno("Sofía")])).r);
    const b = await comoTia(async () => (await E.uno<{ r: { alumno_id: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [alumno("Matías")])).r);
    expect(a.codigo).toMatch(/^[0-9A-F]{8}$/);
    await comoTia(() => E.db.query(`select mover_parada($1, $2, -1)`, [ids.ruta, b.alumno_id]));
    const orden = await comoTia(() => E.filas<{ nombre: string }>(
      `select a.nombre from ruta_paradas rp join alumnos a on a.id = rp.alumno_id where rp.ruta_id = $1 order by rp.orden`, [ids.ruta]));
    expect(orden.map((x) => x.nombre)).toEqual(["Matías", "Sofía"]);
    expect(await comoTia(async () => (await E.uno<{ n: number }>(`select generar_cobros(current_date) as n`)).n)).toBe(2);
    const cobro = (await E.uno<{ id: string }>(`select id from cobros where alumno_id = $1`, [a.alumno_id])).id;
    await comoTia(() => E.db.query(`select registrar_pago($1, 'efectivo')`, [cobro]));
    expect((await E.uno<{ estado: string }>(`select estado from cobros where id = $1`, [cobro])).estado).toBe("pagado");
    expect(await comoTia(async () => (await E.uno<{ c: string }>(`select crear_invitacion('apoderado', 5) as c`)).c)).toMatch(/^[0-9A-F]{8}$/);
  });

  it("ve los teléfonos de las familias de su empresa (como administradora) pero no los de otra empresa", async () => {
    await E.db.query(`insert into alumnos (empresa_id, nombre) values ($1, 'Ajeno')`, [ids.otra]);
    const nombres = await comoTia(() => E.filas<{ nombre: string }>(`select nombre from alumnos order by nombre`));
    expect(nombres.map((n) => n.nombre)).toEqual(["Matías", "Sofía"]);
    expect(await comoTia(() => E.filas(`select id from contactos`))).toHaveLength(2);
  });

  it("al quitarle el permiso vuelve a ser solo conductora", async () => {
    await E.como("authenticated", ids.admin, () => E.db.query(`select permitir_administrar($1, false)`, [ids.tia]));
    await expect(comoTia(() => E.db.query(`select generar_cobros(current_date)`))).rejects.toThrow(/Solo el administrador/);
    expect(await comoTia(() => E.filas(`select id from contactos`))).toHaveLength(0);
  });
});
