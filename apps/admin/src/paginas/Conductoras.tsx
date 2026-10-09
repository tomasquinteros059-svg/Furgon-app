import { useState } from "react";
import { datos } from "../datos";
import { Cargando, Copiar, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { Icono } from "../componentes/Icono";
import { t } from "../i18n";

export function Conductoras({ principal }: { principal: boolean }) {
  const { valor: conductoras, error, recargar } = useCarga(() => datos.conductoras());
  const [err, setErr] = useState<string | null>(null);
  const { valor: rutas } = useCarga(() => datos.rutas());
  const [codigo, setCodigo] = useState<string | null>(null);
  const mensaje = codigo ? t("Hola. Descarga la app «Furgón Escolar», toca «Crear cuenta» y usa el código {codigo}. Tus rutas y alumnos ya están cargados: solo tienes que tocar «Iniciar recorrido».", { codigo }) : "";
  return (
    <>
      <Encabezado titulo={t("Conductoras")} bajada={t("La tía solo instala la app y entra con su código. Los alumnos y el orden de la ruta los administras tú.")}
        acciones={<button className="btn bus" onClick={async () => { try { setErr(null); setCodigo(await datos.invitarConductora()); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }}>{t("+ Invitar conductora")}</button>} />
      <ErrorCaja mensaje={error ?? err} />
      {codigo ? (
        <section className="tarjeta">
          <h2>{t("Código de invitación")}</h2>
          <div><span className="codigo">{codigo}</span></div>
          <p className="nota">{mensaje}</p>
          <div className="acciones"><Copiar texto={mensaje} etiqueta={t("Copiar mensaje")} /></div>
          <small className="tenue">{t("Sirve una sola vez y vence en 30 días. Después asígnale sus rutas en «Rutas».")}</small>
        </section>
      ) : null}
      {!conductoras ? <Cargando /> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>{t("Conductora")}</th><th>{t("Teléfono")}</th><th>{t("Rutas")}</th><th>{t("Administra")}</th></tr></thead>
          <tbody>{conductoras.map((c) => (
            <tr key={c.id}><td><b>{c.nombre}</b></td><td className="mono">{c.telefono ?? "—"}</td>
              <td>{(rutas ?? []).filter((r) => r.conductor_id === c.id).map((r) => `${r.nombre} (${r.paradas.length})`).join(" · ") || <span className="tenue">{t("Sin rutas")}</span>}</td>
              <td>{principal ? (
                <label className="check"><input type="checkbox" checked={c.puede_administrar} onChange={async (e) => {
                  try { setErr(null); await datos.permitirAdministrar(c.id, e.target.checked); recargar(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
                }} /> {c.puede_administrar ? t("Sí") : t("No")}</label>
              ) : c.puede_administrar ? t("Sí") : t("No")}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="nota"><Icono n="admin" /> <b>{t("Administra")}</b>{t(": la tía puede agregar alumnos, ordenar su ruta, registrar pagos y responder a las familias desde su app (y entrar a este panel con su cuenta). Esa sección se bloquea mientras maneja.")} {principal ? t("Solo tú puedes dar o quitar este permiso.") : t("Solo el administrador principal puede cambiar estos permisos.")}</p>
      <p className="nota"><Icono n="gps" /> {t("La ubicación del furgón es la del celular de la conductora: no se necesita un GPS aparte. Se comparte solo mientras tiene un recorrido iniciado.")}</p>
    </>
  );
}
