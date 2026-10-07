import { type ReactNode, useEffect, useState } from "react";

/** Carga datos asíncronos con estado de carga/error y una función para recargar. */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [valor, setValor] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vivo = true;
    cargar().then((v) => { if (vivo) { setValor(v); setError(null); } }).catch((e) => { if (vivo) setError(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { valor, error, recargar: () => setVersion((v) => v + 1) };
}

export function Encabezado({ titulo, bajada, acciones }: { titulo: string; bajada?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {bajada ? <p className="bajada">{bajada}</p> : null}
      </div>
      {acciones ? <div className="acciones">{acciones}</div> : null}
    </header>
  );
}

export function Cargando() {
  return <p className="tenue" role="status">Cargando…</p>;
}

export function ErrorCaja({ mensaje }: { mensaje: string | null }) {
  return mensaje ? <p className="caja-error" role="alert">{mensaje}</p> : null;
}

export function Chip({ tono = "neutro", children }: { tono?: "neutro" | "ok" | "alerta" | "aviso" | "info"; children: ReactNode }) {
  return <span className={`chip chip-${tono}`}>{children}</span>;
}

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab"><h2>{titulo}</h2><button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        {children}
      </div>
    </div>
  );
}

/** Botón que copia texto al portapapeles (con alternativa si el navegador lo impide). */
export function Copiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button className="btn sec" onClick={async () => {
      try { await navigator.clipboard.writeText(texto); setHecho(true); setTimeout(() => setHecho(false), 1800); }
      catch { window.prompt("Copia el texto:", texto); }
    }}>{hecho ? "✓ Copiado" : etiqueta}</button>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}
