// Quien entra con Google completa su registro (familia, código de familia o invitación), y los
// documentos con vencimiento avisan a los 30, 15, 7 y 1 días, una sola vez por umbral.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
let HOY = "";
const enDias = (n: number) => new Date(Date.parse(`${HOY}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  E = await crearBaseDeDatos();
  HOY = (await E.uno<{ d: string }>("select ((now() at time zone 'America/Santiago')::date)::text as d")).d;
  ids.empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Furgones Uno') returning id`)).id;
  await E.db.query(`insert into invitaciones (codigo, empresa_id, rol, usos_restantes) values ('TIA12345', $1, 'conductor', 1)`, [ids.empresa]);
});

// Cuentas de Google: llegan sin datos de registro, así que no tienen perfil.
const cuentaGoogle = (correo: string) => E.crearUsuario(correo, { full_name: "Persona Google" });
const completar = (uid: string, nombre: string, tel: string | null, codigo: string | null) => E.como("authenticated", uid, async () =>
  (await E.uno<{ rol: string }>(`select completar_registro($1, $2, $3) as rol`, [nombre, tel, codigo])).rol);

describe("completar el registro (entrar con Google)", () => {
  it("una familia sin código queda como apoderado, sin empresa", async () => {
    const uid = await cuentaGoogle("ana@gmail.com");
    expect(await E.uno(`select count(*)::int as n from perfiles where id = $1`, [uid])).toEqual({ n: 0 });
    expect(await completar(uid, "Ana Pérez", "+56911112222", null)).toBe("apoderado");
    expect(await E.uno(`select rol, empresa_id, telefono from perfiles where id = $1`, [uid]))
      .toEqual({ rol: "apoderado", empresa_id: null, telefono: "+56911112222" });
    await expect(completar(uid, "Ana", null, null)).rejects.toThrow(/ya está registrada/);
  });

  it("con un código de invitación queda con el rol y la empresa del código", async () => {
    const uid = await cuentaGoogle("tia@gmail.com");
    expect(await completar(uid, "María", null, " tia12345 ")).toBe("conductor");
    expect(await E.uno(`select rol, empresa_id from perfiles where id = $1`, [uid])).toEqual({ rol: "conductor", empresa_id: ids.empresa });
    const otra = await cuentaGoogle("otra@gmail.com");
    await expect(completar(otra, "Otra", null, "TIA12345")).rejects.toThrow(/inválido o vencido/); // sin usos
    await expect(completar(otra, "Otra", null, "NOEXISTE")).rejects.toThrow(/inválido o vencido/);
    await expect(completar(otra, "X", null, null)).rejects.toThrow(/nombre/);
    await expect(completar(otra, "Otra", "123", null)).rejects.toThrow(/Teléfono/);
  });
});

describe("avisos de vencimiento de documentos", () => {
  it("avisa a la tía del furgón por umbral, una sola vez, y no los rechazados ni los sin fecha", async () => {
    ids.tia = await E.crearUsuario("marcela@demo.cl", {});
    await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'conductor', 'Marcela')`, [ids.tia, ids.empresa]);
    ids.furgon = (await E.uno<{ id: string }>(`insert into furgones (empresa_id, patente, conductor_id) values ($1, 'ABCD12', $2) returning id`, [ids.empresa, ids.tia])).id;
    const doc = (tipo: string, vence: string | null, estado = "aprobada", furgon = true) => E.db.query(
      `insert into documentos (empresa_id, tipo, furgon_id, conductor_id, archivo, vence_en, estado) values ($1, $2, $3, $4, 'x', $5::date, $6::estado_licencia)`,
      [ids.empresa, tipo, furgon ? ids.furgon : null, furgon ? null : ids.tia, vence, estado]);
    await doc("soap", enDias(12));               // umbral 15
    await doc("revision_tecnica", enDias(100));  // todavía no
    await doc("permiso_circulacion", enDias(3), "rechazada");
    await doc("padron", null);
    await doc("antecedentes", enDias(1), "pendiente", false); // umbral 1, de la persona

    const avisar = () => E.como("service_role", null, () =>
      E.filas<{ tipo: string; conductor: string; patente: string | null; dias: number }>(`select tipo, conductor, patente, dias from documentos_para_avisar() order by tipo`));
    expect(await avisar()).toEqual([
      { tipo: "antecedentes", conductor: "Marcela", patente: null, dias: 1 },
      { tipo: "soap", conductor: "Marcela", patente: "ABCD12", dias: 12 },
    ]);
    expect(await avisar()).toEqual([]); // ya avisados
    await expect(E.como("authenticated", ids.tia, () => E.db.query(`select documentos_para_avisar()`))).rejects.toThrow(/permission denied/);
  });
});
