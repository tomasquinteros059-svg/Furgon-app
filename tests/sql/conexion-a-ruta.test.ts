// Al aceptar a una familia, sus hijos entran solos a las rutas elegidas, en el mejor lugar.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const COLEGIO = { lat: -33.4565, lng: -70.5978 };
// Casas al norte del colegio, a ~1, ~3 y ~5 km.
const casa = (km: number) => ({ lat: COLEGIO.lat + km / 111.195, lng: COLEGIO.lng });

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Tía Marcela') returning id`)).id;
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre, visible_en_busqueda) values ($1, $2, 'conductor', 'Marcela', true)`, [ids.tia, ids.empresa]);
  ids.otraTia = await crearUsuario("otra@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Otra')`, [ids.otraTia, ids.empresa]);
  const ruta = async (nombre: string, tipo: string, conductor: string) => (await uno<{ id: string }>(
    `insert into rutas (empresa_id, nombre, tipo, conductor_id, colegio_lat, colegio_lng, hora_salida) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [ids.empresa, nombre, tipo, conductor, COLEGIO.lat, COLEGIO.lng, tipo === "ida" ? "07:00" : "16:30"])).id;
  ids.ida = await ruta("Ida mañana", "ida", ids.tia);
  ids.vuelta = await ruta("Vuelta tarde", "vuelta", ids.tia);
  ids.ajena = await ruta("Ruta de otra tía", "vuelta", ids.otraTia);
  // Dos alumnos que ya están en las rutas: a 1 km y a 5 km del colegio.
  for (const [nombre, km] of [["Cerca", 1], ["Lejos", 5]] as const) {
    const a = (await uno<{ id: string }>(`insert into alumnos (empresa_id, nombre) values ($1, $2) returning id`, [ids.empresa, nombre])).id;
    const d = (await uno<{ id: string }>(`insert into domicilios (alumno_id, direccion, lat, lng) values ($1, 'x', $2, $3) returning id`, [a, casa(km).lat, casa(km).lng])).id;
    // Vuelta: colegio → Cerca → Lejos. Ida: Lejos → Cerca → colegio.
    await db.query(`insert into ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values ($1, $2, $3, $4), ($5, $2, $3, $6)`,
      [ids.vuelta, a, d, km === 1 ? 1 : 2, ids.ida, km === 1 ? 2 : 1]);
  }
  await db.query(`update ruta_paradas set agregado_en = now() - interval '10 days'`);
});

const ordenDe = (ruta: string) => E.filas<{ nombre: string }>(
  `select a.nombre from ruta_paradas rp join alumnos a on a.id = rp.alumno_id where rp.ruta_id = $1 order by rp.orden`, [ruta])
  .then((f) => f.map((x) => x.nombre));
const registrarHijo = (apoderado: string, nombre: string, km: number) => E.como("authenticated", apoderado, async () =>
  (await E.uno<{ id: string }>(`select registrar_alumno($1::jsonb) as id`, [JSON.stringify({
    nombre, domicilio: { direccion: "Calle", ...casa(km) }, contactos: [{ nombre: "Mamá", telefono: "+56911112222", prioridad: 1 }],
  })])).id);

describe("conexión → ruta", () => {
  it("la tía acepta eligiendo rutas; el hijo que registra la familia entra solo, en el mejor lugar", async () => {
    ids.rocio = await E.crearUsuario("rocio@correo.cl", { sin_codigo: "familia", nombre: "Rocío Torres" });
    const c = await E.como("authenticated", ids.rocio, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1, 'Hola tía') as id`, [ids.tia])).id);
    // Una ruta de otra tía se ignora.
    await E.como("authenticated", ids.tia, () => E.db.query(`select responder_conexion($1, true, $2::uuid[])`, [c, [ids.ida, ids.vuelta, ids.ajena]]));
    const rutas = await E.como("authenticated", ids.tia, () => E.uno<{ rutas: string[] }>(`select rutas from mis_conexiones()`));
    expect(rutas.rutas).toEqual(["Ida mañana", "Vuelta tarde"]);

    await registrarHijo(ids.rocio, "Josefa", 3); // a 3 km: queda entre «Cerca» y «Lejos»
    expect(await ordenDe(ids.vuelta)).toEqual(["Cerca", "Josefa", "Lejos"]);
    expect(await ordenDe(ids.ida)).toEqual(["Lejos", "Josefa", "Cerca"]);
    expect(await ordenDe(ids.ajena)).toEqual([]);

    // Aparece en el panel principal de la tía.
    const nuevos = await E.como("authenticated", ids.tia, () => E.filas<{ alumno: string; ruta: string; parada: number }>(
      `select alumno, ruta, parada from nuevos_en_mis_rutas() order by ruta`));
    expect(nuevos).toEqual([{ alumno: "Josefa", ruta: "Ida mañana", parada: 2 }, { alumno: "Josefa", ruta: "Vuelta tarde", parada: 2 }]);
    // La otra tía no lo ve como nuevo en sus rutas.
    expect(await E.como("authenticated", ids.otraTia, () => E.filas(`select * from nuevos_en_mis_rutas()`))).toHaveLength(0);
  });

  it("si la tía invita, elige las rutas al invitar; al aceptar la familia, sus hijos ya registrados entran", async () => {
    ids.carla = await E.crearUsuario("carla@correo.cl", { sin_codigo: "familia", nombre: "Carla" });
    // Carla ya tenía furgón en esta empresa por otra conexión, con un hijo sin ruta.
    await E.db.query(`update perfiles set empresa_id = $1 where id = $2`, [ids.empresa, ids.carla]);
    await registrarHijo(ids.carla, "Benjamín", 6);
    const c = await E.como("authenticated", ids.tia, async () => (await E.uno<{ id: string }>(`select solicitar_conexion($1, null, $2::uuid[]) as id`, [ids.carla, [ids.vuelta]])).id);
    const n = await E.como("authenticated", ids.carla, async () => (await E.uno<{ n: number }>(`select responder_conexion($1, true) as n`, [c])).n);
    expect(n).toBe(1);
    expect(await ordenDe(ids.vuelta)).toEqual(["Cerca", "Josefa", "Lejos", "Benjamín"]);
    expect(await ordenDe(ids.ida)).not.toContain("Benjamín");
  });

  it("nadie puede llamar directo a la inserción en rutas", async () => {
    await expect(E.como("authenticated", ids.carla, () => E.db.query(`select agregar_a_ruta_en_mejor_lugar($1, $1)`, [ids.vuelta]))).rejects.toThrow(/permission denied/);
  });
});
