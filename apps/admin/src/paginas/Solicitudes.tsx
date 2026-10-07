import { useState } from "react";
import { datos, type Solicitud, type TipoSolicitud } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga, Vacio } from "../componentes/ui";
import { fechaHora } from "../formato";
import { Icono } from "../componentes/Icono";

const TIPO: Record<TipoSolicitud, [string, "alerta" | "info" | "aviso" | "neutro"]> = {
  cancelacion_servicio: ["Cancelación", "alerta"], pregunta: ["Pregunta", "info"], cambio_datos: ["Cambio de datos", "aviso"], reclamo: ["Reclamo", "alerta"], otro: ["Otro", "neutro"],
};
const ESTADO = { abierta: ["Sin responder", "alerta"], respondida: ["Respondida", "info"], cerrada: ["Cerrada", "neutro"] } as const;

export function Solicitudes({ seleccion }: { seleccion: string | null }) {
  const { valor: lista, error, recargar } = useCarga(() => datos.solicitudes());
  const [ver, setVer] = useState<"abiertas" | "todas">("abiertas");
  const visibles = (lista ?? []).filter((s) => ver === "todas" || s.estado !== "cerrada");
  const actual = (lista ?? []).find((s) => s.id === seleccion) ?? null;
  return (
    <>
      <Encabezado titulo="Solicitudes" bajada="Preguntas, cancelaciones y cambios que envían las familias desde la app." />
      <ErrorCaja mensaje={error} />
      <span className="seg" role="group" aria-label="Filtro"><button aria-pressed={ver === "abiertas"} onClick={() => setVer("abiertas")}>Por atender</button><button aria-pressed={ver === "todas"} onClick={() => setVer("todas")}>Todas</button></span>
      {!lista ? <Cargando /> : (
        <div className="bandeja">
          <div className="lista-sol">
            {visibles.length === 0 ? <Vacio><Icono n="celebrar" /> No hay solicitudes por atender.</Vacio> : visibles.map((s) => (
              <a key={s.id} className="item-sol" href={`#/solicitudes/${s.id}`} aria-current={s.id === seleccion} style={{ color: "inherit", textDecoration: "none" }}>
                <div className="chips"><Chip tono={TIPO[s.tipo][1]}>{TIPO[s.tipo][0]}</Chip><Chip tono={ESTADO[s.estado][1]}>{ESTADO[s.estado][0]}</Chip></div>
                <b>{s.asunto}</b>
                <small>{s.autor}{s.alumno ? ` · ${s.alumno}` : ""} · {fechaHora(s.actualizado_en)}</small>
              </a>
            ))}
          </div>
          {actual ? <Conversacion key={actual.id} s={actual} onCambio={recargar} /> : <Vacio>Elige una solicitud para ver la conversación.</Vacio>}
        </div>
      )}
    </>
  );
}

function Conversacion({ s, onCambio }: { s: Solicitud; onCambio: () => void }) {
  const { valor: mensajes, recargar } = useCarga(() => datos.mensajes(s.id), [s.id]);
  const [texto, setTexto] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const hacer = async (fn: () => Promise<void>) => {
    try { setErr(null); await fn(); setTexto(""); recargar(); onCambio(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const cerrada = s.estado === "cerrada";
  return (
    <section className="tarjeta">
      <header><div><h2>{s.asunto}</h2><span className="tenue">{s.autor}{s.alumno ? <> · <a href={`#/alumnos/${s.alumno_id}`}>{s.alumno}</a></> : null}</span></div>
        {s.resolucion ? <Chip tono={s.resolucion === "aprobada" ? "ok" : "neutro"}>Cancelación {s.resolucion}</Chip> : null}</header>
      <ErrorCaja mensaje={err} />
      <div className="hilo">
        {!mensajes ? <Cargando /> : mensajes.map((m) => (
          <div key={m.id} className={`msj ${m.es_admin ? "admin" : ""}`}><small>{m.autor} · {fechaHora(m.creado_en)}</small>{m.cuerpo}</div>
        ))}
      </div>
      {cerrada ? <p className="nota">Solicitud cerrada.</p> : (
        <>
          <label className="campo"><span>Respuesta</span><textarea id="respuesta" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu respuesta. La familia la verá en la app." /></label>
          {s.tipo === "cancelacion_servicio" ? (
            <div className="acciones">
              <button className="btn peligro" onClick={() => hacer(() => datos.resolverCancelacion(s.id, true, texto.trim()))}>Aprobar cancelación y dar de baja</button>
              <button className="btn sec" onClick={() => hacer(() => datos.resolverCancelacion(s.id, false, texto.trim()))}>Rechazar</button>
              <button className="btn" disabled={!texto.trim()} onClick={() => hacer(() => datos.responder(s.id, texto.trim()))}>Solo responder</button>
            </div>
          ) : (
            <div className="acciones">
              <button className="btn" disabled={!texto.trim()} onClick={() => hacer(() => datos.responder(s.id, texto.trim()))}>Responder</button>
              <button className="btn sec" onClick={() => hacer(async () => { if (texto.trim()) await datos.responder(s.id, texto.trim()); await datos.cerrarSolicitud(s.id); })}>{texto.trim() ? "Responder y cerrar" : "Cerrar"}</button>
            </div>
          )}
          {s.tipo === "cancelacion_servicio" ? <small className="tenue">Al aprobar, el alumno sale de las rutas (la tía deja de verlo) y se anulan sus cobros de los meses siguientes.</small> : null}
        </>
      )}
    </section>
  );
}
