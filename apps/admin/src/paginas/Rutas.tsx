import { useState } from "react";
import { datos, type RecomendacionRuta, type Ruta } from "../datos";
import { MapaRuta } from "../componentes/MapaRuta";
import { Cargando, Chip, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { Icono } from "../componentes/Icono";
import { locale, t } from "../i18n";

const km = (m: number) => `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;
/** Minutos aproximados que se ahorran a 25 km/h, velocidad típica en ciudad. */
const minutos = (m: number) => Math.max(1, Math.round(m / 1000 / 25 * 60));

export function Rutas() {
  const { valor: rutas, error, recargar } = useCarga(() => datos.rutas());
  const { valor: alumnos, recargar: recargarAlumnos } = useCarga(() => datos.alumnos());
  const { valor: conductoras } = useCarga(() => datos.conductoras());
  const [err, setErr] = useState<string | null>(null);
  const hacer = async (fn: () => Promise<void>) => { try { setErr(null); await fn(); recargar(); recargarAlumnos(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };

  return (
    <>
      <Encabezado titulo={t("Rutas")} bajada={t("El orden de las paradas es el que sigue la tía y el que usa el sistema para calcular cuándo avisar a cada familia. Usa «Recomendar ruta» para calcular el orden más corto con las direcciones de los alumnos.")} />
      <ErrorCaja mensaje={error ?? err} />
      {!rutas ? <Cargando /> : rutas.map((r) => <TarjetaRuta key={r.id} r={r} hacer={hacer}
        conductoras={conductoras ?? []}
        disponibles={(alumnos ?? []).filter((a) => a.activo && !r.paradas.some((p) => p.alumno_id === a.id))} />)}
    </>
  );
}

function TarjetaRuta({ r, hacer, conductoras, disponibles }: {
  r: Ruta; hacer: (fn: () => Promise<void>) => void;
  conductoras: { id: string; nombre: string }[]; disponibles: { id: string; nombre: string }[];
}) {
  const [agregar, setAgregar] = useState("");
  const [rec, setRec] = useState<RecomendacionRuta | null>(null);
  const [calculando, setCalculando] = useState(false);
  const noVan = r.paradas.filter((p) => p.hoy_no_va).length;
  const porId = new Map(r.paradas.map((p) => [p.alumno_id, p]));
  const recomendar = () => hacer(async () => {
    setCalculando(true);
    try { setRec(await datos.recomendarRuta(r.id)); } finally { setCalculando(false); }
  });
  return (
    <section className="tarjeta" aria-label={r.nombre}>
      <header>
        <div><h2><Icono n={r.tipo === "ida" ? "ida" : "casa"} /> {r.nombre}</h2>
          <span className="tenue">{r.tipo === "ida" ? t("Casas → colegio") : t("Colegio → casas")}{r.hora_salida ? ` · ${t("sale {hora}", { hora: r.hora_salida.slice(0, 5) })}` : ""}{r.furgon ? ` · ${r.furgon}` : ""}</span></div>
        <label className="campo" style={{ minWidth: 240 }}><span>{t("Conductora")}</span>
          <select value={r.conductor_id ?? ""} onChange={(e) => hacer(() => datos.asignarConductora(r.id, e.target.value || null))}>
            <option value="">{t("Sin asignar")}</option>
            {conductoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
      </header>
      {r.paradas.length >= 2 ? (
        <div className="acciones">
          <button className="btn bus" disabled={calculando} onClick={recomendar}>{calculando ? t("Calculando la mejor ruta…") : <><Icono n="chispa" /> {t("Recomendar ruta")}</>}</button>
          {!r.colegio ? <span className="tenue">{t("Sin ubicación del colegio: se ordena solo entre las casas.")}</span> : null}
        </div>
      ) : null}
      {rec ? <PanelRecomendacion r={rec} ruta={r} porId={porId}
        onAplicar={() => { const orden = rec.orden; setRec(null); hacer(() => datos.aplicarOrden(r.id, orden)); }}
        onDescartar={() => setRec(null)} /> : null}
      {r.paradas.length === 0 ? <p className="tenue">{t("Sin alumnos todavía.")}</p> : (
        <ol className="paradas">
          {r.paradas.map((p, i) => (
            <li key={p.alumno_id} className={p.hoy_no_va ? "no-va" : undefined}>
              <span className="n">{i + 1}</span>
              <span><a href={`#/alumnos/${p.alumno_id}`}><b>{p.nombre}</b></a>{p.hoy_no_va ? <> <Chip tono="aviso">{t("Hoy no va")}</Chip></> : null}<small>{p.direccion}</small></span>
              <span className="acciones">
                <button className={`btn chico ${p.hoy_no_va ? "ok" : "sec"}`} aria-pressed={p.hoy_no_va}
                  onClick={() => hacer(() => datos.hoyNoVa(p.alumno_id, r.tipo, !p.hoy_no_va))}>{p.hoy_no_va ? t("Sí va hoy") : t("Hoy no va")}</button>
                <button className="btn sec chico" aria-label={t("Subir a {nombre}", { nombre: p.nombre })} disabled={i === 0} onClick={() => hacer(() => datos.moverParada(r.id, p.alumno_id, -1))}>↑</button>
                <button className="btn sec chico" aria-label={t("Bajar a {nombre}", { nombre: p.nombre })} disabled={i === r.paradas.length - 1} onClick={() => hacer(() => datos.moverParada(r.id, p.alumno_id, 1))}>↓</button>
                <button className="btn sec chico" onClick={() => hacer(() => datos.quitarDeRuta(r.id, p.alumno_id))}>{t("Quitar")}</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {noVan ? <p className="tenue" style={{ margin: 0 }}>{noVan === 1 ? t("Hoy la tía se salta 1 casa: la ruta de hoy se actualiza sola y esa familia no recibe aviso. Mañana vuelve al orden normal.") : t("Hoy la tía se salta {n} casas: la ruta de hoy se actualiza sola y esa familia no recibe aviso. Mañana vuelve al orden normal.", { n: noVan })}</p> : null}
      <div className="filtros">
        <select className="entrada" style={{ maxWidth: 300 }} value={agregar} onChange={(e) => setAgregar(e.target.value)} aria-label={t("Agregar alumno a {ruta}", { ruta: r.nombre })}>
          <option value="">{t("Agregar alumno a esta ruta…")}</option>
          {disponibles.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <button className="btn sec" disabled={!agregar} onClick={() => { const id = agregar; setAgregar(""); hacer(() => datos.asignarARuta(id, r.id)); }}>{t("Agregar al final")}</button>
        <Chip tono="info">{t("{n} alumnos", { n: r.paradas.length })}</Chip>
        {noVan ? <Chip tono="aviso">{noVan === 1 ? t("{n} no va hoy", { n: noVan }) : t("{n} no van hoy", { n: noVan })}</Chip> : null}
      </div>
    </section>
  );
}

function PanelRecomendacion({ r, ruta, porId, onAplicar, onDescartar }: {
  r: RecomendacionRuta; ruta: Ruta; porId: Map<string, Ruta["paradas"][number]>;
  onAplicar: () => void; onDescartar: () => void;
}) {
  const casas = r.orden.map((id) => porId.get(id)).filter((p): p is Ruta["paradas"][number] => !!p && p.lat != null && p.lng != null)
    .map((p) => ({ id: p.alumno_id, nombre: p.nombre, lat: p.lat!, lng: p.lng! }));
  const fuente = r.fuente === "google" ? t("Calculada por calles con Google Maps.") : t("Calculada por distancia entre las casas (aproximada).");
  if (!r.cambia) {
    return <div className="recomendacion"><p className="caja-ok" role="status" style={{ margin: 0 }}><Icono n="pulgar" /> {t("El orden actual ya es el más corto (≈ {km}).", { km: km(r.metrosActual) })} {fuente}</p>
      <div className="acciones"><button className="btn sec" onClick={onDescartar}>{t("Cerrar")}</button></div></div>;
  }
  return (
    <div className="recomendacion" role="region" aria-label={t("Ruta recomendada")}>
      <div>
        <h3 style={{ margin: 0 }}><Icono n="chispa" /> {t("Ruta recomendada")}</h3>
        <p style={{ margin: "4px 0 0" }}><b className="mono">{km(r.metros)}</b> {t("en vez de")} <span className="mono">{km(r.metrosActual)}</span> · {t("ahorras")} <b>{km(r.ahorroM)}</b> {t("(≈ {min} min por recorrido)", { min: minutos(r.ahorroM) })}</p>
        <small className="tenue">{fuente} {t("Revisa el orden: tú conoces las calles y los horarios de cada familia.")}</small>
      </div>
      <div className="rec-cuerpo">
        <ol className="paradas">
          {r.orden.map((id, i) => {
            const p = porId.get(id);
            const antes = ruta.paradas.findIndex((x) => x.alumno_id === id);
            return (
              <li key={id}>
                <span className="n">{i + 1}</span>
                <span><b>{p?.nombre ?? "—"}</b><small>{p?.direccion}</small></span>
                <span className="tenue" style={{ fontSize: 13 }}>{antes === i ? t("igual") : t("antes {n}°", { n: antes + 1 })}</span>
              </li>
            );
          })}
        </ol>
        {casas.length ? <MapaRuta casas={casas} colegio={ruta.colegio} tipo={ruta.tipo} /> : null}
      </div>
      <div className="acciones">
        <button className="btn ok" onClick={onAplicar}>{t("Aplicar este orden")}</button>
        <button className="btn sec" onClick={onDescartar}>{t("Descartar")}</button>
      </div>
    </div>
  );
}
