// Destino final de las rutas: uno o varios colegios. La tía marca la llegada y se avisa solo a
// las familias de los niños de ese colegio, una sola vez.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Uno') returning id`)).id;
  ids.tia = await crearUsuario("tia@uno.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre, puede_administrar) values ($1, $2, 'conductor', 'María', true)`, [ids.tia, ids.empresa]);
  ids.otra = await crearUsuario("otra@uno.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Otra')`, [ids.otra, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
  for (const n of ["Sofía", "Tomás"]) {
    const a = (await uno<{ id: string }>(`insert into alumnos (empresa_id, nombre) values ($1, $2) returning id`, [ids.empresa, n])).id;
    const d = (await uno<{ id: string }>(`insert into domicilios (alumno_id, direccion, lat, lng) values ($1, 'x', -33.45, -70.6) returning id`, [a])).id;
    await db.query(`insert into ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values ($1, $2, $3, $4)`, [ids.ruta, a, d, n === "Sofía" ? 1 : 2]);
    ids[n] = a; ids[`dom${n}`] = d;
  }
});

describe("destinos de la ruta", () => {
  it("la tía agrega colegios; el último de la ida queda como colegio principal de la ruta", async () => {
    await E.como("authenticated", ids.tia, async () => {
      ids.a = (await E.uno<{ id: string }>(`insert into ruta_destinos (ruta_id, orden, nombre, lat, lng) values ($1, 1, 'Colegio A', -33.40, -70.60) returning id`, [ids.ruta])).id;
      ids.b = (await E.uno<{ id: string }>(`insert into ruta_destinos (ruta_id, orden, nombre, lat, lng) values ($1, 2, 'Colegio B', -33.41, -70.61) returning id`, [ids.ruta])).id;
    });
    expect(await E.uno(`select colegio_nombre, colegio_lat from rutas where id = $1`, [ids.ruta])).toEqual({ colegio_nombre: "Colegio B", colegio_lat: -33.41 });
    // Sofía va al colegio A; Tomás, sin elegir, al principal (B).
    await E.como("authenticated", ids.tia, () => E.db.query(`update ruta_paradas set destino_id = $1 where alumno_id = $2`, [ids.a, ids.Sofía]));
  });

  it("no acepta un colegio de otra ruta ni deja a otra tía tocar los destinos", async () => {
    const otraRuta = (await E.uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo) values ($1, 'Otra', 'vuelta') returning id`, [ids.empresa])).id;
    const ajeno = (await E.uno<{ id: string }>(`insert into ruta_destinos (ruta_id, nombre, lat, lng) values ($1, 'X', -33, -70) returning id`, [otraRuta])).id;
    await expect(E.db.query(`update ruta_paradas set destino_id = $1 where alumno_id = $2`, [ajeno, ids.Tomás])).rejects.toThrow(/no es de esta ruta/);
    const vistos = await E.como("authenticated", ids.otra, () => E.filas(`select id from ruta_destinos`));
    expect(vistos).toEqual([]);
  });

  it("al llegar a un colegio devuelve solo a los niños de ese colegio que subieron, una vez", async () => {
    const rec = (await E.uno<{ id: string }>(`insert into recorridos (ruta_id, empresa_id, conductor_id, tipo) values ($1, $2, $3, 'ida') returning id`,
      [ids.ruta, ids.empresa, ids.tia])).id;
    await E.db.query(`insert into recorrido_alumnos (recorrido_id, alumno_id, domicilio_id, orden, estado) values ($1, $2, $3, 1, 'entregado'), ($1, $4, $5, 2, 'entregado')`,
      [rec, ids.Sofía, ids.domSofía, ids.Tomás, ids.domTomás]);
    const llegar = (uid: string, destino: string) => E.como("authenticated", uid, async () =>
      (await E.uno<{ r: { tipo: string; destino: string; alumnos: { nombre: string }[] } }>(`select llegar_a_destino($1, $2) as r`, [rec, destino])).r);

    const enA = await llegar(ids.tia, ids.a);
    expect(enA.destino).toBe("Colegio A");
    expect(enA.alumnos.map((x) => x.nombre)).toEqual(["Sofía"]);
    expect((await llegar(ids.tia, ids.a)).alumnos).toEqual([]); // repetido: no se vuelve a avisar
    expect((await llegar(ids.tia, ids.b)).alumnos.map((x) => x.nombre)).toEqual(["Tomás"]);
    await expect(llegar(ids.otra, ids.a)).rejects.toThrow(/No autorizado/);
    await expect(E.como("authenticated", ids.tia, () => E.db.query(`insert into recorrido_destinos (recorrido_id, destino_id) values ($1, $2)`, [rec, ids.a])))
      .rejects.toThrow(/permission denied/);
  });
});
