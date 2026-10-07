// Eliminar la cuenta desde la app: qué se borra según el rol.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

async function perfil(email: string, rol: string, empresa: string | null, extra = "", telefono: string | null = null) {
  const id = await E.crearUsuario(email, {});
  await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre, telefono${extra ? ", puede_administrar" : ""}) values ($1, $2, $3, $4, $5${extra ? ", true" : ""})`,
    [id, empresa, rol, email.split("@")[0], telefono]);
  return id;
}
async function alumno(nombre: string, apoderados: string[], empresa = ids.empresa) {
  const id = (await E.uno<{ id: string }>(`insert into alumnos (empresa_id, nombre) values ($1, $2) returning id`, [empresa, nombre])).id;
  await E.db.query(`insert into domicilios (alumno_id, direccion, lat, lng) values ($1, 'Calle 1', -33.4, -70.6)`, [id]);
  for (const a of apoderados) await E.db.query(`insert into apoderado_alumno (apoderado_id, alumno_id) values ($1, $2)`, [a, id]);
  return id;
}
/** Lo que hace la función de Edge: borra los datos y luego el usuario de auth. */
async function eliminar(uid: string) {
  const { fotos } = await E.como("service_role", null, () => E.uno<{ fotos: string[] }>(`select eliminar_datos_de_cuenta($1) as fotos`, [uid]));
  await E.db.query(`delete from auth.users where id = $1`, [uid]);
  return fotos;
}
const existe = async (tabla: string, id: string) => (await E.filas(`select 1 from ${tabla} where id = $1`, [id])).length > 0;
const resumen = (uid: string) => E.como("authenticated", uid, () => E.uno<Record<string, unknown>>(`select * from resumen_eliminacion()`));

beforeAll(async () => {
  E = await crearBaseDeDatos();
  ids.empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Demo') returning id`)).id;
  ids.admin = await perfil("admin@demo.cl", "admin", ids.empresa);
  ids.tia = await perfil("tia@demo.cl", "conductor", ids.empresa);
  ids.mama = await perfil("mama@demo.cl", "apoderado", ids.empresa, "", "+56911111111");
  ids.papa = await perfil("papa@demo.cl", "apoderado", ids.empresa);
  ids.sola = await alumno("Sofía", [ids.mama]);
  ids.compartido = await alumno("Tomás", [ids.mama, ids.papa]);
  await E.db.query(`insert into contactos (alumno_id, nombre, telefono, prioridad) values ($1, 'Mamá', '+56911111111', 1), ($1, 'Papá', '+56922222222', 2)`, [ids.compartido]);
  ids.ruta = (await E.uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
  ids.recorrido = (await E.uno<{ id: string }>(`insert into recorridos (ruta_id, empresa_id, conductor_id, tipo, estado) values ($1, $2, $3, 'ida', 'finalizado') returning id`, [ids.ruta, ids.empresa, ids.tia])).id;
  await E.db.query(`insert into licencias (conductor_id, empresa_id, numero, clase, vence_en, foto_frente, foto_reverso) values ($1, $2, '123456', 'A3', now() + interval '1 year', $3, $4)`,
    [ids.tia, ids.empresa, `${ids.tia}/frente.jpg`, `${ids.tia}/reverso.jpg`]);
});

describe("eliminar cuenta", () => {
  it("nadie puede borrar datos de otra cuenta llamando la función directamente", async () => {
    await expect(E.como("authenticated", ids.mama, () => E.db.query(`select eliminar_datos_de_cuenta($1)`, [ids.papa]))).rejects.toThrow(/permission denied/);
  });

  it("antes de confirmar, la mamá ve que se borrará su hija no compartida", async () => {
    expect(await resumen(ids.mama)).toMatchObject({ rol: "apoderado", borra_empresa: false, alumnos_borrados: 1 });
  });

  it("apoderado: se borran sus hijos no compartidos; en los compartidos solo sale su teléfono", async () => {
    expect(await eliminar(ids.mama)).toEqual([]);
    expect(await existe("perfiles", ids.mama)).toBe(false);
    expect(await existe("alumnos", ids.sola)).toBe(false);
    expect(await E.filas(`select 1 from domicilios where alumno_id = $1`, [ids.sola])).toHaveLength(0);
    expect(await existe("alumnos", ids.compartido)).toBe(true);
    expect(await E.filas(`select nombre from contactos where alumno_id = $1`, [ids.compartido])).toEqual([{ nombre: "Papá" }]);
    expect(await E.filas(`select apoderado_id from apoderado_alumno where alumno_id = $1`, [ids.compartido])).toEqual([{ apoderado_id: ids.papa }]);
  });

  it("conductora: devuelve sus fotos de licencia y el historial queda sin conductor", async () => {
    expect((await eliminar(ids.tia)).sort()).toEqual([`${ids.tia}/frente.jpg`, `${ids.tia}/reverso.jpg`]);
    expect(await E.filas(`select 1 from licencias where conductor_id = $1`, [ids.tia])).toHaveLength(0);
    expect(await E.uno(`select conductor_id from recorridos where id = $1`, [ids.recorrido])).toEqual({ conductor_id: null });
    expect(await existe("empresas", ids.empresa)).toBe(true);
  });

  it("último administrador: avisa y borra la empresa completa; las familias conservan su cuenta", async () => {
    expect(await resumen(ids.admin)).toMatchObject({ borra_empresa: true, empresa: "Furgones Demo", alumnos_borrados: 1, familias_afectadas: 1 });
    await eliminar(ids.admin);
    expect(await existe("empresas", ids.empresa)).toBe(false);
    expect(await existe("alumnos", ids.compartido)).toBe(false);
    expect(await E.uno(`select empresa_id from perfiles where id = $1`, [ids.papa])).toEqual({ empresa_id: null });
  });

  it("si otra persona también administra, la empresa sigue", async () => {
    const empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Otra') returning id`)).id;
    const dueno = await perfil("dueno@otra.cl", "admin", empresa);
    await perfil("tia@otra.cl", "conductor", empresa, "administra");
    expect(await resumen(dueno)).toMatchObject({ borra_empresa: false });
    await eliminar(dueno);
    expect(await existe("empresas", empresa)).toBe(true);
  });
});
