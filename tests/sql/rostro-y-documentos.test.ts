// Seguridad de los niños: foto de la cara con la licencia (con consentimiento) y documentos del
// furgón y de quien conduce, revisados por la empresa; con uno obligatorio vencido no se inicia.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
let HOY = "";
const enDias = (n: number) => new Date(Date.parse(`${HOY}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  E = await crearBaseDeDatos();
  HOY = (await E.uno<{ d: string }>("select ((now() at time zone 'America/Santiago')::date)::text as d")).d;
  const { uno, db, crearUsuario } = E;
  ids.empresa = (await uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Demo') returning id`)).id;
  ids.admin = await crearUsuario("admin@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'admin', 'Dueño')`, [ids.admin, ids.empresa]);
  ids.tia = await crearUsuario("tia@demo.cl", {});
  await db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Marcela')`, [ids.tia, ids.empresa]);
  ids.ruta = (await uno<{ id: string }>(`insert into rutas (empresa_id, nombre, tipo, conductor_id) values ($1, 'Ida', 'ida', $2) returning id`, [ids.empresa, ids.tia])).id;
});

const comoTia = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.tia, fn);
const comoAdmin = <T>(fn: () => Promise<T>) => E.como("authenticated", ids.admin, fn);
const subirDoc = (tipo: string, vence: string | null) => comoTia(async () =>
  (await E.uno<{ id: string }>(`select subir_documento($1, $2, $3::date) as id`, [tipo, `${ids.tia}/${tipo}.jpg`, vence])).id);

describe("foto de la cara con la licencia", () => {
  it("pide la foto de la cara y la autorización expresa", async () => {
    const subir = (rostro: string | null, consiento: boolean) => comoTia(() => E.db.query(
      `select subir_licencia('12345', 'A3', $1::date, $2, null, $3, $4)`, [enDias(400), `${ids.tia}/frente.jpg`, rostro, consiento]));
    await expect(subir(null, true)).rejects.toThrow(/foto de tu cara/);
    await expect(subir(`${ids.tia}/cara.jpg`, false)).rejects.toThrow(/autorización/);
    await expect(subir(`${ids.admin}/cara.jpg`, true)).rejects.toThrow(/no válida/);
    await subir(`${ids.tia}/cara.jpg`, true);
    expect(await comoAdmin(() => E.uno(`select foto_rostro, rostro_resultado from estado_licencias() where conductor_id = $1`, [ids.tia])))
      .toEqual({ foto_rostro: `${ids.tia}/cara.jpg`, rostro_resultado: "pendiente" });
  });

  it("solo el servidor guarda el resultado de la comparación", async () => {
    const lic = (await E.uno<{ id: string }>(`select id from licencias where conductor_id = $1`, [ids.tia])).id;
    await expect(comoTia(() => E.db.query(`select guardar_comparacion_rostro($1, 'coincide', 99)`, [lic]))).rejects.toThrow(/permission denied/);
    await E.como("service_role", null, () => E.db.query(`select guardar_comparacion_rostro($1, 'coincide', 97.5)`, [lic]));
    expect(await comoTia(() => E.uno(`select rostro_resultado, rostro_similitud from estado_licencias()`)))
      .toEqual({ rostro_resultado: "coincide", rostro_similitud: 97.5 });
  });
});

describe("documentos del furgón y de quien conduce", () => {
  it("sin furgón asignado no se suben los del vehículo; los personales sí", async () => {
    await expect(subirDoc("soap", enDias(200))).rejects.toThrow(/furgón asignado/);
    await subirDoc("inhabilidades", null);
    ids.furgon = (await E.uno<{ id: string }>(`insert into furgones (empresa_id, patente, conductor_id) values ($1, 'ABCD12', $2) returning id`, [ids.empresa, ids.tia])).id;
  });

  it("valida el tipo, el archivo y la fecha", async () => {
    await expect(subirDoc("otro", null)).rejects.toThrow(/no válido/);
    await expect(subirDoc("soap", null)).rejects.toThrow(/vencimiento/);
    await expect(subirDoc("soap", enDias(-1))).rejects.toThrow(/vencido/);
    await expect(comoTia(() => E.db.query(`select subir_documento('soap', $1, $2::date)`, [`${ids.admin}/x.jpg`, enDias(10)]))).rejects.toThrow(/no válido/);
    await expect(comoTia(() => E.db.query(`insert into documentos (empresa_id, tipo, conductor_id, archivo) values ($1, 'padron', $2, 'x')`, [ids.empresa, ids.tia])))
      .rejects.toThrow(/permission denied/);
  });

  it("la tía ve qué le falta y la empresa los aprueba o rechaza", async () => {
    ids.soap = await subirDoc("soap", enDias(20));
    const mios = await comoTia(() => E.filas<{ tipo: string; estado: string; patente: string | null }>(`select tipo, estado, patente from estado_documentos()`));
    expect(mios.find((d) => d.tipo === "soap")).toMatchObject({ estado: "por_verificar", patente: "ABCD12" });
    expect(mios.find((d) => d.tipo === "padron")).toMatchObject({ estado: "sin_documento" });
    expect(mios.find((d) => d.tipo === "inhabilidades")).toMatchObject({ estado: "por_verificar", patente: null });
    expect(mios).toHaveLength(8);

    await expect(comoTia(() => E.db.query(`select revisar_documento($1, true)`, [ids.soap]))).rejects.toThrow();
    await expect(comoAdmin(() => E.db.query(`select revisar_documento($1, false, '')`, [ids.soap]))).rejects.toThrow(/motivo/);
    await comoAdmin(() => E.db.query(`select revisar_documento($1, true)`, [ids.soap]));
    expect(await comoAdmin(() => E.uno(`select estado from estado_documentos() where tipo = 'soap'`))).toEqual({ estado: "por_vencer" });
  });

  it("con un documento obligatorio vencido no se puede iniciar un recorrido", async () => {
    const iniciar = () => E.db.query(`insert into recorridos (ruta_id, empresa_id, conductor_id, tipo) values ($1, $2, $3, 'ida')`, [ids.ruta, ids.empresa, ids.tia]);
    await E.db.query(`update documentos set vence_en = $2::date where id = $1`, [ids.soap, enDias(-1)]);
    await expect(iniciar()).rejects.toThrow(/\(soap: vencido\)/);
    await E.db.query(`update documentos set vence_en = $2::date where id = $1`, [ids.soap, enDias(30)]);
    await iniciar();
    await E.db.query(`update recorridos set estado = 'finalizado', finalizado_en = now()`);
  });

  it("si la empresa exige documentos, sin todos los obligatorios (subidos y no rechazados) no se inicia", async () => {
    await comoAdmin(() => E.db.query(`update empresas set exige_documentos = true where id = $1`, [ids.empresa]));
    const iniciar = () => E.db.query(`insert into recorridos (ruta_id, empresa_id, conductor_id, tipo) values ($1, $2, $3, 'ida')`, [ids.ruta, ids.empresa, ids.tia]);
    await expect(iniciar()).rejects.toThrow(/\(padron: falta\)/);
    for (const [tipo, vence] of [["padron", null], ["permiso_circulacion", enDias(100)], ["revision_tecnica", enDias(100)],
      ["registro_escolar", null], ["antecedentes", enDias(60)]] as const) await subirDoc(tipo, vence);
    // En revisión cuenta; rechazado no.
    const inh = (await E.uno<{ id: string }>(`select id from documentos where tipo = 'inhabilidades'`)).id;
    await comoAdmin(() => E.db.query(`select revisar_documento($1, false, 'No se lee')`, [inh]));
    await expect(iniciar()).rejects.toThrow(/\(inhabilidades: rechazado\)/);
    await subirDoc("inhabilidades", null);
    await iniciar();
  });
});
