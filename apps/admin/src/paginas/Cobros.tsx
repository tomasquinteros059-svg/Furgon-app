import { useMemo, useState } from "react";
import { datos, type Alumno, type Cobro, type MedioPago } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, Modal, useCarga, Vacio } from "../componentes/ui";
import { fecha, mesActual, nombreMes, pesos, sumarMes } from "../formato";
import { t } from "../i18n";

const medios = (): [MedioPago, string][] => [["transferencia", t("Transferencia")], ["efectivo", t("Efectivo")], ["tarjeta", t("Tarjeta")], ["otro", t("Otro")]];
const nombreMedio = (m: string) => medios().find(([k]) => k === m)?.[1] ?? m;

export function Cobros() {
  const [periodo, setPeriodo] = useState(mesActual());
  const { valor: cobros, error, recargar } = useCarga(() => datos.cobros(periodo), [periodo]);
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "vencidos" | "pagados">("todos");
  const [pagar, setPagar] = useState<Cobro | null>(null);
  const [medio, setMedio] = useState<MedioPago>("transferencia");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [vista, setVista] = useState<"cobros" | "precios">("cobros");
  const [editar, setEditar] = useState<Cobro | null>(null);
  const [monto, setMonto] = useState("");
  const hoy = new Date().toISOString().slice(0, 10);
  const vencido = (c: Cobro) => c.estado === "pendiente" && c.vence_en < hoy;

  const lista = useMemo(() => (cobros ?? []).filter((c) =>
    filtro === "todos" || (filtro === "pendientes" && c.estado === "pendiente") || (filtro === "vencidos" && vencido(c)) || (filtro === "pagados" && c.estado === "pagado")),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [cobros, filtro]);
  const tot = (pred: (c: Cobro) => boolean) => (cobros ?? []).filter(pred).reduce((s, c) => s + c.monto, 0);
  const hacer = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, txt: ok }); recargar(); } catch (e) { setMsg({ ok: false, txt: e instanceof Error ? e.message : String(e) }); }
  };

  return (
    <>
      <Encabezado titulo={t("Cobros")} bajada={t("Tu contabilidad: mensualidades por mes. Pon el precio de cada alumno, genera el mes una vez y marca los pagos a medida que llegan.")}
        acciones={<>
          <button className="btn sec" onClick={() => setPeriodo(sumarMes(periodo, -1))} aria-label={t("Mes anterior")}>‹</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{nombreMes(periodo)}</b>
          <button className="btn sec" onClick={() => setPeriodo(sumarMes(periodo, 1))} aria-label={t("Mes siguiente")}>›</button>
          <button className="btn bus" onClick={() => hacer(async () => {
            const n = await datos.generarCobros(periodo);
            if (!n) throw new Error(t("Este mes ya tenía generados los cobros de todos los alumnos activos."));
          }, t("Cobros de {mes} generados.", { mes: nombreMes(periodo) }))}>{t("Generar cobros del mes")}</button>
        </>} />
      {msg ? (msg.ok ? <p className="caja-ok" role="status">{msg.txt}</p> : <ErrorCaja mensaje={msg.txt} />) : null}
      <ErrorCaja mensaje={error} />
      <span className="seg" role="tablist" aria-label={t("Vista")}>
        <button role="tab" aria-selected={vista === "cobros"} aria-pressed={vista === "cobros"} onClick={() => setVista("cobros")}>{t("Cobros del mes")}</button>
        <button role="tab" aria-selected={vista === "precios"} aria-pressed={vista === "precios"} onClick={() => setVista("precios")}>{t("Precios")}</button>
      </span>
      {vista === "precios" ? <Precios periodo={periodo} onCambio={(txt) => { setMsg({ ok: true, txt }); recargar(); }} onError={(txt) => setMsg({ ok: false, txt })} /> : <>
      <section className="kpis">
        <div className="kpi"><b>{pesos(tot((c) => c.estado !== "anulado"))}</b><span>{t("Total del mes")}</span></div>
        <div className="kpi"><b>{pesos(tot((c) => c.estado === "pagado"))}</b><span>{t("Cobrado")}</span></div>
        <div className="kpi aviso"><b>{pesos(tot((c) => c.estado === "pendiente"))}</b><span>{t("Pendiente")}</span></div>
        <div className="kpi alerta"><b>{(cobros ?? []).filter(vencido).length}</b><span>{t("Vencidos")}</span></div>
      </section>
      <span className="seg" role="group" aria-label={t("Filtro")}>
        {([["todos", t("Todos")], ["pendientes", t("Pendientes")], ["vencidos", t("Vencidos")], ["pagados", t("Pagados")]] as const).map(([k, n]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}
      </span>
      {!cobros ? <Cargando /> : cobros.length === 0 ? <Vacio>{t("Aún no hay cobros para {mes}. Usa «Generar cobros del mes».", { mes: nombreMes(periodo) })}</Vacio> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>{t("Alumno")}</th><th className="num">{t("Monto")}</th><th>{t("Vence")}</th><th>{t("Estado")}</th><th>{t("Pago")}</th><th></th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.id}>
              <td><a href={`#/alumnos/${c.alumno_id}`}>{c.alumno}</a></td>
              <td className="num">{pesos(c.monto)}</td>
              <td>{fecha(c.vence_en)}</td>
              <td>{c.estado === "pagado" ? <Chip tono="ok">{t("Pagado")}</Chip> : c.estado === "anulado" ? <Chip>{t("Anulado")}</Chip> : vencido(c) ? <Chip tono="alerta">{t("Vencido")}</Chip> : <Chip tono="aviso">{t("Pendiente")}</Chip>}</td>
              <td className="tenue">{c.estado === "pagado" ? `${fecha(c.pagado_en!)} · ${nombreMedio(c.medio ?? "")}${c.nota ? ` · ${c.nota}` : ""}` : c.nota ?? ""}</td>
              <td>{c.estado === "pendiente" ? <span className="acciones">
                <button className="btn ok chico" onClick={() => { setPagar(c); setNota(""); }}>{t("Registrar pago")}</button>
                <button className="btn sec chico" onClick={() => { setEditar(c); setMonto(String(c.monto)); setNota(""); }}>{t("Cambiar monto")}</button>
                <button className="btn sec chico" onClick={() => hacer(() => datos.anularCobro(c.id, "Anulado por administración"), t("Cobro anulado."))}>{t("Anular")}</button>
              </span> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      </>}
      {editar ? (
        <Modal titulo={t("Monto de {alumno}", { alumno: editar.alumno })} onCerrar={() => setEditar(null)}>
          <p style={{ margin: 0 }} className="tenue">{nombreMes(editar.periodo.slice(0, 7))} · {t("Solo cambia este cobro. Para cambiar el precio de todos los meses, usa «Precios».")}</p>
          <label className="campo"><span>{t("Monto (CLP)")}</span><input id="monto-cobro" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} /></label>
          <label className="campo"><span>{t("Motivo (opcional)")}</span><input id="nota-monto" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t("Ej: medio mes, descuento hermanos")} /></label>
          <div className="acciones"><button className="btn ok" disabled={!monto} onClick={() => { const c = editar; setEditar(null); hacer(() => datos.cambiarMontoCobro(c.id, Number(monto), nota), t("Cobro de {alumno}: ahora {monto}.", { alumno: c.alumno, monto: pesos(Number(monto)) })); }}>{t("Guardar monto")}</button><button className="btn sec" onClick={() => setEditar(null)}>{t("Cancelar")}</button></div>
        </Modal>
      ) : null}
      {pagar ? (
        <Modal titulo={t("Pago de {alumno}", { alumno: pagar.alumno })} onCerrar={() => setPagar(null)}>
          <p style={{ margin: 0 }}><b className="mono">{pesos(pagar.monto)}</b> · {nombreMes(pagar.periodo.slice(0, 7))}</p>
          <label className="campo"><span>{t("Medio de pago")}</span>
            <select id="medio" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>{medios().map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="campo"><span>{t("Nota (opcional)")}</span><input id="nota-pago" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t("Ej: N° de transferencia")} /></label>
          <div className="acciones"><button className="btn ok" onClick={() => { const c = pagar; setPagar(null); hacer(() => datos.registrarPago(c.id, medio, nota.trim()), t("Pago de {alumno} registrado.", { alumno: c.alumno })); }}>{t("Registrar pago")}</button><button className="btn sec" onClick={() => setPagar(null)}>{t("Cancelar")}</button></div>
        </Modal>
      ) : null}
    </>
  );
}

/** Precio mensual de cada alumno (si no tiene, se cobra el precio general de Configuración). */
function Precios({ periodo, onCambio, onError }: { periodo: string; onCambio: (txt: string) => void; onError: (txt: string) => void }) {
  const { valor: alumnos, recargar } = useCarga(() => datos.alumnos());
  const { valor: empresa } = useCarga(() => datos.empresa());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aplicarPendientes, setAplicarPendientes] = useState(true);
  if (!alumnos || !empresa) return <Cargando />;
  const activos = alumnos.filter((a) => a.activo);
  const precio = (a: Alumno) => a.mensualidad ?? empresa.mensualidad_defecto;
  const total = activos.reduce((s, a) => s + precio(a), 0);
  const guardar = async (a: Alumno) => {
    const nuevo = Number(valores[a.id]);
    try {
      const n = await datos.fijarMensualidad(a.id, nuevo, aplicarPendientes ? periodo : null);
      setValores(({ [a.id]: _, ...resto }) => resto);
      recargar();
      onCambio(n ? t("Precio de {nombre}: {monto} al mes · se actualizaron {n} cobro(s) pendiente(s).", { nombre: a.nombre, monto: pesos(nuevo), n }) : t("Precio de {nombre}: {monto} al mes.", { nombre: a.nombre, monto: pesos(nuevo) }));
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <>
      <section className="kpis">
        <div className="kpi"><b>{pesos(total)}</b><span>{t("Ingreso mensual esperado ({n} alumnos)", { n: activos.length })}</span></div>
        <div className="kpi"><b>{pesos(empresa.mensualidad_defecto)}</b><span>{t("Precio general")} · <a href="#/configuracion">{t("cambiar")}</a></span></div>
      </section>
      <label className="chk" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={aplicarPendientes} onChange={(e) => setAplicarPendientes(e.target.checked)} />
        {t("Aplicar también a los cobros pendientes desde {mes}", { mes: nombreMes(periodo) })}
      </label>
      <div className="tabla-cont"><table>
        <thead><tr><th>{t("Alumno")}</th><th className="num">{t("Precio mensual")}</th><th></th></tr></thead>
        <tbody>{activos.map((a) => {
          const editado = valores[a.id];
          const cambia = editado !== undefined && editado !== "" && Number(editado) !== precio(a);
          return (
            <tr key={a.id}>
              <td><a href={`#/alumnos/${a.id}`}>{a.nombre}</a>{a.mensualidad == null ? <> <Chip>{t("Precio general")}</Chip></> : null}</td>
              <td className="num"><input className="entrada mono" style={{ maxWidth: 130, textAlign: "right" }} inputMode="numeric" aria-label={t("Precio mensual de {nombre}", { nombre: a.nombre })}
                value={editado ?? String(precio(a))} onChange={(e) => setValores({ ...valores, [a.id]: e.target.value.replace(/\D/g, "") })}
                onKeyDown={(e) => { if (e.key === "Enter" && cambia) guardar(a); }} /></td>
              <td><button className="btn ok chico" disabled={!cambia} onClick={() => guardar(a)}>{t("Guardar")}</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </>
  );
}
