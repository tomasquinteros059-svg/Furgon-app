import { useMemo, useState } from "react";
import { datos } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga, Vacio } from "../componentes/ui";
import { pesos } from "../formato";
import { Icono } from "../componentes/Icono";

type Filtro = "activos" | "sin_ruta" | "sin_app" | "bajas";

export function Alumnos() {
  const { valor: alumnos, error } = useCarga(() => datos.alumnos());
  const { valor: empresa } = useCarga(() => datos.empresa());
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const lista = useMemo(() => (alumnos ?? []).filter((a) => {
    if (filtro === "bajas" ? a.activo : !a.activo) return false;
    if (filtro === "sin_ruta" && a.rutas.length) return false;
    if (filtro === "sin_app" && a.apoderados.length) return false;
    const t = `${a.nombre} ${a.curso ?? ""} ${a.domicilio?.direccion ?? ""} ${a.contactos.map((c) => c.nombre).join(" ")}`.toLowerCase();
    return t.includes(q.toLowerCase());
  }), [alumnos, q, filtro]);

  return (
    <>
      <Encabezado titulo="Alumnos" bajada="Agrega aquí a los alumnos de la tía: quedan en su ruta y la familia recibe un código para conectarse."
        acciones={<a className="btn bus" href="#/alumnos/nuevo">+ Agregar alumno</a>} />
      <ErrorCaja mensaje={error} />
      <div className="filtros">
        <input className="entrada" style={{ maxWidth: 320 }} placeholder="Buscar por nombre, curso, dirección…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alumnos" />
        <span className="seg" role="group" aria-label="Filtro">
          {([["activos", "Activos"], ["sin_ruta", "Sin ruta"], ["sin_app", "Familia sin app"], ["bajas", "Dados de baja"]] as const).map(([k, n]) => (
            <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>
          ))}
        </span>
      </div>
      {!alumnos ? <Cargando /> : lista.length === 0 ? <Vacio>No hay alumnos en esta vista.</Vacio> : (
        <div className="tabla-cont">
          <table>
            <thead><tr><th>Alumno</th><th>Dirección</th><th>Ruta</th><th>Familia</th><th className="num">Mensualidad</th></tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="clic" onClick={() => { location.hash = `#/alumnos/${a.id}`; }}>
                  <td><a href={`#/alumnos/${a.id}`}><b>{a.nombre}</b></a><br /><small className="tenue">{a.curso} · {a.colegio}</small></td>
                  <td>{a.domicilio?.direccion ?? <Chip tono="alerta">Sin dirección</Chip>}</td>
                  <td>{a.rutas.length ? <div className="chips">{a.rutas.map((r) => <Chip key={r.id}>{r.nombre}</Chip>)}</div> : a.activo ? <Chip tono="aviso">Sin ruta</Chip> : "—"}</td>
                  <td>{a.apoderados.length ? <Chip tono="ok"><Icono n="check" /> {a.apoderados.map((p) => p.nombre).join(", ")}</Chip> : a.activo ? <Chip tono="aviso">Sin app</Chip> : "—"}</td>
                  <td className="num">{pesos(a.mensualidad ?? empresa?.mensualidad_defecto ?? 0)}{a.mensualidad == null ? <small className="tenue"> *</small> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tenue" style={{ margin: 0, fontSize: 13 }}>* Mensualidad por defecto de la empresa (se cambia en Configuración).</p>
    </>
  );
}
