import { useState } from "react";
import { datos, type Pregunta } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";

export function Preguntas() {
  const { valor: preguntas, error, recargar } = useCarga(() => datos.preguntas());
  const [editando, setEditando] = useState<(Omit<Pregunta, "id"> & { id?: string }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const hacer = async (fn: () => Promise<void>) => { try { setErr(null); await fn(); setEditando(null); recargar(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  return (
    <>
      <Encabezado titulo="Preguntas frecuentes" bajada="Las familias las ven en la app, en «Ayuda», antes de escribirte. Así llegan menos consultas repetidas."
        acciones={<button className="btn bus" onClick={() => setEditando({ pregunta: "", respuesta: "", orden: (preguntas?.length ?? 0) + 1, publicada: true })}>+ Nueva pregunta</button>} />
      <ErrorCaja mensaje={error ?? err} />
      {editando ? (
        <section className="tarjeta">
          <h2>{editando.id ? "Editar pregunta" : "Nueva pregunta"}</h2>
          <label className="campo"><span>Pregunta</span><input id="faq-pregunta" value={editando.pregunta} onChange={(e) => setEditando({ ...editando, pregunta: e.target.value })} /></label>
          <label className="campo"><span>Respuesta</span><textarea id="faq-respuesta" value={editando.respuesta} onChange={(e) => setEditando({ ...editando, respuesta: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={editando.publicada} onChange={(e) => setEditando({ ...editando, publicada: e.target.checked })} /> Publicada (visible para las familias)</label>
          <div className="acciones"><button className="btn" disabled={!editando.pregunta.trim() || !editando.respuesta.trim()} onClick={() => hacer(() => datos.guardarPregunta(editando))}>Guardar</button><button className="btn sec" onClick={() => setEditando(null)}>Cancelar</button></div>
        </section>
      ) : null}
      {!preguntas ? <Cargando /> : preguntas.map((p) => (
        <section key={p.id} className="tarjeta">
          <header><h3>{p.pregunta}</h3>{p.publicada ? <Chip tono="ok">Publicada</Chip> : <Chip>Borrador</Chip>}</header>
          <p style={{ margin: 0 }}>{p.respuesta}</p>
          <div className="acciones">
            <button className="btn sec chico" onClick={() => setEditando(p)}>Editar</button>
            <button className="btn sec chico" onClick={() => hacer(() => datos.guardarPregunta({ ...p, publicada: !p.publicada }))}>{p.publicada ? "Despublicar" : "Publicar"}</button>
            <button className="btn sec chico" onClick={() => hacer(() => datos.eliminarPregunta(p.id))}>Eliminar</button>
          </div>
        </section>
      ))}
    </>
  );
}
