import { useState } from "react";
import { datos, type EstadoLicencia, type Furgon, type FurgonEditable, type Licencia } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, Modal, useCarga, Vacio } from "../componentes/ui";

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00`));

/** Situación de la licencia de conducir, en palabras. */
export function ChipLicencia({ estado, vence, dias }: { estado: EstadoLicencia | null; vence: string | null; dias?: number | null }) {
  if (!estado) return <Chip>Sin conductora</Chip>;
  const d = dias ?? (vence ? Math.round((new Date(`${vence}T12:00:00`).getTime() - Date.now()) / 86_400_000) : null);
  switch (estado) {
    case "vigente": return <Chip tono="ok">✓ Licencia vigente{vence ? ` hasta ${fechaLarga(vence)}` : ""}</Chip>;
    case "por_vencer": return <Chip tono="aviso">⚠ Licencia vence en {d} día{d === 1 ? "" : "s"}</Chip>;
    case "vencida": return <Chip tono="alerta">✗ Licencia vencida</Chip>;
    case "por_verificar": return <Chip tono="info">⏳ Licencia por verificar</Chip>;
    case "rechazada": return <Chip tono="alerta">Licencia rechazada</Chip>;
    default: return <Chip tono="alerta">Sin licencia</Chip>;
  }
}

export function Furgones() {
  const { valor: furgones, error, recargar } = useCarga(() => datos.furgones());
  const { valor: licencias, recargar: recargarLic } = useCarga(() => datos.licencias());
  const { valor: conductoras } = useCarga(() => datos.conductoras());
  const { valor: rutas } = useCarga(() => datos.rutas());
  const [editar, setEditar] = useState<FurgonEditable | null>(null);
  const [revisar, setRevisar] = useState<Licencia | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const hacer = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, txt: ok }); recargar(); recargarLic(); } catch (e) { setMsg({ ok: false, txt: e instanceof Error ? e.message : String(e) }); }
  };
  const atencion = (licencias ?? []).filter((l) => l.estado !== "vigente");
  const licDe = (f: Furgon) => licencias?.find((l) => l.conductor_id === f.conductor_id) ?? null;

  return (
    <>
      <Encabezado titulo="Furgones" bajada="Cada furgón con su tía o tío, sus rutas, cuántos niños lleva y la licencia de quien conduce."
        acciones={<button className="btn bus" onClick={() => setEditar({ patente: "", modelo: "", capacidad: 12, conductor_id: null, ruta_ids: [] })}>+ Agregar furgón</button>} />
      {msg ? (msg.ok ? <p className="caja-ok" role="status">{msg.txt}</p> : <ErrorCaja mensaje={msg.txt} />) : null}
      <ErrorCaja mensaje={error} />

      {atencion.length ? (
        <section className="tarjeta" aria-label="Licencias que requieren atención" style={{ borderLeft: "4px solid var(--alert)" }}>
          <header><h2>🪪 Licencias que requieren atención</h2></header>
          <ul className="lista-tareas">
            {atencion.map((l) => (
              <li key={l.conductor_id}>
                <span><b>{l.conductor}</b> <ChipLicencia estado={l.estado} vence={l.vence_en} dias={l.dias_restantes} />
                  {l.motivo_rechazo ? <><br /><small className="tenue">Motivo: {l.motivo_rechazo}</small></> : null}
                  {l.estado === "sin_licencia" ? <><br /><small className="tenue">Pídele que la suba desde su app (Inicio → Mi licencia).</small></> : null}</span>
                {l.licencia_id ? <button className="btn sec chico" onClick={() => setRevisar(l)}>{l.estado === "por_verificar" ? "Revisar" : "Ver"}</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!furgones ? <Cargando /> : furgones.length === 0 ? <Vacio>Aún no hay furgones. Agrega el primero con su patente y su tía o tío.</Vacio> : (
        <div className="furgones">
          {furgones.map((f) => {
            const lic = licDe(f);
            const ocupacion = f.capacidad ? Math.min(100, Math.round((f.alumnos / f.capacidad) * 100)) : 0;
            return (
              <section key={f.id} className={`tarjeta furgon ${f.activo ? "" : "inactivo"}`} aria-label={`Furgón ${f.patente}`}>
                <header>
                  <div className="placa" aria-label={`Patente ${f.patente}`}>{f.patente}</div>
                  {!f.activo ? <Chip>Inactivo</Chip> : null}
                </header>
                <div>
                  <b>{f.modelo ?? "Furgón"}</b>
                  <div className="tenue">{f.conductor ? `🧑‍✈️ ${f.conductor}` : "Sin tía o tío asignado"}</div>
                </div>
                <div>
                  <div className="fila-sep"><span>Niños</span><b className="mono">{f.alumnos}{f.capacidad ? ` / ${f.capacidad}` : ""}</b></div>
                  {f.capacidad ? <div className="barra-dos" role="img" aria-label={`${ocupacion}% de ocupación`}><i style={{ width: `${ocupacion}%`, background: ocupacion >= 100 ? "var(--alert)" : "var(--bus)" }} /><i style={{ width: `${100 - ocupacion}%`, background: "var(--surface-2)" }} /></div> : null}
                </div>
                <div className="filtros">{f.rutas.length ? f.rutas.map((r) => <Chip key={r} tono="info">{r}</Chip>) : <span className="tenue">Sin rutas</span>}</div>
                <div><ChipLicencia estado={f.licencia} vence={f.licencia_vence} /></div>
                <div className="acciones">
                  <button className="btn sec chico" onClick={() => setEditar({
                    id: f.id, patente: f.patente, modelo: f.modelo ?? "", capacidad: f.capacidad, conductor_id: f.conductor_id, activo: f.activo,
                    ruta_ids: (rutas ?? []).filter((r) => f.rutas.includes(r.nombre)).map((r) => r.id),
                  })}>Editar</button>
                  {lic?.licencia_id ? <button className="btn sec chico" onClick={() => setRevisar(lic)}>Licencia</button> : null}
                  <a className="btn sec chico" href="#/rutas">Rutas</a>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editar ? <ModalFurgon f={editar} conductoras={conductoras ?? []} rutas={(rutas ?? []).map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo }))}
        onCerrar={() => setEditar(null)}
        onGuardar={(f) => { setEditar(null); hacer(() => datos.guardarFurgon(f), `Furgón ${f.patente.toUpperCase()} guardado.`); }} /> : null}
      {revisar ? <ModalLicencia l={revisar} onCerrar={() => setRevisar(null)}
        onRevisar={(aprobar, motivo) => { const l = revisar; setRevisar(null); hacer(() => datos.revisarLicencia(l.licencia_id!, aprobar, motivo), aprobar ? `Licencia de ${l.conductor} aprobada.` : `Licencia de ${l.conductor} rechazada: se le pedirá subirla de nuevo.`); }} /> : null}
    </>
  );
}

function ModalFurgon({ f, conductoras, rutas, onCerrar, onGuardar }: {
  f: FurgonEditable; conductoras: { id: string; nombre: string }[]; rutas: { id: string; nombre: string; tipo: string }[];
  onCerrar: () => void; onGuardar: (f: FurgonEditable) => void;
}) {
  const [v, setV] = useState(f);
  return (
    <Modal titulo={f.id ? `Furgón ${f.patente}` : "Agregar furgón"} onCerrar={onCerrar}>
      <div className="dos">
        <label className="campo"><span>Patente</span><input value={v.patente} onChange={(e) => setV({ ...v, patente: e.target.value.toUpperCase() })} placeholder="ABCD-12" /></label>
        <label className="campo"><span>Capacidad (asientos)</span><input inputMode="numeric" value={v.capacidad ?? ""} onChange={(e) => setV({ ...v, capacidad: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} /></label>
      </div>
      <label className="campo"><span>Modelo y color</span><input value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder="Hyundai H1 blanca" /></label>
      <label className="campo"><span>Tía o tío a cargo</span>
        <select value={v.conductor_id ?? ""} onChange={(e) => setV({ ...v, conductor_id: e.target.value || null })}>
          <option value="">Sin asignar</option>
          {conductoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}><span>Rutas que hace este furgón</span>
        <div className="filtros">{rutas.map((r) => (
          <label key={r.id} className="chk"><input type="checkbox" checked={v.ruta_ids.includes(r.id)}
            onChange={(e) => setV({ ...v, ruta_ids: e.target.checked ? [...v.ruta_ids, r.id] : v.ruta_ids.filter((x) => x !== r.id) })} /> {r.tipo === "ida" ? "🌅" : "🏠"} {r.nombre}</label>
        ))}</div></fieldset>
      {f.id ? <label className="chk"><input type="checkbox" checked={v.activo ?? true} onChange={(e) => setV({ ...v, activo: e.target.checked })} /> Furgón activo</label> : null}
      <div className="acciones"><button className="btn ok" disabled={!v.patente.trim()} onClick={() => onGuardar(v)}>Guardar</button><button className="btn sec" onClick={onCerrar}>Cancelar</button></div>
    </Modal>
  );
}

function ModalLicencia({ l, onCerrar, onRevisar }: { l: Licencia; onCerrar: () => void; onRevisar: (aprobar: boolean, motivo: string) => void }) {
  const { valor: fotos } = useCarga(async () => Promise.all([l.foto_frente, l.foto_reverso].map((p) => (p ? datos.fotoLicencia(p) : Promise.resolve(null)))));
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  return (
    <Modal titulo={`Licencia de ${l.conductor}`} onCerrar={onCerrar}>
      <div className="fotos-licencia">
        {!fotos ? <Cargando /> : fotos.map((u, i) => u ? <a key={i} href={u} target="_blank" rel="noopener"><img src={u} alt={i ? "Reverso de la licencia" : "Frente de la licencia"} /></a> : null)}
      </div>
      <dl className="datos-lic">
        <div><dt>Número</dt><dd className="mono">{l.numero}</dd></div>
        <div><dt>Clase</dt><dd>{l.clase}</dd></div>
        <div><dt>Vence</dt><dd>{l.vence_en ? fechaLarga(l.vence_en) : "—"}</dd></div>
        <div><dt>Situación</dt><dd><ChipLicencia estado={l.estado} vence={l.vence_en} dias={l.dias_restantes} /></dd></div>
      </dl>
      <p className="tenue" style={{ margin: 0 }}>Comprueba que el nombre, la clase (A1 o A3 para transporte escolar) y el vencimiento coincidan con la foto.</p>
      {l.estado === "por_verificar" ? (rechazando ? (
        <>
          <label className="campo"><span>Motivo del rechazo (lo verá la tía)</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: la foto está borrosa" /></label>
          <div className="acciones"><button className="btn peligro" disabled={!motivo.trim()} onClick={() => onRevisar(false, motivo)}>Rechazar licencia</button><button className="btn sec" onClick={() => setRechazando(false)}>Volver</button></div>
        </>
      ) : (
        <div className="acciones"><button className="btn ok" onClick={() => onRevisar(true, "")}>✓ Aprobar licencia</button><button className="btn sec" onClick={() => setRechazando(true)}>Rechazar…</button></div>
      )) : <div className="acciones"><button className="btn sec" onClick={onCerrar}>Cerrar</button></div>}
    </Modal>
  );
}
