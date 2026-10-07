// «Ya subió mi hijo/a» (seguir en vivo mientras va a bordo) y conexiones familia ↔ tía/tío.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const CASA = { lat: -33.45, lng: -70.6 };

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Tía Marcela') returning id`)).id;
  ids.otraEmpresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Transportes Jorge') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueño')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre, comunas, visible_en_busqueda) values ($1, $2, 'conductor', 'Marcela Fuentes', 'Ñuñoa, La Reina', true)`, [ids.tia, ids.empresa]);
  ids.tio = await crearUsuario("jorge@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre, comunas, visible_en_busqueda) values ($1, $2, 'conductor', 'Jorge Díaz', 'Maipú', true)`, [ids.tio, ids.otraEmpresa]);
  ids.oculta = await crearUsuario("oculta@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Marta Oculta')`, [ids.oculta, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
  ids.rutaIda = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
});

const comoTia = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.tia, fn);
const posicion = (lat: number, lng: number, recorrido: string) => E.como("service_role", null, () =>
  E.db.query(`select registrar_posiciones($1, $2::jsonb)`, [recorrido, JSON.stringify([{ client_id: crypto.randomUUID(), ts: Date.now(), lat, lng }])]));

describe("conexiones familia ↔ tía/tío", () => {
  it("una familia se registra sin código (queda sin furgón) y no puede registrar hijos aún", async () => {
    ids.ana = await E.crearUsuario("ana@correo.cl", { nombre: "Ana Pérez", telefono: "+56911111111", sin_codigo: "familia" });
    expect(await E.uno(`select rol, empresa_id from perfiles where id = $1`, [ids.ana])).toEqual({ rol: "apoderado", empresa_id: null });
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`select registrar_alumno($1::jsonb)`, [JSON.stringify({
      nombre: "Sofía", domicilio: { direccion: "Av. Ossa 1200", ...CASA }, contactos: [{ nombre: "Ana", telefono: "+56911111111", prioridad: 1 }],
    })]))).rejects.toThrow(/conéctate con tu tía/);
  });

  it("la familia busca tías: solo aparecen las que activaron la búsqueda", async () => {
    const r = await E.como("authenticated", ids.ana, () => E.filas<{ nombre: string; empresa: string }>(`select nombre, empresa from buscar_tias('ñuñoa')`));
    expect(r).toEqual([{ nombre: "Marcela Fuentes", empresa: "Furgones Tía Marcela" }]);
    expect(await E.como("authenticated", ids.ana, () => E.filas(`select * from buscar_tias('marta')`))).toHaveLength(0);
    // Una tía no puede usar la búsqueda de familias para listar tías, ni viceversa.
    await expect(comoTia(() => E.db.query(`select * from buscar_tias('ma')`))).rejects.toThrow(/Solo las familias/);
  });

  it("la familia pide conectarse, la tía acepta y la familia queda en su furgón", async () => {
    const id = await E.como("authenticated", ids.ana, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1, 'Hola tía, Sofía va en 3° básico') as id`, [ids.tia])).id);
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`select solicitar_conexion($1)`, [ids.tia]))).rejects.toThrow(/pendiente/);
    // Quien envió la solicitud no puede aceptarla.
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`select responder_conexion($1, true)`, [id]))).rejects.toThrow(/No autorizado/);
    const recibidas = await comoTia(() => E.filas<{ otro_nombre: string; iniciada_por: string; mensaje: string }>(`select otro_nombre, iniciada_por, mensaje from mis_conexiones()`));
    expect(recibidas).toEqual([{ otro_nombre: "Ana Pérez", iniciada_por: "apoderado", mensaje: "Hola tía, Sofía va en 3° básico" }]);
    await comoTia(() => E.db.query(`select responder_conexion($1, true)`, [id]));
    expect((await E.uno<{ empresa_id: string }>(`select empresa_id from perfiles where id = $1`, [ids.ana])).empresa_id).toBe(ids.empresa);
    ids.sofia = await E.como("authenticated", ids.ana, async () => (await E.uno<{ id: string }>(`select registrar_alumno($1::jsonb) as id`, [JSON.stringify({
      nombre: "Sofía", domicilio: { direccion: "Av. Ossa 1200", ...CASA }, contactos: [{ nombre: "Ana", telefono: "+56911111111", prioridad: 1 }],
    })])).id);
    const conectadas = await comoTia(() => E.filas<{ estado: string; hijos: string[] }>(`select estado, hijos from mis_conexiones()`));
    expect(conectadas).toEqual([{ estado: "aceptada", hijos: ["Sofía"] }]);
  });

  it("una familia con dos furgones registra a cada hijo con su tía o tío", async () => {
    const id = await E.como("authenticated", ids.ana, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1) as id`, [ids.tio])).id);
    // Sin aceptar todavía, no puede registrar un hijo con el tío Jorge.
    const conJorge = JSON.stringify({ nombre: "Isidora", conductor_id: ids.tio, domicilio: { direccion: "Pajaritos 100", lat: -33.5, lng: -70.75 },
      contactos: [{ nombre: "Ana", telefono: "+56911111111", prioridad: 1 }] });
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`select registrar_alumno($1::jsonb)`, [conJorge]))).rejects.toThrow(/No estás conectado/);
    await E.como("authenticated", ids.tio, () => E.db.query(`select responder_conexion($1, true)`, [id]));
    const isidora = await E.como("authenticated", ids.ana, async () => (await E.uno<{ id: string }>(`select registrar_alumno($1::jsonb) as id`, [conJorge])).id);
    expect((await E.uno<{ empresa_id: string }>(`select empresa_id from alumnos where id = $1`, [isidora])).empresa_id).toBe(ids.otraEmpresa);
    // Su furgón principal sigue siendo el primero.
    expect((await E.uno<{ empresa_id: string }>(`select empresa_id from perfiles where id = $1`, [ids.ana])).empresa_id).toBe(ids.empresa);
    // Las solicitudes sobre Isidora le llegan al furgón de Jorge.
    const sol = await E.como("authenticated", ids.ana, async () => (await E.uno<{ id: string }>(`select crear_solicitud('pregunta', 'Horario', '¿A qué hora pasan?', $1) as id`, [isidora])).id);
    expect((await E.uno<{ empresa_id: string }>(`select empresa_id from solicitudes where id = $1`, [sol])).empresa_id).toBe(ids.otraEmpresa);
  });

  it("la tía busca a una familia solo por correo o teléfono exactos y la invita; la familia acepta", async () => {
    ids.carla = await E.crearUsuario("carla@correo.cl", { nombre: "Carla Muñoz", telefono: "+56944441212", sin_codigo: "familia" });
    expect(await comoTia(() => E.filas(`select * from buscar_familia('carla')`))).toHaveLength(0); // no se puede recorrer la lista
    expect(await comoTia(() => E.filas<{ nombre: string }>(`select nombre from buscar_familia('9 4444 1212')`))).toEqual([{ nombre: "Carla Muñoz" }]);
    const [f] = await comoTia(() => E.filas<{ id: string }>(`select id from buscar_familia('CARLA@correo.cl')`));
    const id = await comoTia(async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1) as id`, [f.id])).id);
    await expect(comoTia(() => E.db.query(`select responder_conexion($1, true)`, [id]))).rejects.toThrow(/No autorizado/);
    const recibida = await E.como("authenticated", ids.carla, () => E.filas<{ otro_nombre: string; empresa: string }>(`select otro_nombre, empresa from mis_conexiones()`));
    expect(recibida).toEqual([{ otro_nombre: "Marcela Fuentes", empresa: "Furgones Tía Marcela" }]);
    await E.como("authenticated", ids.carla, () => E.db.query(`select responder_conexion($1, true)`, [id]));
    expect((await E.uno<{ empresa_id: string }>(`select empresa_id from perfiles where id = $1`, [ids.carla])).empresa_id).toBe(ids.empresa);
  });

  it("tras un rechazo no se puede insistir de inmediato; una solicitud pendiente se puede retirar", async () => {
    ids.luis = await E.crearUsuario("luis@correo.cl", { nombre: "Luis Soto", sin_codigo: "familia" });
    const id = await E.como("authenticated", ids.luis, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1) as id`, [ids.tio])).id);
    await E.como("authenticated", ids.tio, () => E.db.query(`select responder_conexion($1, false)`, [id]));
    await expect(E.como("authenticated", ids.luis, () => E.db.query(`select solicitar_conexion($1)`, [ids.tio]))).rejects.toThrow(/rechazada hace poco/);
    const otra = await E.como("authenticated", ids.luis, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1) as id`, [ids.tia])).id);
    await E.como("authenticated", ids.luis, () => E.db.query(`select cancelar_conexion($1)`, [otra]));
    expect((await E.uno<{ estado: string }>(`select estado from conexiones where id = $1`, [otra])).estado).toBe("cancelada");
  });

  it("nadie ve las conexiones de otros", async () => {
    expect(await E.como("authenticated", ids.tio, () => E.filas(`select id from conexiones where conductor_id = $1`, [ids.tia]))).toHaveLength(0);
  });
});

describe("ya subió mi hijo/a", () => {
  it("en la vuelta, la familia confirma que subió y ve el furgón exacto mientras va a bordo", async () => {
    await E.como("authenticated", ids.admin, () => E.db.query(`select asignar_a_ruta($1, $2)`, [ids.sofia, ids.ruta]));
    const recorrido = await comoTia(async () => (await E.uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.ruta])).id);
    await posicion(-33.40, -70.70, recorrido); // antes de subir: solo zona aproximada
    const comoAna = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.ana, fn);
    const seg = async () => (await comoAna(() => E.uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.sofia]))).s;
    expect((await seg()).ubicacion.exacta).toBe(false);
    expect((await seg()).a_bordo).toBe(false);

    await comoAna(() => E.db.query(`select confirmar_subida($1)`, [ids.sofia]));
    await posicion(-33.41, -70.69, recorrido);
    const s = await seg();
    expect(s.a_bordo).toBe(true);
    expect(s.a_bordo_por).toBe("familia");
    expect(s.ubicacion).toMatchObject({ exacta: true, lat: -33.41, lng: -70.69 });
    // Solo las posiciones desde que subió (no las anteriores).
    expect(await comoAna(() => E.filas(`select id from posiciones where recorrido_id = $1`, [recorrido]))).toHaveLength(1);
    // La tía ve que la familia confirmó.
    expect(await comoTia(() => E.uno(`select a_bordo_por from recorrido_alumnos where recorrido_id = $1`, [recorrido]))).toEqual({ a_bordo_por: "familia" });

    // Al llegar a su hogar, se acaba el seguimiento exacto.
    const parada = (await E.uno<{ id: string }>(`select id from recorrido_alumnos where recorrido_id = $1`, [recorrido])).id;
    await comoTia(() => E.db.query(`select marcar_parada($1, 'entregado')`, [parada]));
    expect((await seg()).ubicacion).toBeNull();
    expect(await comoAna(() => E.filas(`select id from posiciones where recorrido_id = $1`, [recorrido]))).toHaveLength(0);
    await comoTia(() => E.db.query(`select finalizar_recorrido($1)`, [recorrido]));
  });

  it("otra familia no puede confirmar la subida de un niño que no es suyo", async () => {
    await expect(E.como("authenticated", ids.carla, () => E.db.query(`select confirmar_subida($1)`, [ids.sofia]))).rejects.toThrow(/No autorizado/);
  });

  it("en la ida, solo se puede confirmar con el furgón en la casa; si la tía marca «Subió», queda a bordo", async () => {
    await E.como("authenticated", ids.admin, () => E.db.query(`select asignar_a_ruta($1, $2)`, [ids.sofia, ids.rutaIda]));
    const recorrido = await comoTia(async () => (await E.uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ids.rutaIda])).id);
    const comoAna = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.ana, fn);
    await posicion(-33.40, -70.70, recorrido); // a varios km de la casa
    await expect(comoAna(() => E.db.query(`select confirmar_subida($1)`, [ids.sofia]))).rejects.toThrow(/todavía no llega a tu casa/);
    await posicion(CASA.lat + 0.001, CASA.lng, recorrido); // ~110 m
    await comoAna(() => E.db.query(`select confirmar_subida($1)`, [ids.sofia]));
    expect((await comoAna(() => E.uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.sofia]))).s.a_bordo).toBe(true);

    // La tía marca «Subió» (estado entregado en la ida): sigue a bordo hasta llegar al colegio.
    const parada = (await E.uno<{ id: string }>(`select id from recorrido_alumnos where recorrido_id = $1`, [recorrido])).id;
    await comoTia(() => E.db.query(`select marcar_parada($1, 'entregado')`, [parada]));
    await posicion(-33.46, -70.60, recorrido);
    const s = (await comoAna(() => E.uno<{ s: Record<string, any> }>(`select seguimiento_furgon($1) as s`, [ids.sofia]))).s;
    expect(s).toMatchObject({ estado: "entregado", a_bordo: true });
    expect(s.ubicacion).toMatchObject({ exacta: true, lat: -33.46 });
  });
});
