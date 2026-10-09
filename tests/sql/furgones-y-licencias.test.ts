// Furgones del administrador y licencias de conducir verificadas, con avisos de vencimiento.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
// Fechas en hora de Chile, como las calcula la base de datos.
const enDias = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(Date.now() + n * 86_400_000));

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Demo') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueño')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Marcela Fuentes')`, [ids.tia, ids.empresa]);
  ids.tio = await crearUsuario("tio@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Jorge Díaz')`, [ids.tio, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Vuelta', 'vuelta', $2) returning id`, [ids.empresa, ids.tia])).id;
});

const comoAdmin = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.admin, fn);
const comoTia = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.tia, fn);
const subir = (uid: string, vence: string) => E.como("authenticated", uid, async () => (await E.uno<{ id: string }>(
  `select subir_licencia('12.345.678-9', 'a3', $1::date, $2, $3) as id`, [vence, `${uid}/frente.jpg`, `${uid}/reverso.jpg`])).id);
const estado = (uid: string) => comoAdmin(() => E.uno<{ estado: string; dias_restantes: number }>(
  `select estado, dias_restantes from estado_licencias() where conductor_id = $1`, [uid]));

describe("furgones", () => {
  it("el administrador crea un furgón con su tía y sus rutas, y ve el resumen", async () => {
    ids.furgon = await comoAdmin(async () => (await E.uno<{ id: string }>(`select guardar_furgon($1::jsonb) as id`, [JSON.stringify({
      patente: "demo-11", modelo: "Hyundai H1", capacidad: 12, conductor_id: ids.tia, ruta_ids: [ids.ruta],
    })])).id);
    const [f] = await comoAdmin(() => E.filas<Record<string, unknown>>(`select patente, modelo, capacidad, conductor, rutas, alumnos, licencia from resumen_furgones()`));
    expect(f).toEqual({ patente: "DEMO-11", modelo: "Hyundai H1", capacidad: 12, conductor: "Marcela Fuentes", rutas: ["Vuelta"], alumnos: 0, licencia: "sin_licencia" });
  });

  it("una tía sin permiso de administrar no ve ni edita furgones", async () => {
    await expect(comoTia(() => E.db.query(`select * from resumen_furgones()`))).rejects.toThrow(/Solo el administrador/);
    await expect(comoTia(() => E.db.query(`select guardar_furgon('{"patente":"X"}'::jsonb)`))).rejects.toThrow(/Solo el administrador/);
  });
});

describe("licencias", () => {
  it("la tía sube su licencia; queda por verificar; solo con fotos de su carpeta", async () => {
    await expect(comoTia(() => E.db.query(`select subir_licencia('1', 'A3', $1::date, $2, null)`, [enDias(100), `${ids.tio}/robada.jpg`]))).rejects.toThrow(/no válida|between|check/);
    await expect(subir(ids.tia, enDias(-1))).rejects.toThrow(/ya está vencida/);
    ids.licTia = await subir(ids.tia, enDias(200));
    expect(await estado(ids.tia)).toEqual({ estado: "por_verificar", dias_restantes: 200 });
    // La clase se guarda en mayúsculas.
    expect((await E.uno<{ clase: string }>(`select clase from licencias where id = $1`, [ids.licTia])).clase).toBe("A3");
  });

  it("el administrador la rechaza con motivo o la aprueba; nadie aprueba su propia licencia", async () => {
    await expect(comoAdmin(() => E.db.query(`select revisar_licencia($1, false)`, [ids.licTia]))).rejects.toThrow(/motivo/);
    await comoAdmin(() => E.db.query(`select revisar_licencia($1, false, 'La foto está borrosa')`, [ids.licTia]));
    expect((await estado(ids.tia)).estado).toBe("rechazada");
    ids.licTia = await subir(ids.tia, enDias(200));
    await comoAdmin(() => E.db.query(`select revisar_licencia($1, true)`, [ids.licTia]));
    expect(await E.uno(`select estado, revisada_por = $2 as yo from licencias where id = $1`, [ids.licTia, ids.admin])).toEqual({ estado: "aprobada", yo: true });
    expect((await estado(ids.tia)).estado).toBe("vigente");
    // Una tía que administra no puede aprobarse a sí misma.
    await E.db.query(`update perfiles set puede_administrar = true where id = $1`, [ids.tia]);
    const propia = await subir(ids.tia, enDias(300));
    await expect(comoTia(() => E.db.query(`select revisar_licencia($1, true)`, [propia]))).rejects.toThrow(/la revisa otra persona/);
    await E.db.query(`update perfiles set puede_administrar = false where id = $1`, [ids.tia]);
  });

  it("avisa una sola vez por umbral (60, 30, 15, 7, 1 días y vencida)", async () => {
    const lic = await subir(ids.tio, enDias(25));
    await comoAdmin(() => E.db.query(`select revisar_licencia($1, true)`, [lic]));
    expect((await estado(ids.tio)).estado).toBe("por_vencer");
    const avisar = () => E.como("service_role", null, () => E.filas<{ conductor: string; dias: number }>(`select conductor, dias from licencias_para_avisar()`));
    expect(await avisar()).toEqual([{ conductor: "Jorge Díaz", dias: 25 }]);
    expect(await avisar()).toEqual([]); // el umbral de 30 ya se avisó
    await E.db.query(`update licencias set vence_en = (now() at time zone 'America/Santiago')::date + 6 where id = $1`, [lic]);
    expect(await avisar()).toEqual([{ conductor: "Jorge Díaz", dias: 6 }]);
    // Nadie más puede pedir la lista.
    await expect(comoAdmin(() => E.db.query(`select * from licencias_para_avisar()`))).rejects.toThrow(/permission denied/);
  });

  it("con la licencia vencida no se puede iniciar un recorrido", async () => {
    await E.db.query(`update licencias set vence_en = (now() at time zone 'America/Santiago')::date - 2 where conductor_id = $1`, [ids.tia]);
    await expect(comoTia(() => E.db.query(`select iniciar_recorrido($1)`, [ids.ruta]))).rejects.toThrow(/licencia de conducir venció/);
    expect((await estado(ids.tia)).estado).toBe("vencida");
    await E.db.query(`update licencias set vence_en = (now() at time zone 'America/Santiago')::date + 90 where conductor_id = $1`, [ids.tia]);
    await comoTia(() => E.db.query(`select iniciar_recorrido($1)`, [ids.ruta]));
  });

  it("la tía ve solo su propia licencia; el administrador ve todas", async () => {
    expect(await comoTia(() => E.filas(`select id from licencias where conductor_id = $1`, [ids.tio]))).toHaveLength(0);
    expect((await comoTia(() => E.filas(`select conductor from estado_licencias()`))).length).toBe(1);
    expect((await comoAdmin(() => E.filas(`select conductor from estado_licencias()`))).length).toBe(2);
  });
});
