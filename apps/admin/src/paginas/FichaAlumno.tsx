import { useEffect, useState } from "react";
import { datos, type Alumno, type Contacto } from "../datos";
import { CodigoFamilia } from "../componentes/CodigoFamilia";
import { FormContactos } from "../componentes/FormContactos";
import { MapaPin, type Punto } from "../componentes/MapaPin";
import { Cargando, Chip, Encabezado, ErrorCaja, Modal, useCarga } from "../componentes/ui";
import { fecha, normalizarTelefono } from "../formato";
import { t } from "../i18n";

export function FichaAlumno({ id }: { id: string }) {
  const { valor: alumnos, error, recargar } = useCarga(() => datos.alumnos(), [id]);
  const a = alumnos?.find((x) => x.id === id);
  if (error) return <ErrorCaja mensaje={error} />;
  if (!alumnos) return <Cargando />;
  if (!a) return <ErrorCaja mensaje={t("Alumno no encontrado.")} />;
  return <Ficha key={a.id} a={a} recargar={recargar} />;
}

function Ficha({ a, recargar }: { a: Alumno; recargar: () => void }) {
  const [d, setD] = useState({ nombre: a.nombre, curso: a.curso ?? "", colegio: a.colegio ?? "", minutos: a.minutos_aviso, mensualidad: a.mensualidad?.toString() ?? "" });
  const [dir, setDir] = useState({ direccion: a.domicilio?.direccion ?? "", indicaciones: a.domicilio?.indicaciones ?? "" });
  const [pin, setPin] = useState<Punto | null>(a.domicilio ? { lat: a.domicilio.lat, lng: a.domicilio.lng } : null);
  const [contactos, setContactos] = useState<Contacto[]>(a.contactos);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [baja, setBaja] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);

  useEffect(() => { if (aviso?.ok) { const h = setTimeout(() => setAviso(null), 2500); return () => clearTimeout(h); } }, [aviso]);
  const ejecutar = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); setAviso({ ok: true, txt: ok }); recargar(); } catch (e) { setAviso({ ok: false, txt: e instanceof Error ? e.message : String(e) }); }
  };

  return (
    <>
      <a href="#/alumnos" style={{ fontWeight: 700 }}>‹ {t("Alumnos")}</a>
      <Encabezado titulo={a.nombre} bajada={<>{a.curso} · {a.colegio} {a.activo ? null : <Chip tono="alerta">{t("Dado de baja el {fecha}", { fecha: fecha(a.fecha_baja!) })} · {a.motivo_baja}</Chip>}</>}
        acciones={a.activo ? <button className="btn sec" onClick={() => setBaja(true)}>{t("Dar de baja")}</button> : null} />
      {aviso ? (aviso.ok ? <p className="caja-ok" role="status">{aviso.txt}</p> : <ErrorCaja mensaje={aviso.txt} />) : null}

      <div className="dos-col">
        <section className="tarjeta">
          <h2>{t("Datos")}</h2>
          <div className="rejilla">
            <label className="campo"><span>{t("Nombre")}</span><input id="d-nombre" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></label>
            <label className="campo"><span>{t("Curso")}</span><input id="d-curso" value={d.curso} onChange={(e) => setD({ ...d, curso: e.target.value })} /></label>
            <label className="campo"><span>{t("Colegio")}</span><input id="d-colegio" value={d.colegio} onChange={(e) => setD({ ...d, colegio: e.target.value })} /></label>
            <label className="campo"><span>{t("Mensualidad (CLP)")}</span><input id="d-mensualidad" inputMode="numeric" placeholder={t("La de la empresa")} value={d.mensualidad} onChange={(e) => setD({ ...d, mensualidad: e.target.value })} /></label>
            <label className="campo"><span>{t("Avisar antes de llegar")}</span>
              <select id="d-minutos" value={d.minutos} onChange={(e) => setD({ ...d, minutos: Number(e.target.value) })}>{[3, 5, 7, 10].map((m) => <option key={m} value={m}>{t("{m} minutos", { m })}</option>)}</select></label>
          </div>
          <div><button className="btn" onClick={() => ejecutar(() => datos.actualizarAlumno(a.id, {
            nombre: d.nombre.trim(), curso: d.curso, colegio: d.colegio, minutos_aviso: d.minutos,
            mensualidad: d.mensualidad.trim() ? Number(d.mensualidad.replace(/\D/g, "")) : null,
          }), t("Datos guardados."))}>{t("Guardar datos")}</button></div>
        </section>

        <section className="tarjeta">
          <h2>{t("Familia")}</h2>
          {a.apoderados.length ? (
            <ul className="lista-tareas">{a.apoderados.map((p) => <li key={p.id}><span><b>{p.nombre}</b><br /><small className="tenue mono">{p.telefono ?? t("sin teléfono")}</small></span><Chip tono="ok">{t("Usa la app")}</Chip></li>)}</ul>
          ) : <p className="nota">{t("La familia aún no instala la app. Envíale su código.")}</p>}
          {codigo ? <CodigoFamilia codigo={codigo} alumno={a.nombre} telefono={a.contactos[0]?.telefono} />
            : a.activo ? <div><button className="btn bus" onClick={async () => setCodigo(await datos.codigoFamilia(a.id))}>{t("Ver código para la familia")}</button></div> : null}
          <h3>{t("Rutas")}</h3>
          {a.rutas.length ? <div className="chips">{a.rutas.map((r) => <Chip key={r.id}>{r.nombre}</Chip>)}</div> : <p className="tenue" style={{ margin: 0 }}>{t("Sin ruta. Asígnala en")} <a href="#/rutas">{t("Rutas")}</a>.</p>}
        </section>
      </div>

      <section className="tarjeta">
        <h2>{t("Casa")}</h2>
        <div className="rejilla">
          <label className="campo"><span>{t("Dirección")}</span><input id="dir-direccion" value={dir.direccion} onChange={(e) => setDir({ ...dir, direccion: e.target.value })} /></label>
          <label className="campo"><span>{t("Indicaciones para la tía")}</span><input id="dir-indicaciones" value={dir.indicaciones} onChange={(e) => setDir({ ...dir, indicaciones: e.target.value })} /></label>
        </div>
        <MapaPin punto={pin} onCambio={setPin} />
        <div><button className="btn" disabled={!pin} onClick={() => ejecutar(() => datos.actualizarDomicilio(a.id, {
          id: a.domicilio?.id, direccion: dir.direccion.trim(), indicaciones: dir.indicaciones.trim() || null, lat: pin!.lat, lng: pin!.lng,
        }), t("Casa actualizada. El próximo recorrido usará este pin."))}>{t("Guardar casa")}</button></div>
      </section>

      <section className="tarjeta">
        <h2>{t("Teléfonos para los avisos")}</h2>
        <FormContactos contactos={contactos} onCambio={setContactos} />
        <div><button className="btn" onClick={() => ejecutar(async () => {
          const limpios: Contacto[] = [];
          for (const c of contactos) {
            if (!c.nombre.trim() && !c.telefono.trim()) continue;
            const tel = normalizarTelefono(c.telefono);
            if (!tel) throw new Error(c.nombre ? t("Revisa el teléfono de {nombre}.", { nombre: c.nombre }) : t("Revisa el teléfono de un contacto."));
            limpios.push({ nombre: c.nombre.trim() || "Contacto", telefono: tel, prioridad: limpios.length + 1 });
          }
          if (!limpios.length) throw new Error(t("Debe quedar al menos un teléfono."));
          await datos.guardarContactos(a.id, limpios);
        }, t("Teléfonos guardados."))}>{t("Guardar teléfonos")}</button></div>
      </section>

      {baja ? (
        <Modal titulo={t("Dar de baja a {nombre}", { nombre: a.nombre })} onCerrar={() => setBaja(false)}>
          <p className="tenue" style={{ margin: 0 }}>{t("Sale de todas las rutas (la tía deja de verlo) y se anulan sus cobros de los próximos meses. El historial se conserva.")}</p>
          <label className="campo"><span>{t("Motivo")}</span><input id="motivo-baja" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("Ej: se cambió de colegio")} /></label>
          <div className="acciones"><button className="btn peligro" disabled={!motivo.trim()} onClick={() => { setBaja(false); ejecutar(() => datos.darDeBaja(a.id, motivo.trim()), t("Alumno dado de baja.")); }}>{t("Dar de baja")}</button><button className="btn sec" onClick={() => setBaja(false)}>{t("Cancelar")}</button></div>
        </Modal>
      ) : null}
    </>
  );
}
