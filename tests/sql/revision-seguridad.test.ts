// Cada ataque de la revisión de seguridad previa al despliegue, intentado y bloqueado.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

async function perfil(email: string, rol: string, empresa: string) {
  const id = await E.crearUsuario(email, {});
  await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, $3, $4)`, [id, empresa, rol, email.split("@")[0]]);
  return id;
}
async function alumno(nombre: string, empresa: string, apoderados: string[]) {
  const id = (await E.uno<{ id: string }>(`insert into alumnos (empresa_id, nombre) values ($1, $2) returning id`, [empresa, nombre])).id;
  const dom = (await E.uno<{ id: string }>(`insert into domicilios (alumno_id, direccion, lat, lng) values ($1, 'x', -33.4, -70.6) returning id`, [id])).id;
  for (const a of apoderados) await E.db.query(`insert into apoderado_alumno (apoderado_id, alumno_id) values ($1, $2)`, [a, id]);
  return { id, dom };
}
const como = <T>(uid: string | null, fn: () => Promise<T>) => E.como("authenticated", uid, fn);

beforeAll(async () => {
  E = await crearBaseDeDatos();
  ids.empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Uno') returning id`)).id;
  ids.otra = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Otra') returning id`)).id;
  ids.admin = await perfil("admin@uno.cl", "admin", ids.empresa);
  ids.tia = await perfil("tia@uno.cl", "conductor", ids.empresa);
  ids.tiaOtra = await perfil("tia@otra.cl", "conductor", ids.otra);
  ids.mama = await perfil("mama@uno.cl", "apoderado", ids.empresa);
  ids.papa = await perfil("papa@uno.cl", "apoderado", ids.empresa);
  const a = await alumno("Sofía", ids.empresa, [ids.mama, ids.papa]);
  ids.sofia = a.id; ids.domSofia = a.dom;
  const b = await alumno("Ajeno", ids.otra, []);
  ids.ajeno = b.id; ids.domAjeno = b.dom;
  ids.ruta = (await E.uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
  await E.db.query(`insert into ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values ($1, $2, $3, 1)`, [ids.ruta, ids.sofia, ids.domSofia]);
});

describe("revisión de seguridad", () => {
  it("1. probar códigos al azar: después de 10 equivocados por hora se bloquea", async () => {
    for (let i = 0; i < 10; i++) expect(await como(null, () => E.filas(`select * from validar_invitacion($1)`, [`FZZZZZZ${i}`]))).toEqual([]);
    await expect(como(null, () => E.filas(`select * from validar_invitacion('FZZZZZZZZ')`))).rejects.toThrow(/Demasiados códigos/);
    // Otra persona (otra sesión) no queda bloqueada.
    expect(await como(ids.mama, () => E.filas(`select * from validar_invitacion('FZZZZZZZZ')`))).toEqual([]);
  });

  it("3. un familiar al que quitaron no puede volver con un código que creó antes", async () => {
    const codigo = await como(ids.papa, async () => (await E.uno<{ c: string }>(`select compartir_familia(null, 'Papá') as c`)).c);
    await E.db.query(`update apoderado_alumno set invitado_por = $1 where apoderado_id = $2`, [ids.mama, ids.papa]);
    await como(ids.mama, () => E.db.query(`select dejar_de_compartir($1, $2)`, [ids.sofia, ids.papa]));
    const nuevo = await E.crearUsuario("papa2@uno.cl", {});
    await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'apoderado', 'Papá 2')`, [nuevo, ids.empresa]);
    await expect(como(nuevo, () => E.db.query(`select unirse_familia($1)`, [codigo]))).rejects.toThrow(/inválido/);
  });

  it("4. la familia no puede desactivar al alumno para saltarse los cobros", async () => {
    await expect(como(ids.mama, () => E.db.query(`update alumnos set activo = false where id = $1`, [ids.sofia]))).rejects.toThrow(/permission denied/);
    await como(ids.mama, () => E.db.query(`update alumnos set minutos_aviso = 10 where id = $1`, [ids.sofia]));
  });

  it("5. una licencia rechazada o sin revisar por más de 30 días no permite iniciar recorridos", async () => {
    const lic = await como(ids.tia, async () => (await E.uno<{ id: string }>(
      `select subir_licencia('12345', 'A3', (now() at time zone 'America/Santiago')::date + 400, $1, null) as id`, [`${ids.tia}/f.jpg`])).id);
    await como(ids.tia, () => E.db.query(`select iniciar_recorrido($1)`, [ids.ruta])); // sin revisar, recién subida: puede
    await E.db.query(`update recorridos set estado = 'finalizado' where ruta_id = $1`, [ids.ruta]);
    await como(ids.admin, () => E.db.query(`select revisar_licencia($1, false, 'Foto ilegible')`, [lic]));
    await expect(como(ids.tia, () => E.db.query(`select iniciar_recorrido($1)`, [ids.ruta]))).rejects.toThrow(/rechazada/);
    await E.db.query(`update licencias set estado = 'pendiente', creado_en = now() - interval '31 days' where id = $1`, [lic]);
    await expect(como(ids.tia, () => E.db.query(`select iniciar_recorrido($1)`, [ids.ruta]))).rejects.toThrow(/más de 30 días/);
    await E.db.query(`update licencias set estado = 'aprobada' where id = $1`, [lic]);
  });

  it("7. un administrador no puede meter alumnos ni conductores de otra empresa en sus rutas", async () => {
    await expect(como(ids.admin, () => E.db.query(`insert into ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values ($1, $2, $3, 9)`,
      [ids.ruta, ids.ajeno, ids.domAjeno]))).rejects.toThrow(/no corresponden/);
    await expect(como(ids.admin, () => E.db.query(`update rutas set conductor_id = $1 where id = $2`, [ids.tiaOtra, ids.ruta]))).rejects.toThrow(/no pertenece/);
  });

  it("8. si el recorrido se cierra solo, se cancelan las llamadas que quedaban", async () => {
    const rec = await como(ids.tia, async () => (await E.uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.ruta])).id);
    const ra = await E.uno<{ id: string }>(`select id from recorrido_alumnos where recorrido_id = $1 limit 1`, [rec]);
    const aviso = (await E.uno<{ id: string }>(
      `insert into avisos (recorrido_id, recorrido_alumno_id, alumno_id, motivo) select $1, $2, alumno_id, 'eta' from recorrido_alumnos where id = $2 returning id`, [rec, ra.id])).id;
    await E.db.query(`insert into llamadas (aviso_id, telefono, intento) values ($1, '+56911111111', 1)`, [aviso]);
    await E.db.query(`update recorridos set estado = 'finalizado', finalizado_en = now() where id = $1`, [rec]); // como el cierre automático
    expect(await E.uno(`select estado from llamadas where aviso_id = $1`, [aviso])).toEqual({ estado: "cancelada" });
  });
});
