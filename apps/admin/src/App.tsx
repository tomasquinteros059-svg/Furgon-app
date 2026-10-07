import { useEffect, useState } from "react";
import { datos } from "./datos";
import { Alumnos } from "./paginas/Alumnos";
import { Cobros } from "./paginas/Cobros";
import { Conductoras } from "./paginas/Conductoras";
import { Configuracion } from "./paginas/Configuracion";
import { FichaAlumno } from "./paginas/FichaAlumno";
import { Ingresar } from "./paginas/Ingresar";
import { Llamadas } from "./paginas/Llamadas";
import { NuevoAlumno } from "./paginas/NuevoAlumno";
import { Panel } from "./paginas/Panel";
import { Preguntas } from "./paginas/Preguntas";
import { Rutas } from "./paginas/Rutas";
import { Solicitudes } from "./paginas/Solicitudes";

const SECCIONES = [
  { ruta: "panel", nombre: "Panel" },
  { ruta: "alumnos", nombre: "Alumnos" },
  { ruta: "rutas", nombre: "Rutas" },
  { ruta: "conductoras", nombre: "Conductoras" },
  { ruta: "cobros", nombre: "Cobros" },
  { ruta: "solicitudes", nombre: "Solicitudes" },
  { ruta: "preguntas", nombre: "Preguntas frecuentes" },
  { ruta: "llamadas", nombre: "Llamadas y costos" },
  { ruta: "configuracion", nombre: "Configuración" },
] as const;

/** Navegación por hash (#/alumnos/123): funciona también desde el archivo HTML de demostración. */
function useRuta(): string[] {
  const leer = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [partes, setPartes] = useState(leer);
  useEffect(() => {
    const f = () => { setPartes(leer()); document.querySelector("main")?.scrollTo(0, 0); };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return partes;
}

export function irA(ruta: string) {
  location.hash = `#/${ruta}`;
}

export function App() {
  const [usuario, setUsuario] = useState<{ nombre: string } | null | undefined>(undefined);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const partes = useRuta();

  useEffect(() => {
    datos.sesion().then(setUsuario).catch((e) => { setErrorSesion(e.message); setUsuario(null); });
  }, []);

  if (usuario === undefined) return null;
  if (!usuario) {
    return <Ingresar error={errorSesion} onIngreso={async (email, pass) => {
      await datos.ingresar(email, pass);
      setUsuario(await datos.sesion());
      if (!location.hash) irA("panel");
    }} />;
  }

  const [seccion = "panel", id] = partes;
  let pagina;
  switch (seccion) {
    case "alumnos": pagina = id === "nuevo" ? <NuevoAlumno /> : id ? <FichaAlumno id={id} /> : <Alumnos />; break;
    case "rutas": pagina = <Rutas />; break;
    case "conductoras": pagina = <Conductoras />; break;
    case "cobros": pagina = <Cobros />; break;
    case "solicitudes": pagina = <Solicitudes seleccion={id ?? null} />; break;
    case "preguntas": pagina = <Preguntas />; break;
    case "llamadas": pagina = <Llamadas />; break;
    case "configuracion": pagina = <Configuracion />; break;
    default: pagina = <Panel />;
  }

  return (
    <div className="marco">
      <aside className={`lateral ${menuAbierto ? "abierto" : ""}`}>
        <div className="marca">
          <svg width="44" height="30" viewBox="0 0 84 56" aria-hidden="true"><rect x="4" y="8" width="76" height="36" rx="9" fill="var(--bus)" stroke="var(--bus-ink)" strokeWidth="3" /><rect x="12" y="15" width="16" height="12" rx="2" fill="var(--bus-ink)" opacity=".75" /><rect x="34" y="15" width="16" height="12" rx="2" fill="var(--bus-ink)" opacity=".75" /><rect x="56" y="15" width="16" height="12" rx="2" fill="var(--bus-ink)" opacity=".75" /><circle cx="22" cy="46" r="7" fill="var(--lateral-ink)" /><circle cx="62" cy="46" r="7" fill="var(--lateral-ink)" /></svg>
          <div><b>Furgón Escolar</b><span>Administración</span></div>
          <button className="btn-menu" aria-label="Menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        </div>
        <nav aria-label="Secciones" onClick={() => setMenuAbierto(false)}>
          {SECCIONES.map((s) => (
            <a key={s.ruta} href={`#/${s.ruta}`} aria-current={seccion === s.ruta || (s.ruta === "panel" && !partes.length) ? "page" : undefined}>{s.nombre}</a>
          ))}
        </nav>
        <div className="pie-lateral">
          <span>{usuario.nombre}</span>
          <button className="btn-link" onClick={async () => { await datos.salir(); setUsuario(null); }}>Cerrar sesión</button>
        </div>
      </aside>
      <main>
        {datos.modo === "demo" ? <div className="cinta-demo">Modo demostración · datos de ejemplo, los cambios no se guardan al recargar</div> : null}
        <div className="contenido">{pagina}</div>
      </main>
    </div>
  );
}
