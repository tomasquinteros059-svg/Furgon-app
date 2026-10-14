// Aviso por WhatsApp: viene apagado, cada familia lo activa en su perfil y nadie más puede
// leer ni escribir el registro de envíos.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Uno') returning id`)).id;
  for (const n of ["ana", "pedro"]) {
    ids[n] = await E.crearUsuario(`${n}@uno.cl`, {});
    await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre, telefono) values ($1, $2, 'apoderado', $3, '+56912345678')`, [ids[n], empresa, n]);
  }
});

describe("aviso por WhatsApp", () => {
  it("viene apagado y cada familia lo activa en su propio perfil", async () => {
    expect(await E.uno(`select aviso_whatsapp from perfiles where id = $1`, [ids.ana])).toEqual({ aviso_whatsapp: false });
    await E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set aviso_whatsapp = true where id = $1`, [ids.ana]));
    await E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set aviso_whatsapp = true where id = $1`, [ids.pedro]));
    expect(await E.uno(`select aviso_whatsapp from perfiles where id = $1`, [ids.ana])).toEqual({ aviso_whatsapp: true });
    expect(await E.uno(`select aviso_whatsapp from perfiles where id = $1`, [ids.pedro])).toEqual({ aviso_whatsapp: false });
  });

  it("las familias no pueden escribir en el registro de envíos", async () => {
    await expect(E.como("authenticated", ids.ana, () => E.db.query(
      `insert into envios_whatsapp (aviso_id, apoderado_id) values (gen_random_uuid(), $1)`, [ids.ana]))).rejects.toThrow(/permission denied/);
    const filas = await E.como("authenticated", ids.ana, () => E.db.query(`select * from envios_whatsapp`));
    expect(filas.rows).toEqual([]);
  });
});
