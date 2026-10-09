// Cada persona guarda su idioma en el perfil; solo puede cambiar el suyo.
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

describe("idioma del perfil", () => {
  it("parte en español, cada uno cambia el suyo y solo a idiomas soportados", async () => {
    expect(await E.uno(`select idioma from perfiles where id = $1`, [ids.ana])).toEqual({ idioma: "es" });
    await E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set idioma = 'en' where id = $1`, [ids.ana]));
    expect(await E.uno(`select idioma from perfiles where id = $1`, [ids.ana])).toEqual({ idioma: "en" });
    await E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set idioma = 'en' where id = $1`, [ids.pedro]));
    expect(await E.uno(`select idioma from perfiles where id = $1`, [ids.pedro])).toEqual({ idioma: "es" });
    await expect(E.como("authenticated", ids.ana, () => E.db.query(`update perfiles set idioma = 'fr' where id = $1`, [ids.ana]))).rejects.toThrow(/check/);
  });
});
