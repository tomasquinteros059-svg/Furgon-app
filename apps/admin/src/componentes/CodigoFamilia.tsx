import { Copiar } from "./ui";

/** Código con el que la familia se registra en la app y queda ligada al alumno, con el mensaje listo para enviar. */
export function CodigoFamilia({ codigo, alumno, telefono }: { codigo: string; alumno: string; telefono?: string | null }) {
  const mensaje = `Hola 👋 Para recibir los avisos del furgón de ${alumno}:\n` +
    `1) Descarga la app «Furgón Escolar».\n` +
    `2) Toca «Crear cuenta» y escribe este código: ${codigo}\n` +
    `¡Listo! Te avisaremos unos 5 minutos antes de que llegue el furgón.`;
  const wa = telefono ? `https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}` : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div><span className="codigo" aria-label="Código para la familia">{codigo}</span></div>
      <p className="nota" style={{ whiteSpace: "pre-line" }}>{mensaje}</p>
      <div className="acciones">
        <Copiar texto={mensaje} etiqueta="Copiar mensaje" />
        {wa ? <a className="btn ok" href={wa} target="_blank" rel="noopener">Enviar por WhatsApp</a> : null}
      </div>
      <small className="tenue">El código sirve para ambos apoderados y vence en 60 días. La tía no tiene que hacer nada: el alumno ya aparece en su ruta.</small>
    </div>
  );
}
