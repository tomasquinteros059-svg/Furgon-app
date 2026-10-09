import { useState } from "react";
import { datos } from "../datos";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga, Vacio } from "../componentes/ui";
import { fechaHora, mesActual, nombreMes, pesos, sumarMes } from "../formato";
import { t } from "../i18n";

/** Resultado de una llamada, en palabras. */
function resultado(estado: string): string {
  switch (estado) {
    case "confirmada": return t("Confirmó (presionó 1)");
    case "sin_internet": return t("Sin internet → teléfono");
    case "no_contesto": return t("No contestó");
    case "sin_confirmar": return t("Contestó sin confirmar");
    case "ocupado": return t("Ocupado");
    case "fallida": return t("Falló");
    case "cancelada": return t("Cancelada");
    case "en_curso": return t("En curso");
    case "programada": return t("Programada");
    default: return estado;
  }
}

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
      <Encabezado titulo={t("Llamadas y costos")} bajada={t("Las llamadas por la app no tienen costo. Solo se paga la llamada telefónica cuando la familia no tenía internet.")}
        acciones={<>
          <button className="btn sec" onClick={() => setMes(sumarMes(mes, -1))} aria-label={t("Mes anterior")}>‹</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{nombreMes(mes)}</b>
          <button className="btn sec" onClick={() => setMes(sumarMes(mes, 1))} aria-label={t("Mes siguiente")}>›</button>
        </>} />
      <ErrorCaja mensaje={error} />
      <section className="kpis">
        <div className="kpi"><b>{app.length}</b><span>{t("Llamadas por la app (sin costo)")}</span></div>
        <div className="kpi alerta"><b>{tel.length}</b><span>{t("Llamadas telefónicas (con costo)")}</span></div>
        <div className="kpi"><b>{minutos}</b><span>{t("Minutos telefónicos")}</span></div>
        <div className="kpi aviso"><b>{pesos(minutos * tarifa)}</b><span>{t("Costo estimado")}</span></div>
      </section>
      <label className="campo" style={{ maxWidth: 280 }}><span>{t("Tarifa por minuto (CLP)")}</span>
        <input id="tarifa" inputMode="numeric" value={tarifa} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")) || 0; setTarifa(v); try { localStorage.setItem("tarifa_minuto", String(v)); } catch { /* sin almacenamiento */ } }} />
        <small>{t("Revisa la tarifa real en tu cuenta de Twilio. Es solo una estimación.")}</small></label>
      {!llamadas ? <Cargando /> : llamadas.length === 0 ? <Vacio>{t("Sin llamadas en {mes}.", { mes: nombreMes(mes) })}</Vacio> : (
        <div className="tabla-cont"><table>
          <thead><tr><th>{t("Fecha")}</th><th>{t("Alumno")}</th><th>{t("Llamado a")}</th><th>{t("Canal")}</th><th>{t("Resultado")}</th><th className="num">{t("Duración")}</th></tr></thead>
          <tbody>{llamadas.slice(0, 200).map((l) => (
            <tr key={l.id}>
              <td>{fechaHora(l.fecha)}</td><td>{l.alumno}</td><td>{l.contacto} <small className="tenue mono">{l.telefono}</small></td>
              <td>{l.canal === "app" ? <Chip tono="info">{t("App · gratis")}</Chip> : <Chip tono="alerta">{t("Teléfono · con costo")}</Chip>}</td>
              <td>{resultado(l.estado)}</td>
              <td className="num">{l.duracion_seg != null ? `${l.duracion_seg} s` : "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
