import { useState } from "react";
import { datos } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga, Vacio } from "../componentes/ui";
import { fechaHora, mesActual, nombreMes, pesos, sumarMes } from "../formato";

const leerTarifa = () => { try { return Number(localStorage.getItem("tarifa_minuto") ?? "") || 120; } catch { return 120; } };

export function Llamadas() {
  const [mes, setMes] = useState(mesActual());
  const { valor: llamadas, error } = useCarga(() => datos.llamadas(mes), [mes]);
  const [tarifa, setTarifa] = useState(leerTarifa);
  const app = (llamadas ?? []).filter((l) => l.canal === "app");
  const tel = (llamadas ?? []).filter((l) => l.canal === "telefono");
  const minutos = tel.reduce((s, l) => s + Math.ceil((l.duracion_seg ?? 0) / 60), 0);
  return (
    <>
      <Encabezado titulo="Llamadas y costos" bajada="Las llamadas por la app no tienen costo. Solo se paga la llamada telefónica cuando la familia no tenía internet."
        acciones={<>
          <button className="btn sec" onClick={() => setMes(sumarMes(mes, -1))} aria-label="Mes anterior">‹</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{nombreMes(mes)}</b>
          <button className="btn sec" onClick={() => setMes(sumarMes(mes, 1))} aria-label="Mes siguiente">›</button>
        </>} />
      <ErrorCaja mensaje={error} />
      <section className="kpis">
        <div className="kpi"><b>{app.length}</b><span>Llamadas por la app (sin costo)</span></div>
        <div className="kpi alerta"><b>{tel.length}</b><span>Llamadas telefónicas (con costo)</span></div>
        <div className="kpi"><b>{minutos}</b><span>Minutos telefónicos</span></div>
        <div className="kpi aviso"><b>{pesos(minutos * tarifa)}</b><span>Costo estimado</span></div>
      </section>
      <label className="campo" style={{ maxWidth: 280 }}><span>Tarifa por minuto (CLP)</span>
        <input id="tarifa" inputMode="numeric" value={tarifa} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")) || 0; setTarifa(v); try { localStorage.setItem("tarifa_minuto", String(v)); } catch { /* sin almacenamiento */ } }} />
        <small>Revisa la tarifa real en tu cuenta de Twilio. Es solo una estimación.</small></label>
      {!llamadas ? <Cargando /> : llamadas.length === 0 ? <Vacio>Sin llamadas en {nombreMes(mes)}.</Vacio> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>Fecha</th><th>Alumno</th><th>Llamado a</th><th>Canal</th><th>Resultado</th><th className="num">Duración</th></tr></thead>
          <tbody>{llamadas.slice(0, 200).map((l) => (
            <tr key={l.id}>
              <td>{fechaHora(l.fecha)}</td><td>{l.alumno}</td><td>{l.contacto} <small className="tenue mono">{l.telefono}</small></td>
              <td>{l.canal === "app" ? <Chip tono="info">App · gratis</Chip> : <Chip tono="alerta">Teléfono · con costo</Chip>}</td>
              <td>{{ confirmada: "Confirmó (presionó 1)", sin_internet: "Sin internet → teléfono", no_contesto: "No contestó", sin_confirmar: "Contestó sin confirmar", ocupado: "Ocupado", fallida: "Falló", cancelada: "Cancelada", en_curso: "En curso", programada: "Programada" }[l.estado] ?? l.estado}</td>
              <td className="num">{l.duracion_seg != null ? `${l.duracion_seg} s` : "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
