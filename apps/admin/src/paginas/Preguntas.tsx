import { useState } from "react";
import { datos, type Pregunta } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { t } from "../i18n";

export function Preguntas() {
  const { valor: preguntas, error, recargar } = useCarga(() => datos.preguntas());
  const [editando, setEditando] = useState<(Omit<Pregunta, "id"> & { id?: string }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const hacer = async (fn: () => Promise<void>) => { try { setErr(null); await fn(); setEditando(null); recargar(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  return (
    <>
      <Encabezado titulo={t("Preguntas frecuentes")} bajada={t("Las familias las ven en la app, en «Ayuda», antes de escribirte. Así llegan menos consultas repetidas.")}
        acciones={<button className="btn bus" onClick={() => setEditando({ pregunta: "", respuesta: "", orden: (preguntas?.length ?? 0) + 1, publicada: true })}>{t("+ Nueva pregunta")}</button>} />
      <ErrorCaja mensaje={error ?? err} />
      {editando ? (
        <section className="tarjeta">
          <h2>{editando.id ? t("Editar pregunta") : t("Nueva pregunta")}</h2>
          <label className="campo"><span>{t("Pregunta")}</span><input id="faq-pregunta" value={editando.pregunta} onChange={(e) => setEditando({ ...editando, pregunta: e.target.value })} /></label>
          <label className="campo"><span>{t("Respuesta")}</span><textarea id="faq-respuesta" value={editando.respuesta} onChange={(e) => setEditando({ ...editando, respuesta: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={editando.publicada} onChange={(e) => setEditando({ ...editando, publicada: e.target.checked })} /> {t("Publicada (visible para las familias)")}</label>
          <div className="acciones"><button className="btn" disabled={!editando.pregunta.trim() || !editando.respuesta.trim()} onClick={() => hacer(() => datos.guardarPregunta(editando))}>{t("Guardar")}</button><button className="btn sec" onClick={() => setEditando(null)}>{t("Cancelar")}</button></div>
        </section>
      ) : null}
      {!preguntas ? <Cargando /> : preguntas.map((p) => (
        <section key={p.id} className="tarjeta">
          <header><h3>{p.pregunta}</h3>{p.publicada ? <Chip tono="ok">{t("Publicada")}</Chip> : <Chip>{t("Borrador")}</Chip>}</header>
          <p style={{ margin: 0 }}>{p.respuesta}</p>
          <div className="acciones">
            <button className="btn sec chico" onClick={() => setEditando(p)}>{t("Editar")}</button>
            <button className="btn sec chico" onClick={() => hacer(() => datos.guardarPregunta({ ...p, publicada: !p.publicada }))}>{p.publicada ? t("Despublicar") : t("Publicar")}</button>
            <button className="btn sec chico" onClick={() => confirm(t("¿Eliminar esta pregunta?")) && hacer(() => datos.eliminarPregunta(p.id))}>{t("Eliminar")}</button>
          </div>
        </section>
      ))}
    </>
  );
}
