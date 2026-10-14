// Mi perfil: cada uno cambia su nombre, teléfono y foto; la foto debe estar en su propia carpeta.
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  const empresa = (await E.uno<{ id: string }>(`insert into empresas (nombre) values ('Uno') returning id`)).id;
  for (const n of ["ana", "pedro"]) {
    ids[n] = await E.crearUsuario(`${n}@uno.cl`, {});
    await E.db.query(`insert into perfiles (id, empresa_id, rol, nombre) values ($1, $2, 'apoderado', $3)`, [ids[n], empresa, n]);
  }
});

describe("mi perfil", () => {
  it("cambia su nombre, teléfono y foto (en su carpeta)", async () => {
    await E.como("authenticated", ids.ana, () => E.db.query(
      `update perfiles set nombre = 'Ana Pérez', telefono = '+56912345678', foto = $2 where id = $1`, [ids.ana, `${ids.ana}/1.jpg`]));
    expect(await E.uno(`select nombre, telefono, foto from perfiles where id = $1`, [ids.ana]))
      .toEqual({ nombre: "Ana Pérez", telefono: "+56912345678", foto: `${ids.ana}/1.jpg` });
  });

  it("no acepta una foto de la carpeta de otro ni cambia el perfil ajeno", async () => {
    await expect(E.como("authenticated", ids.ana, () => E.db.query(
      `update perfiles set foto = $2 where id = $1`, [ids.ana, `${ids.pedro}/robada.jpg`]))).rejects.toThrow(/check/);
    await E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set foto = $2 where id = $1`, [ids.pedro, `${ids.pedro}/x.jpg`]));
    expect(await E.uno(`select foto from perfiles where id = $1`, [ids.pedro])).toEqual({ foto: null });
  });

  it("sigue sin poder cambiarse el rol ni la empresa", async () => {
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set rol = 'admin' where id = $1`, [ids.ana])))
      .rejects.toThrow(/permission denied/);
  });
});
