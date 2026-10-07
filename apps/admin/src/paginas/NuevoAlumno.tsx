import { useState } from "react";
import { datos, type Contacto } from "../datos";
import { CodigoFamilia } from "../componentes/CodigoFamilia";
import { FormContactos } from "../componentes/FormContactos";
import { buscarDireccion, MapaPin, type Punto } from "../componentes/MapaPin";
import { Cargando, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { normalizarTelefono } from "../formato";

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
  const seleccion = rutaIds ?? (rutas ?? []).map((r) => r.id); // por defecto, todas las rutas (ida y vuelta)

  if (creado) {
    return (
      <>
        <Encabezado titulo={`${f.nombre} quedó registrado/a`} bajada="Ya está en la ruta de la tía. Envía este código a la familia para que reciba los avisos." />
        <section className="tarjeta"><CodigoFamilia codigo={creado.codigo} alumno={f.nombre} telefono={creado.telefono} /></section>
        <div className="acciones">
          <a className="btn" href={`#/alumnos/${creado.alumno_id}`}>Ver ficha</a>
          <button className="btn sec" onClick={() => { setCreado(null); setF({ ...f, nombre: "", direccion: "", indicaciones: "", mensualidad: "" }); setPin(null); setContactos([]); }}>Agregar otro alumno</button>
        </div>
      </>
    );
  }

  async function guardar() {
    const e: Record<string, string> = {};
    if (!f.nombre.trim()) e.nombre = "Falta el nombre.";
    if (!f.direccion.trim()) e.direccion = "Falta la dirección.";
    if (!pin) e.pin = "Ubica la casa en el mapa: así el aviso llega a tiempo.";
    const limpios: Contacto[] = [];
    contactos.forEach((c, i) => {
      if (!c.nombre.trim() && !c.telefono.trim()) return;
      const t = normalizarTelefono(c.telefono);
      if (!t) e[`c${i}`] = "Revisa el número (ej: 9 1234 5678).";
      else limpios.push({ nombre: c.nombre.trim() || (i === 0 ? "Principal" : "Secundario"), telefono: t, prioridad: limpios.length + 1 });
    });
    if (!limpios.length && !e.c0) e.c0 = "Agrega al menos un teléfono.";
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
      <Encabezado titulo="Agregar alumno" bajada="Completa los datos una vez. La tía verá al alumno en su ruta y la familia solo tendrá que ingresar un código." />
      <ErrorCaja mensaje={error} />
      <section className="tarjeta">
        <h2>Alumno</h2>
        <div className="rejilla">
          {campo("nombre", "Nombre y apellido", { placeholder: "Ej: Sofía Pérez" })}
          {campo("curso", "Curso", { placeholder: "Ej: 3° Básico" })}
          {campo("colegio", "Colegio")}
          <label className="campo"><span>Mensualidad (CLP)</span>
            <input id="f-mensualidad" inputMode="numeric" placeholder="Vacío = la de la empresa" value={f.mensualidad} onChange={(e) => setF({ ...f, mensualidad: e.target.value })} /></label>
          <label className="campo"><span>Avisar antes de llegar</span>
            <select id="f-minutos" value={f.minutos} onChange={(e) => setF({ ...f, minutos: Number(e.target.value) })}>
              {[3, 5, 7, 10].map((m) => <option key={m} value={m}>{m} minutos</option>)}
            </select></label>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Casa</h2>
        <div className="rejilla">
          <div className="campo"><span>Dirección</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="f-direccion" className="entrada" placeholder="Calle, número, comuna" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
              <button className="btn sec" disabled={buscando || !f.direccion.trim()} onClick={async () => {
                setBuscando(true);
                try { const p = await buscarDireccion(f.direccion); if (p) setPin(p); else setErrores({ ...errores, pin: "No encontramos la dirección: ubica el pin a mano." }); }
                catch { setErrores({ ...errores, pin: "No pudimos buscar la dirección: ubica el pin a mano." }); }
                finally { setBuscando(false); }
              }}>{buscando ? "Buscando…" : "Buscar"}</button>
            </div>
            {errores.direccion ? <small style={{ color: "var(--alert)" }}>{errores.direccion}</small> : null}
          </div>
          {campo("indicaciones", "Indicaciones para la tía (opcional)", { placeholder: "Ej: portón verde, depto 302" })}
        </div>
        <MapaPin punto={pin} onCambio={setPin} />
        <small style={{ color: errores.pin ? "var(--alert)" : "var(--muted)" }}>{errores.pin ?? "Toca el mapa o arrastra el pin hasta la puerta de la casa. El aviso de 5 minutos se calcula hasta este punto."}</small>
      </section>

      <section className="tarjeta">
        <h2>Teléfonos para los avisos</h2>
        <FormContactos contactos={contactos} onCambio={setContactos} errores={{ 0: errores.c0, 1: errores.c1 }} />
      </section>

      <section className="tarjeta">
        <h2>Rutas</h2>
        {!rutas ? <Cargando /> : (
          <div className="chips" style={{ gap: 16 }}>
            {rutas.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" checked={seleccion.includes(r.id)} onChange={(e) => setRutaIds(e.target.checked ? [...seleccion, r.id] : seleccion.filter((x) => x !== r.id))} />
                {r.nombre} <span className="tenue">({r.conductor_nombre ?? "sin conductora"})</span>
              </label>
            ))}
          </div>
        )}
        <small className="tenue">Queda al final de la ruta; puedes cambiar el orden en «Rutas».</small>
      </section>
      <div className="acciones"><button className="btn bus" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar alumno"}</button><a className="btn sec" href="#/alumnos">Cancelar</a></div>
    </>
  );
}
