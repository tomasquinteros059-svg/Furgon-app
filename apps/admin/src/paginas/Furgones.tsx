import { useState } from "react";
import { datos, type Documento, type EstadoLicencia, type Furgon, type FurgonEditable, type Licencia } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, Modal, useCarga, Vacio } from "../componentes/ui";
import { Icono } from "../componentes/Icono";
import { locale, t } from "../i18n";

const fechaLarga = (iso: string) => new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00`));

/** Situación de la licencia de conducir, en palabras. */
export function ChipLicencia({ estado, vence, dias }: { estado: EstadoLicencia | null; vence: string | null; dias?: number | null }) {
  if (!estado) return <Chip>{t("Sin conductora")}</Chip>;
  const d = dias ?? (vence ? Math.round((new Date(`${vence}T12:00:00`).getTime() - Date.now()) / 86_400_000) : null);
  switch (estado) {
    case "vigente": return <Chip tono="ok"><Icono n="confirmado" /> {vence ? t("Licencia vigente hasta {fecha}", { fecha: fechaLarga(vence) }) : t("Licencia vigente")}</Chip>;
    case "por_vencer": return <Chip tono="aviso"><Icono n="alerta" /> {d === 1 ? t("Licencia vence en {d} día", { d }) : t("Licencia vence en {d} días", { d })}</Chip>;
    case "vencida": return <Chip tono="alerta"><Icono n="error" /> {t("Licencia vencida")}</Chip>;
    case "por_verificar": return <Chip tono="info"><Icono n="pendiente" /> {t("Licencia por verificar")}</Chip>;
    case "rechazada": return <Chip tono="alerta"><Icono n="prohibido" /> {t("Licencia rechazada")}</Chip>;
    default: return <Chip tono="alerta"><Icono n="licencia" /> {t("Sin licencia")}</Chip>;
  }
}

/** Nombre de cada documento (catálogo en tipos_documento()). */
export function nombreDocumento(tipo: string): string {
  return ({
    padron: t("Padrón del furgón"),
    permiso_circulacion: t("Permiso de circulación"),
    revision_tecnica: t("Revisión técnica"),
    soap: t("SOAP"),
    registro_escolar: t("Registro de transporte escolar"),
    seguro_pasajeros: t("Seguro de pasajeros"),
    antecedentes: t("Certificado de antecedentes"),
    inhabilidades: t("Inhabilidades para trabajar con menores"),
  } as Record<string, string>)[tipo] ?? tipo;
}

function ChipDocumento({ d }: { d: Documento }) {
  switch (d.estado) {
    case "vigente": return <Chip tono="ok"><Icono n="confirmado" /> {d.vence_en ? t("Al día hasta {fecha}", { fecha: fechaLarga(d.vence_en) }) : t("Al día")}</Chip>;
    case "por_vencer": return <Chip tono="aviso"><Icono n="alerta" /> {d.dias_restantes === 1 ? t("Vence en {d} día", { d: d.dias_restantes }) : t("Vence en {d} días", { d: d.dias_restantes ?? 0 })}</Chip>;
    case "vencido": return <Chip tono="alerta"><Icono n="error" /> {t("Vencido")}</Chip>;
    case "por_verificar": return <Chip tono="info"><Icono n="pendiente" /> {t("Por revisar")}</Chip>;
    case "rechazado": return <Chip tono="alerta"><Icono n="prohibido" /> {t("Rechazado")}</Chip>;
    default: return <Chip tono={d.obligatorio ? "alerta" : "neutro"}>{d.obligatorio ? t("Falta") : t("Opcional · no subido")}</Chip>;
  }
}

/** Resultado de comparar la selfie con la foto de la licencia. */
function ChipRostro({ l }: { l: Licencia }) {
  const pct = l.rostro_similitud != null ? ` · ${Math.round(l.rostro_similitud)} %` : "";
  switch (l.rostro_resultado) {
    case "coincide": return <Chip tono="ok"><Icono n="confirmado" /> {t("La cara coincide con la licencia")}{pct}</Chip>;
    case "dudoso": return <Chip tono="aviso"><Icono n="alerta" /> {t("Comparación dudosa: revisa las fotos")}{pct}</Chip>;
    case "no_coincide": return <Chip tono="alerta"><Icono n="error" /> {t("La cara no coincide con la licencia")}{pct}</Chip>;
    case "sin_rostro": return <Chip tono="alerta"><Icono n="error" /> {t("No se ve una cara en alguna foto")}</Chip>;
    case "pendiente": return <Chip tono="info"><Icono n="pendiente" /> {t("Comparando…")}</Chip>;
    case "sin_servicio": case "error": return <Chip>{t("Compara las fotos a simple vista")}</Chip>;
    default: return <Chip>{t("Sin foto de la cara")}</Chip>;
  }
}

export function Furgones() {
  const { valor: furgones, error, recargar } = useCarga(() => datos.furgones());
  const { valor: licencias, recargar: recargarLic } = useCarga(() => datos.licencias());
  const { valor: conductoras } = useCarga(() => datos.conductoras());
  const { valor: rutas } = useCarga(() => datos.rutas());
  const [editar, setEditar] = useState<FurgonEditable | null>(null);
  const [revisar, setRevisar] = useState<Licencia | null>(null);
  const { valor: documentos, recargar: recargarDocs } = useCarga(() => datos.documentos());
  const [revisarDoc, setRevisarDoc] = useState<Documento | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const hacer = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, txt: ok }); recargar(); recargarLic(); recargarDocs(); } catch (e) { setMsg({ ok: false, txt: e instanceof Error ? e.message : String(e) }); }
  };
  const atencion = (licencias ?? []).filter((l) => l.estado !== "vigente");
  const docsAtencion = (documentos ?? []).filter((d) => d.obligatorio && d.estado !== "vigente");
  const licDe = (f: Furgon) => licencias?.find((l) => l.conductor_id === f.conductor_id) ?? null;

  return (
    <>
      <Encabezado titulo={t("Furgones")} bajada={t("Cada furgón con su tía o tío, sus rutas, cuántos niños lleva y la licencia de quien conduce.")}
        acciones={<>
          <a className="btn sec" href="#/alumnos">{t("Ver alumnos")}</a>
          <a className="btn sec" href="#/alumnos/nuevo">{t("+ Agregar alumno")}</a>
          <button className="btn bus" onClick={() => setEditar({ patente: "", modelo: "", capacidad: 12, conductor_id: null, ruta_ids: [] })}>{t("+ Agregar furgón")}</button>
        </>} />
      {msg ? (msg.ok ? <p className="caja-ok" role="status">{msg.txt}</p> : <ErrorCaja mensaje={msg.txt} />) : null}
      <ErrorCaja mensaje={error} />

      {atencion.length ? (
        <section className="tarjeta" aria-label={t("Licencias que requieren atención")} style={{ borderLeft: "4px solid var(--alert)" }}>
          <header><h2><Icono n="licencia" /> {t("Licencias que requieren atención")}</h2></header>
          <ul className="lista-tareas">
            {atencion.map((l) => (
              <li key={l.conductor_id}>
                <span><b>{l.conductor}</b> <ChipLicencia estado={l.estado} vence={l.vence_en} dias={l.dias_restantes} />
                  {l.motivo_rechazo ? <><br /><small className="tenue">{t("Motivo: {motivo}", { motivo: l.motivo_rechazo })}</small></> : null}
                  {l.estado === "sin_licencia" ? <><br /><small className="tenue">{t("Pídele que la suba desde su app (Inicio → Mi licencia).")}</small></> : null}</span>
                {l.licencia_id ? <button className="btn sec chico" onClick={() => setRevisar(l)}>{l.estado === "por_verificar" ? t("Revisar") : t("Ver")}</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {docsAtencion.length ? (
        <section className="tarjeta" aria-label={t("Documentos que requieren atención")} style={{ borderLeft: "4px solid var(--alert)" }}>
          <header><h2><Icono n="licencia" /> {t("Documentos que requieren atención")}</h2></header>
          <p className="tenue" style={{ margin: 0 }}>{t("Con un documento obligatorio vencido, la tía o el tío no puede iniciar recorridos.")}</p>
          <ul className="lista-tareas">
            {docsAtencion.map((d) => (
              <li key={`${d.tipo}-${d.furgon_id ?? d.conductor_id}`}>
                <span><b>{nombreDocumento(d.tipo)}</b> · {d.patente ?? d.conductor ?? ""} <ChipDocumento d={d} />
                  {d.motivo_rechazo ? <><br /><small className="tenue">{t("Motivo: {motivo}", { motivo: d.motivo_rechazo })}</small></> : null}
                  {d.estado === "sin_documento" ? <><br /><small className="tenue">{t("Pídele que lo suba desde su app (Más → Documentos del furgón).")}</small></> : null}</span>
                {d.documento_id ? <button className="btn sec chico" onClick={() => setRevisarDoc(d)}>{d.estado === "por_verificar" ? t("Revisar") : t("Ver")}</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!furgones ? <Cargando />

        : furgones.length === 0 ? <Vacio>{t("Aún no hay furgones. Agrega el primero con su patente y su tía o tío.")}</Vacio> : (
        <div className="furgones">
          {furgones.map((f) => {
            const lic = licDe(f);
            const ocupacion = f.capacidad ? Math.min(100, Math.round((f.alumnos / f.capacidad) * 100)) : 0;
            return (
              <section key={f.id} className={`tarjeta furgon ${f.activo ? "" : "inactivo"}`} aria-label={t("Furgón {patente}", { patente: f.patente })}>
                <header>
                  <div className="placa" aria-label={t("Patente {patente}", { patente: f.patente })}>{f.patente}</div>
                  {!f.activo ? <Chip>{t("Inactivo")}</Chip> : null}
                </header>
                <div>
                  <b>{f.modelo ?? t("Furgón")}</b>
                  <div className="tenue">{f.conductor ? <><Icono n="conductora" /> {f.conductor}</> : t("Sin tía o tío asignado")}</div>
                </div>
                <div>
                  <div className="fila-sep"><span>{t("Niños")}</span><b className="mono">{f.alumnos}{f.capacidad ? ` / ${f.capacidad}` : ""}</b></div>
                  {f.capacidad ? <div className="barra-dos" role="img" aria-label={t("{pct}% de ocupación", { pct: ocupacion })}><i style={{ width: `${ocupacion}%`, background: ocupacion >= 100 ? "var(--alert)" : "var(--bus)" }} /><i style={{ width: `${100 - ocupacion}%`, background: "var(--surface-2)" }} /></div> : null}
                </div>
                <div className="filtros">{f.rutas.length ? f.rutas.map((r) => <Chip key={r} tono="info">{r}</Chip>) : <span className="tenue">{t("Sin rutas")}</span>}</div>
                <div><ChipLicencia estado={f.licencia} vence={f.licencia_vence} /></div>
                <div className="acciones">
                  <button className="btn sec chico" onClick={() => setEditar({
                    id: f.id, patente: f.patente, modelo: f.modelo ?? "", capacidad: f.capacidad, conductor_id: f.conductor_id, activo: f.activo,
                    ruta_ids: (rutas ?? []).filter((r) => r.furgon_id === f.id).map((r) => r.id),
                  })}>{t("Editar")}</button>
                  {lic?.licencia_id ? <button className="btn sec chico" onClick={() => setRevisar(lic)}>{t("Licencia")}</button> : null}
                  <a className="btn sec chico" href="#/rutas">{t("Rutas")}</a>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editar ? <ModalFurgon f={editar} conductoras={conductoras ?? []} rutas={(rutas ?? []).map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo }))}
        onCerrar={() => setEditar(null)}
        onGuardar={(f) => {
          if (f.capacidad != null && (f.capacidad < 1 || f.capacidad > 60)) return hacer(async () => { throw new Error(t("La capacidad debe estar entre 1 y 60 asientos.")); }, "");
          setEditar(null); hacer(() => datos.guardarFurgon(f), t("Furgón {patente} guardado.", { patente: f.patente.toUpperCase() })); }} /> : null}
      {revisarDoc ? <ModalDocumento d={revisarDoc} onCerrar={() => setRevisarDoc(null)}
        onRevisar={(aprobar, motivo) => { const d = revisarDoc; setRevisarDoc(null); hacer(() => datos.revisarDocumento(d.documento_id!, aprobar, motivo), aprobar ? t("{documento} aprobado.", { documento: nombreDocumento(d.tipo) }) : t("{documento} rechazado: se le pedirá subirlo de nuevo.", { documento: nombreDocumento(d.tipo) })); }} /> : null}
      {revisar ? <ModalLicencia l={revisar} onCerrar={() => setRevisar(null)}
        onRevisar={(aprobar, motivo) => { const l = revisar; setRevisar(null); hacer(() => datos.revisarLicencia(l.licencia_id!, aprobar, motivo), aprobar ? t("Licencia de {conductor} aprobada.", { conductor: l.conductor }) : t("Licencia de {conductor} rechazada: se le pedirá subirla de nuevo.", { conductor: l.conductor })); }} /> : null}
    </>
  );
}

function ModalFurgon({ f, conductoras, rutas, onCerrar, onGuardar }: {
  f: FurgonEditable; conductoras: { id: string; nombre: string }[]; rutas: { id: string; nombre: string; tipo: string }[];
  onCerrar: () => void; onGuardar: (f: FurgonEditable) => void;
}) {
  const [v, setV] = useState(f);
  return (
    <Modal titulo={f.id ? t("Furgón {patente}", { patente: f.patente }) : t("Agregar furgón")} onCerrar={onCerrar}>
      <div className="dos">
        <label className="campo"><span>{t("Patente")}</span><input value={v.patente} onChange={(e) => setV({ ...v, patente: e.target.value.toUpperCase() })} placeholder="ABCD-12" /></label>
        <label className="campo"><span>{t("Capacidad (asientos)")}</span><input inputMode="numeric" value={v.capacidad ?? ""} onChange={(e) => setV({ ...v, capacidad: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} /></label>
      </div>
      <label className="campo"><span>{t("Modelo y color")}</span><input value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder={t("Hyundai H1 blanca")} /></label>
      <label className="campo"><span>{t("Tía o tío a cargo")}</span>
        <select value={v.conductor_id ?? ""} onChange={(e) => setV({ ...v, conductor_id: e.target.value || null })}>
          <option value="">{t("Sin asignar")}</option>
          {conductoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}><span>{t("Rutas que hace este furgón")}</span>
        <div className="filtros">{rutas.map((r) => (
          <label key={r.id} className="chk"><input type="checkbox" checked={v.ruta_ids.includes(r.id)}
            onChange={(e) => setV({ ...v, ruta_ids: e.target.checked ? [...v.ruta_ids, r.id] : v.ruta_ids.filter((x) => x !== r.id) })} /> <Icono n={r.tipo === "ida" ? "ida" : "casa"} /> {r.nombre}</label>
        ))}</div></fieldset>
      {f.id ? <label className="chk"><input type="checkbox" checked={v.activo ?? true} onChange={(e) => setV({ ...v, activo: e.target.checked })} /> {t("Furgón activo")}</label> : null}
      <div className="acciones"><button className="btn ok" disabled={!v.patente.trim()} onClick={() => onGuardar(v)}>{t("Guardar")}</button><button className="btn sec" onClick={onCerrar}>{t("Cancelar")}</button></div>
    </Modal>
  );
}

function ModalLicencia({ l, onCerrar, onRevisar }: { l: Licencia; onCerrar: () => void; onRevisar: (aprobar: boolean, motivo: string) => void }) {
  const { valor: fotos } = useCarga(async () => Promise.all([l.foto_frente, l.foto_reverso, l.foto_rostro ?? null].map((p) => (p ? datos.fotoLicencia(p) : Promise.resolve(null)))));
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  return (
    <Modal titulo={t("Licencia de {conductor}", { conductor: l.conductor })} onCerrar={onCerrar}>
      <div className="fotos-licencia">
        {!fotos ? <Cargando /> : fotos.map((u, i) => u ? <a key={i} href={u} target="_blank" rel="noopener"><img src={u} alt={i === 2 ? t("Foto de la cara de quien conduce") : i ? t("Reverso de la licencia") : t("Frente de la licencia")} /></a> : null)}
      </div>
      <p style={{ margin: 0 }}><ChipRostro l={l} /></p>
      <dl className="datos-lic">
        <div><dt>{t("Número")}</dt><dd className="mono">{l.numero}</dd></div>
        <div><dt>{t("Clase")}</dt><dd>{l.clase}</dd></div>
        <div><dt>{t("Vencimiento")}</dt><dd>{l.vence_en ? fechaLarga(l.vence_en) : "—"}</dd></div>
        <div><dt>{t("Situación")}</dt><dd><ChipLicencia estado={l.estado} vence={l.vence_en} dias={l.dias_restantes} /></dd></div>
      </dl>
      <p className="tenue" style={{ margin: 0 }}>{t("Comprueba que el nombre, la clase (A1 o A3 para transporte escolar) y el vencimiento coincidan con la foto, y que la cara de la selfie sea la de la licencia.")}</p>
      {l.estado === "por_verificar" ? (rechazando ? (
        <>
          <label className="campo"><span>{t("Motivo del rechazo (lo verá la tía)")}</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("Ej: la foto está borrosa")} /></label>
          <div className="acciones"><button className="btn peligro" disabled={!motivo.trim()} onClick={() => onRevisar(false, motivo)}>{t("Rechazar licencia")}</button><button className="btn sec" onClick={() => setRechazando(false)}>{t("Volver")}</button></div>
        </>
      ) : (
        <div className="acciones"><button className="btn ok" onClick={() => onRevisar(true, "")}><Icono n="check" /> {t("Aprobar licencia")}</button><button className="btn sec" onClick={() => setRechazando(true)}>{t("Rechazar…")}</button></div>
      )) : <div className="acciones"><button className="btn sec" onClick={onCerrar}>{t("Cerrar")}</button></div>}
    </Modal>
  );
}

function ModalDocumento({ d, onCerrar, onRevisar }: { d: Documento; onCerrar: () => void; onRevisar: (aprobar: boolean, motivo: string) => void }) {
  const { valor: url } = useCarga(async () => (d.archivo ? datos.archivoDocumento(d.archivo) : null));
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const cargando = !url && !!d.archivo;
  const imagen = url ? <a href={url} target="_blank" rel="noopener"><img src={url} alt={nombreDocumento(d.tipo)} /></a> : null;
  return (
    <Modal titulo={`${nombreDocumento(d.tipo)} · ${d.patente ?? d.conductor ?? ""}`} onCerrar={onCerrar}>
      <div className="fotos-licencia">{cargando ? <Cargando /> : imagen}</div>
      <dl className="datos-lic">
        <div><dt>{t("Vencimiento")}</dt><dd>{d.vence_en ? fechaLarga(d.vence_en) : "—"}</dd></div>
        <div><dt>{t("Situación")}</dt><dd><ChipDocumento d={d} /></dd></div>
      </dl>
      <p className="tenue" style={{ margin: 0 }}>{t("Comprueba que el documento sea del furgón (patente) o de la persona correcta, que se lea bien y que la fecha coincida.")}</p>
      {d.estado === "por_verificar" ? (rechazando ? (
        <>
          <label className="campo"><span>{t("Motivo del rechazo (lo verá la tía)")}</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("Ej: la foto está borrosa")} /></label>
          <div className="acciones"><button className="btn peligro" disabled={!motivo.trim()} onClick={() => onRevisar(false, motivo)}>{t("Rechazar documento")}</button><button className="btn sec" onClick={() => setRechazando(false)}>{t("Volver")}</button></div>
        </>
      ) : (
        <div className="acciones"><button className="btn ok" onClick={() => onRevisar(true, "")}><Icono n="check" /> {t("Aprobar documento")}</button><button className="btn sec" onClick={() => setRechazando(true)}>{t("Rechazar…")}</button></div>
      )) : <div className="acciones"><button className="btn sec" onClick={onCerrar}>{t("Cerrar")}</button></div>}
    </Modal>
  );
}
