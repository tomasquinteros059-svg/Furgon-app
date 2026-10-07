import type { Contacto } from "../datos";

export function FormContactos({ contactos, onCambio, errores }: {
  contactos: Contacto[]; onCambio: (c: Contacto[]) => void; errores?: Record<number, string>;
}) {
  const fila = (i: number) => contactos[i] ?? { nombre: "", telefono: "", prioridad: i + 1 };
  const set = (i: number, campo: "nombre" | "telefono", v: string) => {
    const nuevos = [0, 1].map((k) => ({ ...fila(k) }));
    nuevos[i][campo] = v;
    onCambio(nuevos);
  };
  return (
    <div className="rejilla">
      {[0, 1].map((i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="campo"><span>{i === 0 ? "Contacto principal" : "Contacto secundario (opcional)"}</span>
            <input id={`contacto-${i}-nombre`} placeholder={i === 0 ? "Ej: Ana (mamá)" : "Ej: Pedro (abuelo)"} value={fila(i).nombre} onChange={(e) => set(i, "nombre", e.target.value)} /></label>
          <label className="campo"><span>Teléfono</span>
            <input id={`contacto-${i}-tel`} inputMode="tel" placeholder="9 1234 5678" value={fila(i).telefono} onChange={(e) => set(i, "telefono", e.target.value)} />
            {errores?.[i] ? <small style={{ color: "var(--alert)" }}>{errores[i]}</small> : <small>{i === 0 ? "Recibe la alarma y la llamada." : "Lo llamamos si el principal no contesta."}</small>}
          </label>
        </div>
      ))}
    </div>
  );
}
