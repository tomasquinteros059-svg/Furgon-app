import { useMemo, useState } from "react";
import { datos } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga, Vacio } from "../componentes/ui";
import { pesos } from "../formato";
import { Icono } from "../componentes/Icono";
import { t } from "../i18n";

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
    const texto = `${a.nombre} ${a.curso ?? ""} ${a.domicilio?.direccion ?? ""} ${a.contactos.map((c) => c.nombre).join(" ")}`.toLowerCase();
    return texto.includes(q.toLowerCase());
  }), [alumnos, q, filtro]);

  return (
    <>
      <Encabezado titulo={t("Alumnos")} bajada={t("Agrega aquí a los alumnos de la tía: quedan en su ruta y la familia recibe un código para conectarse.")}
        acciones={<a className="btn bus" href="#/alumnos/nuevo">{t("+ Agregar alumno")}</a>} />
      <ErrorCaja mensaje={error} />
      <div className="filtros">
        <input className="entrada" style={{ maxWidth: 320 }} placeholder={t("Buscar por nombre, curso, dirección…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Buscar alumnos")} />
        <span className="seg" role="group" aria-label={t("Filtro")}>
          {([["activos", t("Activos")], ["sin_ruta", t("Sin ruta")], ["sin_app", t("Familia sin app")], ["bajas", t("Dados de baja")]] as const).map(([k, n]) => (
            <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>
          ))}
        </span>
      </div>
      {!alumnos ? <Cargando /> : lista.length === 0 ? <Vacio>{t("No hay alumnos en esta vista.")}</Vacio> : (
        <div className="tabla-cont">
          <table>
            <thead><tr><th>{t("Alumno")}</th><th>{t("Dirección")}</th><th>{t("Ruta")}</th><th>{t("Familia")}</th><th className="num">{t("Mensualidad")}</th></tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="clic" onClick={() => { location.hash = `#/alumnos/${a.id}`; }}>
                  <td><a href={`#/alumnos/${a.id}`}><b>{a.nombre}</b></a><br /><small className="tenue">{a.curso} · {a.colegio}</small></td>
                  <td>{a.domicilio?.direccion ?? <Chip tono="alerta">{t("Sin dirección")}</Chip>}</td>
                  <td>{a.rutas.length ? <div className="chips">{a.rutas.map((r) => <Chip key={r.id}>{r.nombre}</Chip>)}</div> : a.activo ? <Chip tono="aviso">{t("Sin ruta")}</Chip> : "—"}</td>
                  <td>{a.apoderados.length ? <Chip tono="ok"><Icono n="check" /> {a.apoderados.map((p) => p.nombre).join(", ")}</Chip> : a.activo ? <Chip tono="aviso">{t("Sin app")}</Chip> : "—"}</td>
                  <td className="num">{pesos(a.mensualidad ?? empresa?.mensualidad_defecto ?? 0)}{a.mensualidad == null ? <small className="tenue"> *</small> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tenue" style={{ margin: 0, fontSize: 13 }}>{t("* Mensualidad por defecto de la empresa (se cambia en Configuración).")}</p>
    </>
  );
}
