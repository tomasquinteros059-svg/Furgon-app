// Datos de demostración para los revisores de las tiendas (scripts/sql/demo-revision.sql).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { crearBaseDeDatos } from "./entorno.ts";

const SEMILLA = readFileSync(join(__dirname, "..", "..", "scripts", "sql", "demo-revision.sql"), "utf8");
let E: Awaited<ReturnType<typeof crearBaseDeDatos>>;
const ids: Record<string, string> = {};
const sembrar = async () => {
  await E.db.query(`select set_config('demo.tia', $1, false), set_config('demo.familia', $2, false)`, [ids.tia, ids.familia]);
  await E.db.exec(SEMILLA);
};

beforeAll(async () => {
  E = await crearBaseDeDatos();
  ids.tia = await E.crearUsuario("revision.tia@demo.cl", { nombre: "Tía Demo" });
  ids.familia = await E.crearUsuario("revision.familia@demo.cl", { nombre: "Familia Demo" });
  await sembrar();
});

describe("cuentas de revisión", () => {
  it("la tía ve sus dos rutas con 4 alumnos y puede iniciar el recorrido de la mañana", async () => {
    const rutas = await E.como("authenticated", ids.tia, () => E.filas<{ nombre: string; n: number }>(
      `select r.nombre, count(p.*)::int as n from rutas r join ruta_paradas p on p.ruta_id = r.id group by r.nombre order by r.nombre`));
    expect(rutas).toEqual([{ nombre: "Mañana", n: 4 }, { nombre: "Tarde", n: 4 }]);
    const ruta = await E.uno<{ id: string }>(`select id from rutas where nombre = 'Mañana'`);
    const r = await E.como("authenticated", ids.tia, () => E.uno<{ id: string }>(`select iniciar_recorrido($1) as id`, [ruta.id]));
    expect(r.id).toBeTruthy();
  });

  it("la familia ve solo a sus dos hijos", async () => {
    const hijos = await E.como("authenticated", ids.familia, () => E.filas<{ nombre: string }>(`select nombre from alumnos order by nombre`));
    expect(hijos.map((h) => h.nombre)).toEqual(["Sofía Demo", "Tomás Demo"]);
  });

  it("se puede volver a ejecutar: rehace el servicio de demostración", async () => {
    await sembrar();
    expect(await E.filas(`select 1 from empresas where nombre = 'Furgón Demo (revisión)'`)).toHaveLength(1);
    expect(await E.filas(`select 1 from alumnos`)).toHaveLength(4);
  });
});
