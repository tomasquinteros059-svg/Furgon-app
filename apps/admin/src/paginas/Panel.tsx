import { datos } from "../datos";
import { ChipLicencia } from "./Furgones";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { hora, nombreMes, mesActual, pesos } from "../formato";

export function Panel() {
  const { valor: r, error } = useCarga(() => datos.resumen());
  const { valor: recorridos } = useCarga(() => datos.recorridosHoy());
  const { valor: furgones } = useCarga(() => datos.furgones());
  const { valor: licencias } = useCarga(() => datos.licencias());
  if (error) return <ErrorCaja mensaje={error} />;
  if (!r) return <Cargando />;
  const totalMes = r.cobrado_mes + r.por_cobrar_mes;
  const pctCobrado = totalMes ? Math.round((r.cobrado_mes / totalMes) * 100) : 0;
  const totalLlamadas = r.llamadas_app_mes + r.llamadas_telefono_mes;
  const pctApp = totalLlamadas ? Math.round((r.llamadas_app_mes / totalLlamadas) * 100) : 0;
  const licAtencion = (licencias ?? []).filter((l) => l.estado !== "vigente");
  const pendientes = [
    ...licAtencion.map((l) => ({ txt: `Licencia de ${l.conductor}: ${{ por_vencer: `vence en ${l.dias_restantes} días`, vencida: "vencida (no puede iniciar recorridos)", por_verificar: "por verificar", rechazada: "rechazada, debe subirla de nuevo", sin_licencia: "no la ha subido", vigente: "" }[l.estado]}`, ir: "furgones", tono: (l.estado === "por_vencer" || l.estado === "por_verificar" ? "aviso" : "alerta") as "aviso" | "alerta" })),
    r.solicitudes_abiertas && { txt: `${r.solicitudes_abiertas} solicitud(es) de familias sin responder`, ir: "solicitudes", tono: "alerta" as const },
    r.alumnos_sin_ruta && { txt: `${r.alumnos_sin_ruta} alumno(s) sin ruta asignada`, ir: "rutas", tono: "aviso" as const },
    r.familias_sin_app && { txt: `${r.familias_sin_app} familia(s) aún no instalan la app (envíales su código)`, ir: "alumnos", tono: "aviso" as const },
    r.morosos && { txt: `${r.morosos} alumno(s) con mensualidad vencida`, ir: "cobros", tono: "alerta" as const },
  ].filter(Boolean) as { txt: string; ir: string; tono: "alerta" | "aviso" }[];

  return (
    <>
      <Encabezado titulo="Panel" bajada={`${nombreMes(mesActual())} · todo lo que necesita tu atención, en un vistazo.`} />
      <section className="kpis" aria-label="Cifras principales">
        <a className="kpi" href="#/furgones"><b>{furgones ? furgones.filter((f) => f.activo).length : "…"}</b><span>Furgones activos · {r.alumnos_activos} niños</span></a>
        <a className={`kpi ${licAtencion.length ? "alerta" : ""}`} href="#/furgones"><b>{licencias ? licAtencion.length : "…"}</b><span>Licencias que requieren atención</span></a>
        <a className={`kpi ${r.solicitudes_abiertas ? "alerta" : ""}`} href="#/solicitudes"><b>{r.solicitudes_abiertas}</b><span>Solicitudes abiertas</span></a>
        <a className="kpi" href="#/cobros"><b>{pesos(r.cobrado_mes)}</b><span>Cobrado este mes</span></a>
        <a className={`kpi ${r.por_cobrar_mes ? "aviso" : ""}`} href="#/cobros"><b>{pesos(r.por_cobrar_mes)}</b><span>Por cobrar este mes</span></a>
        <a className={`kpi ${r.morosos ? "alerta" : ""}`} href="#/cobros"><b>{r.morosos}</b><span>Alumnos con pago vencido</span></a>
        <a className="kpi" href="#/llamadas"><b>{r.llamadas_telefono_mes}</b><span>Llamadas con costo ({r.minutos_telefono_mes} min)</span></a>
      </section>

      <div className="dos-col">
        <section className="tarjeta" aria-label="Pendientes">
          <header><h2>Pendientes</h2></header>
          {pendientes.length ? (
            <ul className="lista-tareas">
              {pendientes.map((p) => <li key={p.txt}><span><Chip tono={p.tono}>!</Chip> {p.txt}</span><a className="btn sec chico" href={`#/${p.ir}`}>Ver</a></li>)}
            </ul>
          ) : <p className="caja-ok">Todo al día. 🎉</p>}
        </section>
        <section className="tarjeta" aria-label="Recorridos de hoy">
          <header><h2>Recorridos de hoy</h2>{r.recorridos_activos ? <Chip tono="ok">● {r.recorridos_activos} en curso</Chip> : null}</header>
          {!recorridos ? <Cargando /> : recorridos.length === 0 ? <p className="tenue">Aún no parte ningún recorrido hoy.</p> : (
            <ul className="lista-tareas">
              {recorridos.map((x) => (
                <li key={x.id}>
                  <span><b>{x.ruta}</b> · salió {hora(x.iniciado_en)}<br /><small className="tenue">{x.atendidos}/{x.total} alumnos atendidos · {x.avisos} avisos enviados</small></span>
                  {x.estado === "activo" ? <Chip tono="ok">En curso</Chip> : <Chip>Terminado</Chip>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tarjeta" aria-label="Furgones">
        <header><h2>Furgones</h2><a className="btn sec chico" href="#/furgones">Ver todos</a></header>
        {!furgones ? <Cargando /> : (
          <ul className="lista-tareas">
            {furgones.filter((f) => f.activo).map((f) => (
              <li key={f.id}>
                <span><span className="placa" style={{ fontSize: 15, padding: "0 8px", borderWidth: 2 }}>{f.patente}</span> <b>{f.conductor ?? "Sin tía o tío"}</b>
                  <br /><small className="tenue">{f.modelo ?? ""} · {f.alumnos}{f.capacidad ? `/${f.capacidad}` : ""} niños · {f.rutas.join(", ") || "sin rutas"}</small></span>
                <ChipLicencia estado={f.licencia} vence={f.licencia_vence} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="dos-col">
        <section className="tarjeta" aria-label="Cobranza del mes">
          <header><h2>Cobranza del mes</h2><span className="mono">{pctCobrado}%</span></header>
          <div className="barra-dos" role="img" aria-label={`${pctCobrado}% cobrado`}><i style={{ width: `${pctCobrado}%`, background: "var(--ok)" }} /><i style={{ width: `${100 - pctCobrado}%`, background: "var(--bus)" }} /></div>
          <div className="leyenda"><span><i style={{ background: "var(--ok)" }} />Cobrado {pesos(r.cobrado_mes)}</span><span><i style={{ background: "var(--bus)" }} />Pendiente {pesos(r.por_cobrar_mes)}</span></div>
        </section>
        <section className="tarjeta" aria-label="Llamadas del mes">
          <header><h2>Llamadas del mes</h2><span className="mono">{pctApp}% gratis</span></header>
          <div className="barra-dos" role="img" aria-label={`${pctApp}% por la app`}><i style={{ width: `${pctApp}%`, background: "var(--info)" }} /><i style={{ width: `${100 - pctApp}%`, background: "var(--alert)" }} /></div>
          <div className="leyenda"><span><i style={{ background: "var(--info)" }} />Por la app (sin costo) {r.llamadas_app_mes}</span><span><i style={{ background: "var(--alert)" }} />Telefónicas (con costo) {r.llamadas_telefono_mes}</span></div>
        </section>
      </div>
    </>
  );
}
