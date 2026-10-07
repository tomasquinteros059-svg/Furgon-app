// Cola persistente de posiciones en SQLite: sobrevive a cierres de la app y a la falta de señal.
import * as SQLite from "expo-sqlite";
import type { AlmacenCola, PosicionGps } from "../lib/core";

const db = SQLite.openDatabaseSync("furgon.db");
db.execSync(`
  create table if not exists cola_posiciones (
    client_id text primary key not null,
    recorrido_id text not null,
    ts integer not null,
    lat real not null,
    lng real not null,
    precision_m real,
    velocidad_ms real,
    rumbo real
  );
  create index if not exists cola_posiciones_ts on cola_posiciones (ts);
`);

interface Fila {
  client_id: string;
  recorrido_id: string;
  ts: number;
  lat: number;
  lng: number;
  precision_m: number | null;
  velocidad_ms: number | null;
  rumbo: number | null;
}

export const colaSqlite: AlmacenCola = {
  async agregar(posiciones: PosicionGps[]) {
    for (const p of posiciones) {
      await db.runAsync(
        `insert or ignore into cola_posiciones values (?, ?, ?, ?, ?, ?, ?, ?)`,
        p.clientId, p.recorridoId, p.registradaEnMs, p.lat, p.lng, p.precisionM, p.velocidadMs, p.rumbo,
      );
    }
  },
  async tomar(n: number) {
    const filas = await db.getAllAsync<Fila>(`select * from cola_posiciones order by ts limit ?`, n);
    return filas.map((f) => ({
      clientId: f.client_id,
      recorridoId: f.recorrido_id,
      registradaEnMs: f.ts,
      lat: f.lat,
      lng: f.lng,
      precisionM: f.precision_m,
      velocidadMs: f.velocidad_ms,
      rumbo: f.rumbo,
    }));
  },
  async eliminar(clientIds: string[]) {
    if (clientIds.length === 0) return;
    await db.runAsync(
      `delete from cola_posiciones where client_id in (${clientIds.map(() => "?").join(",")})`,
      ...clientIds,
    );
  },
  async contar() {
    const r = await db.getFirstAsync<{ n: number }>(`select count(*) as n from cola_posiciones`);
    return r?.n ?? 0;
  },
};
