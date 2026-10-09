import { useEffect, useState } from "react";
import { datos } from "./datos";
import { Alumnos } from "./paginas/Alumnos";
import { Cobros } from "./paginas/Cobros";
import { Conductoras } from "./paginas/Conductoras";
import { Configuracion } from "./paginas/Configuracion";
import { FichaAlumno } from "./paginas/FichaAlumno";
import { Furgones } from "./paginas/Furgones";
import { Ingresar } from "./paginas/Ingresar";
import { Llamadas } from "./paginas/Llamadas";
import { NuevoAlumno } from "./paginas/NuevoAlumno";
import { Panel } from "./paginas/Panel";
import { Preguntas } from "./paginas/Preguntas";
import { Rutas } from "./paginas/Rutas";
import { Solicitudes } from "./paginas/Solicitudes";
import { Icono } from "./componentes/Icono";
import { SelectorIdioma, useIdiomaActual } from "./i18n";

const SECCIONES = [
  { ruta: "panel", nombre: "Panel" },
  { ruta: "furgones", nombre: "Furgones" },
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

type Tema = "sistema" | "claro" | "oscuro";
const leerTema = (): Tema => { try { const t = localStorage.getItem("tema"); return t === "claro" || t === "oscuro" ? t : "sistema"; } catch { return "sistema"; } };
function aplicarTema(t: Tema) {
  if (t === "sistema") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === "oscuro" ? "dark" : "light";
}
aplicarTema(leerTema());

/** Apariencia del panel: automática (según el equipo), clara u oscura. Se recuerda en este navegador. */
function SelectorTema() {
  const [tema, setTema] = useState<Tema>(leerTema);
  const elegir = (t: Tema) => { setTema(t); aplicarTema(t); try { localStorage.setItem("tema", t); } catch { /* sin almacenamiento */ } };
  return (
    <div className="tema" role="group" aria-label="Apariencia">
      {([["sistema", "Auto"], ["claro", "Claro"], ["oscuro", "Oscuro"]] as const).map(([v, n]) => (
        <button key={v} type="button" aria-pressed={tema === v} onClick={() => elegir(v)}>{n}</button>
      ))}
    </div>
  );
}

export function irA(ruta: string) {
  location.hash = `#/${ruta}`;
}

export function App() {
  const [usuario, setUsuario] = useState<{ nombre: string; tipo: "principal" | "conductora" } | null | undefined>(undefined);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const partes = useRuta();
  const idioma = useIdiomaActual();

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
    case "furgones": pagina = <Furgones />; break;
    case "rutas": pagina = <Rutas />; break;
    case "conductoras": pagina = <Conductoras principal={usuario.tipo === "principal"} />; break;
    case "cobros": pagina = <Cobros />; break;
    case "solicitudes": pagina = <Solicitudes seleccion={id ?? null} />; break;
    case "preguntas": pagina = <Preguntas />; break;
    case "llamadas": pagina = <Llamadas />; break;
    case "configuracion": pagina = <Configuracion />; break;
    default: pagina = <Panel />;
  }

  return (
    <div className="marco" key={idioma}>
      <aside className={`lateral ${menuAbierto ? "abierto" : ""}`}>
        <div className="marca">
          <Icono n="furgon" tam={34} />
          <div><b>Furgón Escolar</b><span>Administración</span></div>
          <button className="btn-menu" aria-label="Menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}><Icono n="menu" /></button>
        </div>
        <nav aria-label="Secciones" onClick={() => setMenuAbierto(false)}>
          {SECCIONES.map((s) => (
            <a key={s.ruta} href={`#/${s.ruta}`} aria-current={seccion === s.ruta || (s.ruta === "panel" && !partes.length) ? "page" : undefined}>{s.nombre}</a>
          ))}
        </nav>
        <div className="pie-lateral">
          <SelectorTema />
          <SelectorIdioma />
          <span>{usuario.nombre}{usuario.tipo === "conductora" ? " · conductora" : ""}</span>
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
