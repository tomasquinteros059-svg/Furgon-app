import { useState } from "react";
import { datos } from "../datos";
import { Cargando, Copiar, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";

export function Conductoras() {
  const { valor: conductoras, error } = useCarga(() => datos.conductoras());
  const { valor: rutas } = useCarga(() => datos.rutas());
  const [codigo, setCodigo] = useState<string | null>(null);
  const mensaje = codigo ? `Hola 👋 Descarga la app «Furgón Escolar», toca «Crear cuenta» y usa el código ${codigo}. Tus rutas y alumnos ya están cargados: solo tienes que tocar «Iniciar recorrido».` : "";
  return (
    <>
      <Encabezado titulo="Conductoras" bajada="La tía solo instala la app y entra con su código. Los alumnos y el orden de la ruta los administras tú."
        acciones={<button className="btn bus" onClick={async () => setCodigo(await datos.invitarConductora())}>+ Invitar conductora</button>} />
      <ErrorCaja mensaje={error} />
      {codigo ? (
        <section className="tarjeta">
          <h2>Código de invitación</h2>
          <div><span className="codigo">{codigo}</span></div>
          <p className="nota">{mensaje}</p>
          <div className="acciones"><Copiar texto={mensaje} etiqueta="Copiar mensaje" /></div>
          <small className="tenue">Sirve una sola vez y vence en 30 días. Después asígnale sus rutas en «Rutas».</small>
        </section>
      ) : null}
      {!conductoras ? <Cargando /> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>Conductora</th><th>Teléfono</th><th>Rutas</th></tr></thead>
          <tbody>{conductoras.map((c) => (
            <tr key={c.id}><td><b>{c.nombre}</b></td><td className="mono">{c.telefono ?? "—"}</td>
              <td>{(rutas ?? []).filter((r) => r.conductor_id === c.id).map((r) => `${r.nombre} (${r.paradas.length})`).join(" · ") || <span className="tenue">Sin rutas</span>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="nota">📡 La ubicación del furgón es la del celular de la conductora: no se necesita un GPS aparte. Se comparte solo mientras tiene un recorrido iniciado.</p>
    </>
  );
}
