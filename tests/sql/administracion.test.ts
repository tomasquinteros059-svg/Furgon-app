// App web de administración: alumnos con código para la familia, rutas, cobros,
// cancelaciones y preguntas, sobre las migraciones reales (PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const comoAdmin = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.admin, fn);

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre, mensualidad_defecto) values ('Furgones Marcela', 55000) returning id`)).id;
  ids.admin = await crearUsuario("duena@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueña')`, [ids.admin, ids.empresa]);
  await db.query(`insert into invitaciones (codigo, empresa_id, rol) values ('TIA12345', $1, 'conductor')`, [ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", { codigo_invitacion: "TIA12345", nombre: "Tía Marcela" });
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
});

const datosAlumno = (nombre: string, extra: Record<string, unknown> = {}) => JSON.stringify({
  nombre, colegio: "Colegio Demo", curso: "3° Básico",
  domicilio: { direccion: `Calle ${nombre} 1`, lat: -33.45, lng: -70.6 },
  contactos: [{ nombre: "Mamá", telefono: "+56911112222", prioridad: 1 }],
  ruta_ids: [ids.ruta], ...extra,
});

describe("el administrador agrega alumnos para que la tía solo use la app", () => {
  it("crea el alumno completo, lo deja en la ruta de la tía y entrega un código para la familia", async () => {
    const r = await comoAdmin(async () => (await E.uno<{ r: { alumno_id: string; codigo: string } }>(
      `select admin_crear_alumno($1::jsonb) as r`, [datosAlumno("Sofía", { mensualidad: 70000 })])).r);
    ids.sofia = r.alumno_id; ids.codigoSofia = r.codigo;
    expect(r.codigo).toMatch(/^[0-9A-F]{8}$/);
    const ruta = await E.como("authenticated", ids.tia, () => E.filas<{ nombre: string }>(
      `select a.nombre from ruta_paradas rp join alumnos a on a.id = rp.alumno_id where rp.ruta_id = $1 order by rp.orden`, [ids.ruta]));
    expect(ruta.map((x) => x.nombre)).toEqual(["Sofía"]);
  });

  it("el código de la familia es estable mientras siga vigente", async () => {
    const otra = await comoAdmin(async () => (await E.uno<{ c: string }>(`select codigo_familia($1) as c`, [ids.sofia])).c);
    expect(otra).toBe(ids.codigoSofia);
  });

  it("la mamá se registra con el código y queda vinculada al alumno sin registrar nada más", async () => {
    ids.mama = await E.crearUsuario("mama@demo.cl", { codigo_invitacion: ids.codigoSofia.toLowerCase(), nombre: "Ana", telefono: "+56911112222" });
    const hijos = await E.como("authenticated", ids.mama, () => E.filas<{ nombre: string }>(`select nombre from alumnos`));
    expect(hijos.map((h) => h.nombre)).toEqual(["Sofía"]);
    const perfil = await E.uno<{ rol: string }>(`select rol from perfiles where id = $1`, [ids.mama]);
    expect(perfil.rol).toBe("apoderado");
  });

  it("solo el administrador puede crear alumnos así", async () => {
    await expect(E.como("authenticated", ids.tia, () => E.db.query(`select admin_crear_alumno($1::jsonb)`, [datosAlumno("X")])))
      .rejects.toThrow(/Solo el administrador/);
  });

  it("reordena las paradas de la ruta", async () => {
    const r = await comoAdmin(async () => (await E.uno<{ r: { alumno_id: string } }>(`select admin_crear_alumno($1::jsonb) as r`, [datosAlumno("Matías")])).r);
    ids.matias = r.alumno_id;
    await comoAdmin(() => E.db.query(`select mover_parada($1, $2, -1)`, [ids.ruta, ids.matias]));
    const orden = await comoAdmin(() => E.filas<{ nombre: string }>(
      `select a.nombre from ruta_paradas rp join alumnos a on a.id = rp.alumno_id where rp.ruta_id = $1 order by rp.orden`, [ids.ruta]));
    expect(orden.map((x) => x.nombre)).toEqual(["Matías", "Sofía"]);
  });

  it("el apoderado no puede cambiar la mensualidad de su hijo; el administrador sí", async () => {
    await expect(E.como("authenticated", ids.mama, () => E.db.query(`update alumnos set mensualidad = 1 where id = $1`, [ids.sofia])))
      .rejects.toThrow(/permission denied/);
    await comoAdmin(() => E.db.query(`select admin_actualizar_alumno($1, '{"mensualidad": 72000}'::jsonb)`, [ids.sofia]));
    expect((await E.uno<{ m: number }>(`select mensualidad as m from alumnos where id = $1`, [ids.sofia])).m).toBe(72000);
  });
});

describe("cobros", () => {
  it("genera las mensualidades del mes una sola vez, con el monto de cada alumno o el de la empresa", async () => {
    const n1 = await comoAdmin(async () => (await E.uno<{ n: number }>(`select generar_cobros(date '2026-10-15') as n`)).n);
    const n2 = await comoAdmin(async () => (await E.uno<{ n: number }>(`select generar_cobros(date '2026-10-01') as n`)).n);
    expect([n1, n2]).toEqual([2, 0]);
    const cobros = await comoAdmin(() => E.filas<{ nombre: string; monto: number; vence_en: string }>(
      `select a.nombre, c.monto, c.vence_en::text from cobros c join alumnos a on a.id = c.alumno_id order by a.nombre`));
    expect(cobros).toEqual([
      { nombre: "Matías", monto: 55000, vence_en: "2026-10-05" },
      { nombre: "Sofía", monto: 72000, vence_en: "2026-10-05" },
    ]);
  });

  it("la mamá ve solo los cobros de su hijo y no puede marcarlos pagados", async () => {
    const vistos = await E.como("authenticated", ids.mama, () => E.filas<{ monto: number }>(`select monto from cobros`));
    expect(vistos).toEqual([{ monto: 72000 }]);
    await expect(E.como("authenticated", ids.mama, () => E.db.query(`update cobros set estado = 'pagado'`))).rejects.toThrow(/permission denied/);
    await expect(E.como("authenticated", ids.mama, () => E.db.query(`select registrar_pago(id, 'efectivo') from cobros`))).rejects.toThrow(/Solo el administrador/);
  });

  it("el administrador registra un pago", async () => {
    const id = (await E.uno<{ id: string }>(`select id from cobros where alumno_id = $1`, [ids.sofia])).id;
    await comoAdmin(() => E.db.query(`select registrar_pago($1, 'transferencia', 'Banco Estado')`, [id]));
    const c = await E.uno<{ estado: string; medio: string }>(`select estado, medio from cobros where id = $1`, [id]);
    expect(c).toEqual({ estado: "pagado", medio: "transferencia" });
    await expect(comoAdmin(() => E.db.query(`select registrar_pago($1, 'efectivo')`, [id]))).rejects.toThrow(/no está pendiente/);
  });
});

describe("solicitudes: preguntas y cancelaciones", () => {
  it("la mamá pide cancelar el servicio; otra familia no lo ve; el administrador sí", async () => {
    // Cobro de un mes futuro que debe anularse al aprobar la baja.
    await comoAdmin(() => E.db.query(`select generar_cobros((date_trunc('month', current_date) + interval '1 month')::date)`));
    ids.solicitud = await E.como("authenticated", ids.mama, async () => (await E.uno<{ id: string }>(
      `select crear_solicitud('cancelacion_servicio', 'Nos cambiamos de casa', 'Desde el próximo mes ya no necesitamos el furgón.', $1) as id`, [ids.sofia])).id);
    const delAdmin = await comoAdmin(() => E.filas(`select id from solicitudes`));
    expect(delAdmin).toHaveLength(1);
    const otro = await E.crearUsuario("otro@demo.cl", {});
    await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'apoderado', 'Otro')`, [otro, ids.empresa]);
    expect(await E.como("authenticated", otro, () => E.filas(`select id from solicitudes`))).toHaveLength(0);
  });

  it("el administrador responde y la solicitud queda respondida; la mamá ve la conversación", async () => {
    await comoAdmin(() => E.db.query(`insert into solicitud_mensajes (solicitud_id, autor_id, cuerpo) values ($1, $2, '¿Desde qué fecha?')`, [ids.solicitud, ids.admin]));
    expect((await E.uno<{ estado: string }>(`select estado from solicitudes where id = $1`, [ids.solicitud])).estado).toBe("respondida");
    const conversacion = await E.como("authenticated", ids.mama, () => E.filas<{ cuerpo: string }>(
      `select cuerpo from solicitud_mensajes where solicitud_id = $1 order by creado_en`, [ids.solicitud]));
    expect(conversacion).toHaveLength(2);
  });

  it("al aprobar la cancelación: alumno dado de baja, fuera de la ruta y sin cobros futuros", async () => {
    await comoAdmin(() => E.db.query(`select resolver_cancelacion($1, true, 'Listo, quedó cancelado. ¡Gracias!')`, [ids.solicitud]));
    const a = await E.uno<{ activo: boolean; fecha_baja: string | null }>(`select activo, fecha_baja::text from alumnos where id = $1`, [ids.sofia]);
    expect(a.activo).toBe(false);
    expect(a.fecha_baja).not.toBeNull();
    expect(await E.filas(`select 1 from ruta_paradas where alumno_id = $1`, [ids.sofia])).toHaveLength(0);
    const futuros = await E.filas<{ estado: string }>(
      `select estado from cobros where alumno_id = $1 and periodo > date_trunc('month', current_date)`, [ids.sofia]);
    expect(futuros.map((c) => c.estado)).toEqual(["anulado"]);
    const s = await E.uno<{ estado: string; resolucion: string }>(`select estado, resolucion from solicitudes where id = $1`, [ids.solicitud]);
    expect(s).toEqual({ estado: "cerrada", resolucion: "aprobada" });
    await expect(E.como("authenticated", ids.mama, () => E.db.query(
      `insert into solicitud_mensajes (solicitud_id, autor_id, cuerpo) values ($1, $2, 'hola')`, [ids.solicitud, ids.mama]))).rejects.toThrow();
  });

  it("preguntas frecuentes: la familia ve solo las publicadas", async () => {
    await comoAdmin(() => E.db.query(`insert into preguntas_frecuentes (empresa_id, pregunta, respuesta, publicada) values
      ($1, '¿Cómo aviso que no viaja?', 'Desde la app, en “Hoy no viaja”.', true), ($1, 'Borrador', '...', false)`, [ids.empresa]));
    const vistas = await E.como("authenticated", ids.mama, () => E.filas<{ pregunta: string }>(`select pregunta from preguntas_frecuentes`));
    expect(vistas.map((p) => p.pregunta)).toEqual(["¿Cómo aviso que no viaja?"]);
  });

  it("resumen del panel", async () => {
    const r = await comoAdmin(async () => (await E.uno<{ r: Record<string, number> }>(`select resumen_admin() as r`)).r);
    expect(r).toMatchObject({ alumnos_activos: 1, alumnos_sin_ruta: 0, familias_sin_app: 1, solicitudes_abiertas: 0 });
    await expect(E.como("authenticated", ids.tia, () => E.db.query(`select resumen_admin()`))).rejects.toThrow(/Solo el administrador/);
  });
});
