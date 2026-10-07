import { useState } from "react";
import { datos, type Ruta } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";

export function Rutas() {
  const { valor: rutas, error, recargar } = useCarga(() => datos.rutas());
  const { valor: alumnos, recargar: recargarAlumnos } = useCarga(() => datos.alumnos());
  const { valor: conductoras } = useCarga(() => datos.conductoras());
  const [err, setErr] = useState<string | null>(null);
  const hacer = async (fn: () => Promise<void>) => { try { setErr(null); await fn(); recargar(); recargarAlumnos(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };

  return (
    <>
      <Encabezado titulo="Rutas" bajada="El orden de las paradas es el que sigue la tía y el que usa el sistema para calcular cuándo avisar a cada familia." />
      <ErrorCaja mensaje={error ?? err} />
      {!rutas ? <Cargando /> : rutas.map((r) => <TarjetaRuta key={r.id} r={r} hacer={hacer}
        conductoras={conductoras ?? []}
        disponibles={(alumnos ?? []).filter((a) => a.activo && !r.paradas.some((p) => p.alumno_id === a.id))} />)}
    </>
  );
}

function TarjetaRuta({ r, hacer, conductoras, disponibles }: {
  r: Ruta; hacer: (fn: () => Promise<void>) => void;
  conductoras: { id: string; nombre: string }[]; disponibles: { id: string; nombre: string }[];
}) {
  const [agregar, setAgregar] = useState("");
  return (
    <section className="tarjeta" aria-label={r.nombre}>
      <header>
        <div><h2>{r.tipo === "ida" ? "🌅" : "🏠"} {r.nombre}</h2>
          <span className="tenue">{r.tipo === "ida" ? "Casas → colegio" : "Colegio → casas"}{r.hora_salida ? ` · sale ${r.hora_salida.slice(0, 5)}` : ""}{r.furgon ? ` · ${r.furgon}` : ""}</span></div>
        <label className="campo" style={{ minWidth: 240 }}><span>Conductora</span>
          <select value={r.conductor_id ?? ""} onChange={(e) => hacer(() => datos.asignarConductora(r.id, e.target.value || null))}>
            <option value="">Sin asignar</option>
            {conductoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
      </header>
      {r.paradas.length === 0 ? <p className="tenue">Sin alumnos todavía.</p> : (
        <ol className="paradas">
          {r.paradas.map((p, i) => (
            <li key={p.alumno_id}>
              <span className="n">{i + 1}</span>
              <span><a href={`#/alumnos/${p.alumno_id}`}><b>{p.nombre}</b></a><small>{p.direccion}</small></span>
              <span className="acciones">
                <button className="btn sec chico" aria-label={`Subir a ${p.nombre}`} disabled={i === 0} onClick={() => hacer(() => datos.moverParada(r.id, p.alumno_id, -1))}>↑</button>
                <button className="btn sec chico" aria-label={`Bajar a ${p.nombre}`} disabled={i === r.paradas.length - 1} onClick={() => hacer(() => datos.moverParada(r.id, p.alumno_id, 1))}>↓</button>
                <button className="btn sec chico" onClick={() => hacer(() => datos.quitarDeRuta(r.id, p.alumno_id))}>Quitar</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="filtros">
        <select className="entrada" style={{ maxWidth: 300 }} value={agregar} onChange={(e) => setAgregar(e.target.value)} aria-label={`Agregar alumno a ${r.nombre}`}>
          <option value="">Agregar alumno a esta ruta…</option>
          {disponibles.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <button className="btn sec" disabled={!agregar} onClick={() => { const id = agregar; setAgregar(""); hacer(() => datos.asignarARuta(id, r.id)); }}>Agregar al final</button>
        <Chip tono="info">{r.paradas.length} alumnos</Chip>
      </div>
    </section>
  );
}
