// Perfil de familia compartido: la mamá comparte a sus hijos con el papá (dúo).
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Tía Marcela') returning id`)).id;
  await db.query(`insert into invitaciones (codigo, empresa_id, rol) values ('MAMA0001', $1, 'apoderado')`, [ids.empresa]);
  ids.mama = await crearUsuario("ana@correo.cl", { codigo_invitacion: "MAMA0001", nombre: "Ana Pérez", telefono: "+56911111111" });
  const hijo = (nombre: string) => E.como("authenticated", ids.mama, async () => (await uno<{ id: string }>(`select registrar_alumno($1::jsonb) as id`, [JSON.stringify({
    nombre, domicilio: { direccion: "Av. Ossa 1200", lat: -33.45, lng: -70.55 },
    contactos: [{ nombre: "Ana (mamá)", telefono: "+56911111111", prioridad: 1 }],
  })])).id);
  ids.sofia = await hijo("Sofía");
  ids.isidora = await hijo("Isidora");
});

const comoMama = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.mama, fn);

describe("familia compartida", () => {
  it("el papá sin cuenta se registra con el código de la mamá y ve a los mismos hijos", async () => {
    const codigo = await comoMama(async () => (await E.uno<{ c: string }>(`select compartir_familia(null, 'Papá') as c`)).c);
    expect(codigo).toMatch(/^F[0-9A-F]{7}$/);
    const v = await E.como("authenticated", null, () => E.filas<{ rol: string; empresa: string }>(`select * from validar_invitacion($1)`, [codigo.toLowerCase()]));
    expect(v).toEqual([{ rol: "apoderado", empresa: "la familia de Ana Pérez (Isidora, Sofía)" }]);

    ids.papa = await E.crearUsuario("pedro@correo.cl", { codigo_invitacion: codigo, nombre: "Pedro Pérez", telefono: "+56922223333" });
    expect(await E.uno(`select rol, empresa_id from perfiles where id = $1`, [ids.papa])).toEqual({ rol: "apoderado", empresa_id: ids.empresa });
    const hijos = await E.como("authenticated", ids.papa, () => E.filas<{ nombre: string }>(`select nombre from alumnos order by nombre`));
    expect(hijos.map((h) => h.nombre)).toEqual(["Isidora", "Sofía"]);
    // Su teléfono entra a la llamada automática (prioridad 2), así también lo llaman a él.
    expect(await E.filas(`select nombre, prioridad from contactos where alumno_id = $1 order by prioridad`, [ids.sofia]))
      .toEqual([{ nombre: "Ana (mamá)", prioridad: 1 }, { nombre: "Papá · Pedro Pérez", prioridad: 2 }]);
    // El código es de un solo uso.
    await expect(E.crearUsuario("otro@correo.cl", { codigo_invitacion: codigo, nombre: "Otro" })).rejects.toThrow(/ya usado/);
  });

  it("ambos pueden marcar «hoy no viaja» y ven quién más está a cargo", async () => {
    await E.como("authenticated", ids.papa, () => E.db.query(`select marcar_no_viaja($1, current_date, 'vuelta', true)`, [ids.sofia]));
    expect(await comoMama(() => E.filas(`select id from inasistencias where alumno_id = $1`, [ids.sofia]))).toHaveLength(1);
    const familia = await comoMama(() => E.filas<{ alumno: string; apoderado: string; soy_yo: boolean; lo_invite: boolean }>(
      `select alumno, apoderado, soy_yo, lo_invite from mi_familia() where alumno = 'Sofía'`));
    expect(familia).toEqual([
      { alumno: "Sofía", apoderado: "Ana Pérez", soy_yo: true, lo_invite: false },
      { alumno: "Sofía", apoderado: "Pedro Pérez", soy_yo: false, lo_invite: true },
    ]);
  });

  it("si ya tiene cuenta, se une escribiendo el código; no sirve el propio ni uno ajeno a sus hijos", async () => {
    ids.abuela = await E.crearUsuario("rosa@correo.cl", { sin_codigo: "familia", nombre: "Rosa (abuela)", telefono: "+56933334444" });
    const codigo = await comoMama(async () => (await E.uno<{ c: string }>(`select compartir_familia($1::uuid[], 'Abuela') as c`, [[ids.isidora]])).c);
    await expect(comoMama(() => E.db.query(`select unirse_familia($1)`, [codigo]))).rejects.toThrow(/otra persona/);
    const nombres = await E.como("authenticated", ids.abuela, async () => (await E.uno<{ n: string[] }>(`select unirse_familia($1) as n`, [codigo])).n);
    expect(nombres).toEqual(["Isidora"]);
    expect(await E.como("authenticated", ids.abuela, () => E.filas(`select id from alumnos`))).toHaveLength(1);
    // No se pueden compartir hijos ajenos.
    await expect(E.como("authenticated", ids.abuela, () => E.db.query(`select compartir_familia($1::uuid[])`, [[ids.sofia]]))).rejects.toThrow(/No autorizado|Primero registra/);
  });

  it("quien invitó puede dejar de compartir; un hijo nunca queda sin apoderado", async () => {
    await expect(E.como("authenticated", ids.papa, () => E.db.query(`select dejar_de_compartir($1, $2)`, [ids.sofia, ids.mama]))).rejects.toThrow(/quien tú invitaste/);
    await comoMama(() => E.db.query(`select dejar_de_compartir($1, $2)`, [ids.sofia, ids.papa]));
    expect(await E.como("authenticated", ids.papa, () => E.filas<{ nombre: string }>(`select nombre from alumnos`))).toEqual([{ nombre: "Isidora" }]);
    expect(await E.filas(`select prioridad from contactos where alumno_id = $1`, [ids.sofia])).toEqual([{ prioridad: 1 }]);
    await expect(comoMama(() => E.db.query(`select dejar_de_compartir($1, $2)`, [ids.sofia, ids.mama]))).rejects.toThrow(/único apoderado/);
  });
});
