import { useState } from "react";
import { datos } from "../datos";
import { ErrorCaja } from "../componentes/ui";
import { SelectorIdioma, t } from "../i18n";

export function Ingresar({ onIngreso, error: errorInicial }: { onIngreso: (email: string, pass: string) => Promise<void>; error: string | null }) {
  const demo = datos.modo === "demo";
  const [email, setEmail] = useState(demo ? "admin@furgonesdemo.cl" : "");
  const [pass, setPass] = useState(demo ? "demo-furgon" : "");
  const [error, setError] = useState<string | null>(errorInicial);
  const [cargando, setCargando] = useState(false);
  return (
    <div className="login">
      <form className="tarjeta" onSubmit={async (e) => {
        e.preventDefault(); setCargando(true); setError(null);
        try { await onIngreso(email.trim(), pass); } catch (x) { setError(x instanceof Error ? x.message : String(x)); } finally { setCargando(false); }
      }}>
        <h1>Furgón Escolar</h1>{/* i18n-ignorar: nombre de la app */}
        <p className="tenue" style={{ margin: 0 }}>{t("Administración: alumnos, rutas, cobros y solicitudes de las familias.")}</p>
        <ErrorCaja mensaje={error} />
        <label className="campo"><span>{t("Correo")}</span><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="campo"><span>{t("Contraseña")}</span><input id="pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required /></label>
        <button className="btn bus" disabled={cargando}>{cargando ? t("Ingresando…") : t("Ingresar")}</button>
        {demo ? <p className="nota">{t("Demostración: cualquier correo y contraseña sirven.")}</p> : null}
        <div style={{ display: "flex", justifyContent: "center" }}><SelectorIdioma /></div>
      </form>
    </div>
  );
}
