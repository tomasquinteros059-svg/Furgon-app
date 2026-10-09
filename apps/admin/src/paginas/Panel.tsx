import { datos, type Licencia } from "../datos";
import { ChipLicencia } from "./Furgones";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { hora, nombreMes, mesActual, pesos } from "../formato";
import { Icono } from "../componentes/Icono";
import { t } from "../i18n";

/** Pendiente por la licencia de una conductora, en una frase. */
function textoLicencia(l: Licencia): string {
  const v = { conductor: l.conductor, dias: l.dias_restantes };
  switch (l.estado) {
    case "por_vencer": return t("Licencia de {conductor}: vence en {dias} días", v);
    case "vencida": return t("Licencia de {conductor}: vencida (no puede iniciar recorridos)", v);
    case "por_verificar": return t("Licencia de {conductor}: por verificar", v);
    case "rechazada": return t("Licencia de {conductor}: rechazada, debe subirla de nuevo", v);
    case "sin_licencia": return t("Licencia de {conductor}: no la ha subido", v);
    default: return t("Licencia de {conductor}", v);
  }
}

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
    ...licAtencion.map((l) => ({ txt: textoLicencia(l), ir: "furgones", tono: (l.estado === "por_vencer" || l.estado === "por_verificar" ? "aviso" : "alerta") as "aviso" | "alerta" })),
    r.solicitudes_abiertas && { txt: t("{n} solicitud(es) de familias sin responder", { n: r.solicitudes_abiertas }), ir: "solicitudes", tono: "alerta" as const },
    r.alumnos_sin_ruta && { txt: t("{n} alumno(s) sin ruta asignada", { n: r.alumnos_sin_ruta }), ir: "rutas", tono: "aviso" as const },
    r.familias_sin_app && { txt: t("{n} familia(s) aún no instalan la app (envíales su código)", { n: r.familias_sin_app }), ir: "alumnos", tono: "aviso" as const },
    r.morosos && { txt: t("{n} alumno(s) con mensualidad vencida", { n: r.morosos }), ir: "cobros", tono: "alerta" as const },
  ].filter(Boolean) as { txt: string; ir: string; tono: "alerta" | "aviso" }[];

  return (
    <>
      <Encabezado titulo={t("Panel")} bajada={t("{mes} · todo lo que necesita tu atención, en un vistazo.", { mes: nombreMes(mesActual()) })} />
      <section className="kpis" aria-label={t("Cifras principales")}>
        <a className="kpi" href="#/furgones"><b>{furgones ? furgones.filter((f) => f.activo).length : "…"}</b><span>{t("Furgones activos · {n} niños", { n: r.alumnos_activos })}</span></a>
        <a className={`kpi ${licAtencion.length ? "alerta" : ""}`} href="#/furgones"><b>{licencias ? licAtencion.length : "…"}</b><span>{t("Licencias que requieren atención")}</span></a>
        <a className={`kpi ${r.solicitudes_abiertas ? "alerta" : ""}`} href="#/solicitudes"><b>{r.solicitudes_abiertas}</b><span>{t("Solicitudes abiertas")}</span></a>
        <a className="kpi" href="#/cobros"><b>{pesos(r.cobrado_mes)}</b><span>{t("Cobrado este mes")}</span></a>
        <a className={`kpi ${r.por_cobrar_mes ? "aviso" : ""}`} href="#/cobros"><b>{pesos(r.por_cobrar_mes)}</b><span>{t("Por cobrar este mes")}</span></a>
        <a className={`kpi ${r.morosos ? "alerta" : ""}`} href="#/cobros"><b>{r.morosos}</b><span>{t("Alumnos con pago vencido")}</span></a>
        <a className="kpi" href="#/llamadas"><b>{r.llamadas_telefono_mes}</b><span>{t("Llamadas con costo ({min} min)", { min: r.minutos_telefono_mes })}</span></a>
      </section>

      <div className="dos-col">
        <section className="tarjeta" aria-label={t("Pendientes")}>
          <header><h2>{t("Pendientes")}</h2></header>
          {pendientes.length ? (
            <ul className="lista-tareas">
              {pendientes.map((p) => <li key={p.txt}><span><Chip tono={p.tono}>!</Chip> {p.txt}</span><a className="btn sec chico" href={`#/${p.ir}`}>{t("Ver")}</a></li>)}
            </ul>
          ) : <p className="caja-ok"><Icono n="celebrar" /> {t("Todo al día.")}</p>}
        </section>
        <section className="tarjeta" aria-label={t("Recorridos de hoy")}>
          <header><h2>{t("Recorridos de hoy")}</h2>{r.recorridos_activos ? <Chip tono="ok">● {t("{n} en curso", { n: r.recorridos_activos })}</Chip> : null}</header>
          {!recorridos ? <Cargando /> : recorridos.length === 0 ? <p className="tenue">{t("Aún no parte ningún recorrido hoy.")}</p> : (
            <ul className="lista-tareas">
              {recorridos.map((x) => (
                <li key={x.id}>
                  <span><b>{x.ruta}</b> · {t("salió {hora}", { hora: hora(x.iniciado_en) })}<br /><small className="tenue">{t("{atendidos}/{total} alumnos atendidos · {avisos} avisos enviados", { atendidos: x.atendidos, total: x.total, avisos: x.avisos })}</small></span>
                  {x.estado === "activo" ? <Chip tono="ok">{t("En curso")}</Chip> : <Chip>{t("Terminado")}</Chip>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tarjeta" aria-label={t("Furgones")}>
        <header><h2>{t("Furgones")}</h2><a className="btn sec chico" href="#/furgones">{t("Ver todos")}</a></header>
        {!furgones ? <Cargando /> : (
          <ul className="lista-tareas">
            {furgones.filter((f) => f.activo).map((f) => (
              <li key={f.id}>
                <span><span className="placa" style={{ fontSize: 15, padding: "0 8px", borderWidth: 2 }}>{f.patente}</span> <b>{f.conductor ?? t("Sin tía o tío")}</b>
                  <br /><small className="tenue">{f.modelo ?? ""} · {t("{alumnos} niños", { alumnos: `${f.alumnos}${f.capacidad ? `/${f.capacidad}` : ""}` })} · {f.rutas.join(", ") || t("sin rutas")}</small></span>
                <ChipLicencia estado={f.licencia} vence={f.licencia_vence} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="dos-col">
        <section className="tarjeta" aria-label={t("Cobranza del mes")}>
          <header><h2>{t("Cobranza del mes")}</h2><span className="mono">{pctCobrado}%</span></header>
          <div className="barra-dos" role="img" aria-label={t("{pct}% cobrado", { pct: pctCobrado })}><i style={{ width: `${pctCobrado}%`, background: "var(--ok)" }} /><i style={{ width: `${100 - pctCobrado}%`, background: "var(--bus)" }} /></div>
          <div className="leyenda"><span><i style={{ background: "var(--ok)" }} />{t("Cobrado {monto}", { monto: pesos(r.cobrado_mes) })}</span><span><i style={{ background: "var(--bus)" }} />{t("Pendiente {monto}", { monto: pesos(r.por_cobrar_mes) })}</span></div>
        </section>
        <section className="tarjeta" aria-label={t("Llamadas del mes")}>
          <header><h2>{t("Llamadas del mes")}</h2><span className="mono">{t("{pct}% gratis", { pct: pctApp })}</span></header>
          <div className="barra-dos" role="img" aria-label={t("{pct}% por la app", { pct: pctApp })}><i style={{ width: `${pctApp}%`, background: "var(--info)" }} /><i style={{ width: `${100 - pctApp}%`, background: "var(--alert)" }} /></div>
          <div className="leyenda"><span><i style={{ background: "var(--info)" }} />{t("Por la app (sin costo) {n}", { n: r.llamadas_app_mes })}</span><span><i style={{ background: "var(--alert)" }} />{t("Telefónicas (con costo) {n}", { n: r.llamadas_telefono_mes })}</span></div>
        </section>
      </div>
    </>
  );
}
