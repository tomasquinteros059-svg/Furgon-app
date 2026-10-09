import { useState } from "react";
import { datos, type Contacto } from "../datos";
import { CodigoFamilia } from "../componentes/CodigoFamilia";
import { FormContactos } from "../componentes/FormContactos";
import { buscarDireccion, MapaPin, type Punto } from "../componentes/MapaPin";
import { Cargando, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { normalizarTelefono } from "../formato";
import { t } from "../i18n";

export function NuevoAlumno() {
  const { valor: rutas } = useCarga(() => datos.rutas());
  const [f, setF] = useState({ nombre: "", colegio: "", curso: "", direccion: "", indicaciones: "", minutos: 5, mensualidad: "" });
  const [pin, setPin] = useState<Punto | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [rutaIds, setRutaIds] = useState<string[] | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [creado, setCreado] = useState<{ codigo: string; alumno_id: string; telefono: string | null } | null>(null);
  const activas = (rutas ?? []).filter((r) => r.activa);
  // Por defecto: si hay una sola tía, sus rutas (ida y vuelta); con varias, se elige a mano.
  const conductoras = new Set(activas.map((r) => r.conductor_id));
  const unaSola = conductoras.size <= 1;
  const seleccion = rutaIds ?? (unaSola ? activas.map((r) => r.id) : []);

  if (creado) {
    return (
      <>
        <Encabezado titulo={t("{nombre} quedó registrado/a", { nombre: f.nombre })} bajada={t("Ya está en la ruta de la tía. Envía este código a la familia para que reciba los avisos.")} />
        <section className="tarjeta"><CodigoFamilia codigo={creado.codigo} alumno={f.nombre} telefono={creado.telefono} /></section>
        <div className="acciones">
          <a className="btn" href={`#/alumnos/${creado.alumno_id}`}>{t("Ver ficha")}</a>
          <button className="btn sec" onClick={() => { setCreado(null); setF({ ...f, nombre: "", direccion: "", indicaciones: "", mensualidad: "" }); setPin(null); setContactos([]); }}>{t("Agregar otro alumno")}</button>
        </div>
      </>
    );
  }

  async function guardar() {
    const e: Record<string, string> = {};
    if (!f.nombre.trim()) e.nombre = t("Falta el nombre.");
    if (!f.direccion.trim()) e.direccion = t("Falta la dirección.");
    if (!pin) e.pin = t("Ubica la casa en el mapa: así el aviso llega a tiempo.");
    const limpios: Contacto[] = [];
    contactos.forEach((c, i) => {
      if (!c.nombre.trim() && !c.telefono.trim()) return;
      const tel = normalizarTelefono(c.telefono);
      if (!tel) e[`c${i}`] = t("Revisa el número (ej: 9 1234 5678).");
      else limpios.push({ nombre: c.nombre.trim() || (i === 0 ? "Principal" : "Secundario"), telefono: tel, prioridad: limpios.length + 1 });
    });
    if (!limpios.length && !e.c0) e.c0 = t("Agrega al menos un teléfono.");
    const mensualidad = f.mensualidad.trim() ? Number(f.mensualidad.replace(/\D/g, "")) : null;
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true); setError(null);
    try {
      const r = await datos.crearAlumno({
        nombre: f.nombre.trim(), colegio: f.colegio.trim(), curso: f.curso.trim(), minutos_aviso: f.minutos, mensualidad,
        domicilio: { direccion: f.direccion.trim(), lat: pin!.lat, lng: pin!.lng, indicaciones: f.indicaciones.trim() || null },
        contactos: limpios, ruta_ids: seleccion,
      });
      setCreado({ ...r, telefono: limpios[0]?.telefono ?? null });
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally { setGuardando(false); }
  }

  const campo = (k: keyof typeof f, etiqueta: string, extra: Record<string, string> = {}) => (
    <label className="campo"><span>{etiqueta}</span>
      <input id={`f-${k}`} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
      {errores[k] ? <small style={{ color: "var(--alert)" }}>{errores[k]}</small> : null}
    </label>
  );

  return (
    <>
      <Encabezado titulo={t("Agregar alumno")} bajada={t("Completa los datos una vez. La tía verá al alumno en su ruta y la familia solo tendrá que ingresar un código.")} />
      <ErrorCaja mensaje={error} />
      <section className="tarjeta">
        <h2>{t("Alumno")}</h2>
        <div className="rejilla">
          {campo("nombre", t("Nombre y apellido"), { placeholder: t("Ej: Sofía Pérez") })}
          {campo("curso", t("Curso"), { placeholder: t("Ej: 3° Básico") })}
          {campo("colegio", t("Colegio"))}
          <label className="campo"><span>{t("Mensualidad (CLP)")}</span>
            <input id="f-mensualidad" inputMode="numeric" placeholder={t("Vacío = la de la empresa")} value={f.mensualidad} onChange={(e) => setF({ ...f, mensualidad: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="campo"><span>{t("Avisar antes de llegar")}</span>
            <select id="f-minutos" value={f.minutos} onChange={(e) => setF({ ...f, minutos: Number(e.target.value) })}>
              {[3, 5, 7, 10].map((m) => <option key={m} value={m}>{t("{m} minutos", { m })}</option>)}
            </select></label>
        </div>
      </section>

      <section className="tarjeta">
        <h2>{t("Casa")}</h2>
        <div className="rejilla">
          <div className="campo"><span>{t("Dirección")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="f-direccion" className="entrada" placeholder={t("Calle, número, comuna")} value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
              <button className="btn sec" disabled={buscando || !f.direccion.trim()} onClick={async () => {
                setBuscando(true);
                try { const p = await buscarDireccion(f.direccion); if (p) setPin(p); else setErrores({ ...errores, pin: t("No encontramos la dirección: ubica el pin a mano.") }); }
                catch { setErrores({ ...errores, pin: t("No pudimos buscar la dirección: ubica el pin a mano.") }); }
                finally { setBuscando(false); }
              }}>{buscando ? t("Buscando…") : t("Buscar")}</button>
            </div>
            {errores.direccion ? <small style={{ color: "var(--alert)" }}>{errores.direccion}</small> : null}
          </div>
          {campo("indicaciones", t("Indicaciones para la tía (opcional)"), { placeholder: t("Ej: portón verde, depto 302") })}
        </div>
        <MapaPin punto={pin} onCambio={setPin} />
        <small style={{ color: errores.pin ? "var(--alert)" : "var(--muted)" }}>{errores.pin ?? t("Toca el mapa o arrastra el pin hasta la puerta de la casa. El aviso de 5 minutos se calcula hasta este punto.")}</small>
      </section>

      <section className="tarjeta">
        <h2>{t("Teléfonos para los avisos")}</h2>
        <FormContactos contactos={contactos} onCambio={setContactos} errores={{ 0: errores.c0, 1: errores.c1 }} />
      </section>

      <section className="tarjeta">
        <h2>{t("Rutas")}</h2>
        {!rutas ? <Cargando /> : (
          <div className="chips" style={{ gap: 16 }}>
            {activas.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" checked={seleccion.includes(r.id)} onChange={(e) => setRutaIds(e.target.checked ? [...seleccion, r.id] : seleccion.filter((x) => x !== r.id))} />
                {r.nombre} <span className="tenue">({r.conductor_nombre ?? t("sin conductora")})</span>
              </label>
            ))}
          </div>
        )}
        <small className="tenue">{t("Queda al final de la ruta; puedes cambiar el orden en «Rutas».")}</small>
      </section>
      <div className="acciones"><button className="btn bus" disabled={guardando} onClick={guardar}>{guardando ? t("Guardando…") : t("Guardar alumno")}</button><a className="btn sec" href="#/alumnos">{t("Cancelar")}</a></div>
    </>
  );
}
