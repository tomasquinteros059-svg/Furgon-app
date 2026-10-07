import { useMemo, useState } from "react";
import { datos, type Alumno, type Cobro, type MedioPago } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, Modal, useCarga, Vacio } from "../componentes/ui";
import { fecha, mesActual, nombreMes, pesos, sumarMes } from "../formato";

const MEDIOS: [MedioPago, string][] = [["transferencia", "Transferencia"], ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"], ["otro", "Otro"]];

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
      <Encabezado titulo="Cobros" bajada="Tu contabilidad: mensualidades por mes. Pon el precio de cada alumno, genera el mes una vez y marca los pagos a medida que llegan."
        acciones={<>
          <button className="btn sec" onClick={() => setPeriodo(sumarMes(periodo, -1))} aria-label="Mes anterior">‹</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{nombreMes(periodo)}</b>
          <button className="btn sec" onClick={() => setPeriodo(sumarMes(periodo, 1))} aria-label="Mes siguiente">›</button>
          <button className="btn bus" onClick={() => hacer(async () => {
            const n = await datos.generarCobros(periodo);
            if (!n) throw new Error("Este mes ya tenía generados los cobros de todos los alumnos activos.");
          }, `Cobros de ${nombreMes(periodo)} generados.`)}>Generar cobros del mes</button>
        </>} />
      {msg ? (msg.ok ? <p className="caja-ok" role="status">{msg.txt}</p> : <ErrorCaja mensaje={msg.txt} />) : null}
      <ErrorCaja mensaje={error} />
      <span className="seg" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={vista === "cobros"} aria-pressed={vista === "cobros"} onClick={() => setVista("cobros")}>Cobros del mes</button>
        <button role="tab" aria-selected={vista === "precios"} aria-pressed={vista === "precios"} onClick={() => setVista("precios")}>Precios</button>
      </span>
      {vista === "precios" ? <Precios periodo={periodo} onCambio={(txt) => { setMsg({ ok: true, txt }); recargar(); }} onError={(txt) => setMsg({ ok: false, txt })} /> : <>
      <section className="kpis">
        <div className="kpi"><b>{pesos(tot((c) => c.estado !== "anulado"))}</b><span>Total del mes</span></div>
        <div className="kpi"><b>{pesos(tot((c) => c.estado === "pagado"))}</b><span>Cobrado</span></div>
        <div className="kpi aviso"><b>{pesos(tot((c) => c.estado === "pendiente"))}</b><span>Pendiente</span></div>
        <div className="kpi alerta"><b>{(cobros ?? []).filter(vencido).length}</b><span>Vencidos</span></div>
      </section>
      <span className="seg" role="group" aria-label="Filtro">
        {([["todos", "Todos"], ["pendientes", "Pendientes"], ["vencidos", "Vencidos"], ["pagados", "Pagados"]] as const).map(([k, n]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}
      </span>
      {!cobros ? <Cargando /> : cobros.length === 0 ? <Vacio>Aún no hay cobros para {nombreMes(periodo)}. Usa «Generar cobros del mes».</Vacio> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>Alumno</th><th className="num">Monto</th><th>Vence</th><th>Estado</th><th>Pago</th><th></th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.id}>
              <td><a href={`#/alumnos/${c.alumno_id}`}>{c.alumno}</a></td>
              <td className="num">{pesos(c.monto)}</td>
              <td>{fecha(c.vence_en)}</td>
              <td>{c.estado === "pagado" ? <Chip tono="ok">Pagado</Chip> : c.estado === "anulado" ? <Chip>Anulado</Chip> : vencido(c) ? <Chip tono="alerta">Vencido</Chip> : <Chip tono="aviso">Pendiente</Chip>}</td>
              <td className="tenue">{c.estado === "pagado" ? `${fecha(c.pagado_en!)} · ${c.medio}${c.nota ? ` · ${c.nota}` : ""}` : c.nota ?? ""}</td>
              <td>{c.estado === "pendiente" ? <span className="acciones">
                <button className="btn ok chico" onClick={() => { setPagar(c); setNota(""); }}>Registrar pago</button>
                <button className="btn sec chico" onClick={() => { setEditar(c); setMonto(String(c.monto)); setNota(""); }}>Cambiar monto</button>
                <button className="btn sec chico" onClick={() => hacer(() => datos.anularCobro(c.id, "Anulado por administración"), "Cobro anulado.")}>Anular</button>
              </span> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      </>}
      {editar ? (
        <Modal titulo={`Monto de ${editar.alumno}`} onCerrar={() => setEditar(null)}>
          <p style={{ margin: 0 }} className="tenue">{nombreMes(editar.periodo.slice(0, 7))} · Solo cambia este cobro. Para cambiar el precio de todos los meses, usa «Precios».</p>
          <label className="campo"><span>Monto (CLP)</span><input id="monto-cobro" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} /></label>
          <label className="campo"><span>Motivo (opcional)</span><input id="nota-monto" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: medio mes, descuento hermanos" /></label>
          <div className="acciones"><button className="btn ok" disabled={!monto} onClick={() => { const c = editar; setEditar(null); hacer(() => datos.cambiarMontoCobro(c.id, Number(monto), nota), `Cobro de ${c.alumno}: ahora ${pesos(Number(monto))}.`); }}>Guardar monto</button><button className="btn sec" onClick={() => setEditar(null)}>Cancelar</button></div>
        </Modal>
      ) : null}
      {pagar ? (
        <Modal titulo={`Pago de ${pagar.alumno}`} onCerrar={() => setPagar(null)}>
          <p style={{ margin: 0 }}><b className="mono">{pesos(pagar.monto)}</b> · {nombreMes(pagar.periodo.slice(0, 7))}</p>
          <label className="campo"><span>Medio de pago</span>
            <select id="medio" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>{MEDIOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="campo"><span>Nota (opcional)</span><input id="nota-pago" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: N° de transferencia" /></label>
          <div className="acciones"><button className="btn ok" onClick={() => { const c = pagar; setPagar(null); hacer(() => datos.registrarPago(c.id, medio, nota.trim()), `Pago de ${c.alumno} registrado.`); }}>Registrar pago</button><button className="btn sec" onClick={() => setPagar(null)}>Cancelar</button></div>
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
      onCambio(`Precio de ${a.nombre}: ${pesos(nuevo)} al mes${n ? ` · se actualizaron ${n} cobro(s) pendiente(s)` : ""}.`);
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <>
      <section className="kpis">
        <div className="kpi"><b>{pesos(total)}</b><span>Ingreso mensual esperado ({activos.length} alumnos)</span></div>
        <div className="kpi"><b>{pesos(empresa.mensualidad_defecto)}</b><span>Precio general · <a href="#/configuracion">cambiar</a></span></div>
      </section>
      <label className="chk" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={aplicarPendientes} onChange={(e) => setAplicarPendientes(e.target.checked)} />
        Aplicar también a los cobros pendientes desde {nombreMes(periodo)}
      </label>
      <div className="tabla-cont"><table>
        <thead><tr><th>Alumno</th><th className="num">Precio mensual</th><th></th></tr></thead>
        <tbody>{activos.map((a) => {
          const editado = valores[a.id];
          const cambia = editado !== undefined && editado !== "" && Number(editado) !== precio(a);
          return (
            <tr key={a.id}>
              <td><a href={`#/alumnos/${a.id}`}>{a.nombre}</a>{a.mensualidad == null ? <> <Chip>Precio general</Chip></> : null}</td>
              <td className="num"><input className="entrada mono" style={{ maxWidth: 130, textAlign: "right" }} inputMode="numeric" aria-label={`Precio mensual de ${a.nombre}`}
                value={editado ?? String(precio(a))} onChange={(e) => setValores({ ...valores, [a.id]: e.target.value.replace(/\D/g, "") })}
                onKeyDown={(e) => { if (e.key === "Enter" && cambia) guardar(a); }} /></td>
              <td><button className="btn ok chico" disabled={!cambia} onClick={() => guardar(a)}>Guardar</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </>
  );
}
