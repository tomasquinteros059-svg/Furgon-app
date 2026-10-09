import { useEffect, useState } from "react";
import { datos, type Empresa } from "../datos";
import { Cargando, Encabezado, ErrorCaja, useCarga } from "../componentes/ui";
import { pesos } from "../formato";
import { t } from "../i18n";

export function Configuracion() {
  const { valor: empresa, error } = useCarga(() => datos.empresa());
  const [e, setE] = useState<Omit<Empresa, "id"> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  useEffect(() => { if (empresa) { const { id: _id, ...resto } = empresa; setE(resto); } }, [empresa]);
  if (error) return <ErrorCaja mensaje={error} />;
  if (!e) return <Cargando />;
  return (
    <>
      <Encabezado titulo={t("Configuración")} bajada={t("Datos de tu empresa y valores por defecto para los cobros.")} />
      {msg ? (msg.ok ? <p className="caja-ok" role="status">{msg.txt}</p> : <ErrorCaja mensaje={msg.txt} />) : null}
      <section className="tarjeta">
        <div className="rejilla">
          <label className="campo"><span>{t("Nombre de la empresa")}</span><input id="emp-nombre" value={e.nombre} onChange={(x) => setE({ ...e, nombre: x.target.value })} /></label>
          <label className="campo"><span>{t("Teléfono de contacto")}</span><input id="emp-tel" value={e.telefono_contacto ?? ""} onChange={(x) => setE({ ...e, telefono_contacto: x.target.value || null })} /><small>{t("Aparece en la sección Ayuda de la app.")}</small></label>
          <label className="campo"><span>{t("Mensualidad por defecto (CLP)")}</span><input id="emp-mensualidad" inputMode="numeric" value={e.mensualidad_defecto} onChange={(x) => setE({ ...e, mensualidad_defecto: Number(x.target.value.replace(/\D/g, "")) || 0 })} /><small>{pesos(e.mensualidad_defecto)} · {t("cada alumno puede tener la suya.")}</small></label>
          <label className="campo"><span>{t("Día de vencimiento")}</span><input id="emp-dia" type="number" min={1} max={28} value={e.dia_vencimiento} onChange={(x) => setE({ ...e, dia_vencimiento: Math.min(28, Math.max(1, Number(x.target.value) || 1)) })} /></label>
        </div>
        <div><button className="btn" onClick={async () => {
          try { await datos.guardarEmpresa(e); setMsg({ ok: true, txt: t("Configuración guardada.") }); } catch (x) { setMsg({ ok: false, txt: x instanceof Error ? x.message : String(x) }); }
        }}>{t("Guardar")}</button></div>
      </section>
    </>
  );
}
