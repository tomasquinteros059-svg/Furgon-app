// Íconos propios de Furgón Escolar (reemplazan a los emojis genéricos).
//
// Estilo: grilla de 24×24, trazo de 2 px redondeado en el color del texto (currentColor) y
// un único relleno de acento en amarillo escolar (ACENTO) por ícono, debajo del trazo.
// Es la única fuente de los íconos: la usan la app móvil (react-native-svg), el panel web
// y las maquetas HTML (scripts/generar-iconos.mjs las actualiza y genera docs/iconos.html).

export const AMARILLO_ESCOLAR = "#F5B700";

const A = 'fill="ACENTO" stroke="none"'; // relleno de acento
const S = 'fill="currentColor" stroke="none"'; // relleno sólido del color del texto

export const ICONOS = {
  // Transporte y recorrido
  furgon: `<path ${A} d="M3 7h12.4a3 3 0 0 1 2.6 1.5l2.4 4a3 3 0 0 1 .6 1.7V16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><path d="M3 7h12.4a3 3 0 0 1 2.6 1.5l2.4 4a3 3 0 0 1 .6 1.7V16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><path d="M7 7V4.5h6V7"/><path d="M5 10h3v2.5H5zM10.5 10h3v2.5h-3zM16 10h1.4l1.5 2.5H16z" stroke-width="1.5"/><circle ${S} cx="6.5" cy="17.5" r="2"/><circle ${S} cx="16.5" cy="17.5" r="2"/>`,
  auto: `<path ${A} d="M3 15.5l1.6-5A2 2 0 0 1 6.5 9h11a2 2 0 0 1 1.9 1.5l1.6 5V18H3z"/><path d="M3 15.5l1.6-5A2 2 0 0 1 6.5 9h11a2 2 0 0 1 1.9 1.5l1.6 5V18H3z"/><path d="M5.5 13h13"/><circle ${S} cx="7" cy="18.5" r="1.8"/><circle ${S} cx="17" cy="18.5" r="1.8"/>`,
  brujula: `<circle cx="12" cy="12" r="9"/><path ${A} d="M15.5 8.5l-2 5-5 2 2-5z"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>`,
  mapa: `<path ${A} d="M9 4l6 2v14l-6-2z"/><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>`,
  pin: `<path ${A} d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>`,
  gps: `<circle ${A} cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>`,
  meta: `<path ${A} d="M5 4h13l-2.5 4L18 12H5z"/><path d="M5 21V3.5M5 4h13l-2.5 4L18 12H5"/>`,
  ruta: `<circle ${A} cx="6" cy="18" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>`,

  // Lugares y tramos
  casa: `<path ${A} d="M5 10.2V20h14v-9.8L12 5z"/><path d="M3 11.5L12 4l9 7.5M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>`,
  colegio: `<path ${A} d="M3.5 21V10.5L12 6l8.5 4.5V21z"/><path d="M3.5 21V10.5L12 6l8.5 4.5V21M2 21h20"/><path d="M12 6V2.5h3.5l-1 1.2 1 1.3H12M10 21v-4h4v4"/><circle cx="12" cy="11.5" r="1.5"/>`,
  ida: `<path ${A} d="M5.5 17a6.5 6.5 0 0 1 13 0z"/><path d="M5.5 17a6.5 6.5 0 0 1 13 0M2 17h20M5 20.5h14M12 3.5v2.5M4.7 9.7l1.8 1.3M19.3 9.7l-1.8 1.3"/>`,

  // Personas
  persona: `<circle ${A} cx="12" cy="8" r="3.5"/><circle cx="12" cy="8" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>`,
  personas: `<circle ${A} cx="9" cy="8.5" r="3"/><circle cx="9" cy="8.5" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.4A6 6 0 0 1 21 20"/>`,
  familia: `<circle cx="6.5" cy="7" r="2.5"/><circle cx="17.5" cy="7" r="2.5"/><path d="M2 20v-1.5a4.5 4.5 0 0 1 6.6-4M22 20v-1.5a4.5 4.5 0 0 0-6.6-4"/><path ${A} d="M8.5 21v-1a3.5 3.5 0 0 1 7 0v1z"/><circle ${A} cx="12" cy="12" r="2.3"/><circle cx="12" cy="12" r="2.3"/><path d="M8.5 21v-1a3.5 3.5 0 0 1 7 0v1"/>`,
  alumno: `<circle ${A} cx="12" cy="9.5" r="4"/><circle cx="12" cy="9.5" r="4"/><circle cx="6.8" cy="7.8" r="1.6"/><circle cx="17.2" cy="7.8" r="1.6"/><path d="M6 21a6 6 0 0 1 12 0"/>`,
  subio: `<circle ${A} cx="9" cy="7.5" r="2.8"/><circle cx="9" cy="7.5" r="2.8"/><path d="M4.5 21v-4.5a4.5 4.5 0 0 1 9 0V21"/><path d="M12.6 13.2l3.4-3.7V4.2"/><path d="M14.2 5.6L16 3.6l1.8 2"/>`,
  conductora: `<path ${A} d="M7.5 7.5L8.5 3.5h7l1 4z"/><path d="M7 7.5h10M7.5 7.5L8.5 3.5h7l1 4"/><path d="M8.6 9.5a3.5 3.5 0 0 0 6.8 0"/><path d="M5 21a7 7 0 0 1 14 0"/>`,
  admin: `<path ${A} d="M5 21v-1.5a7 7 0 0 1 14 0V21z"/><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-1.5a7 7 0 0 1 14 0V21"/><path ${S} d="M12 13.5l-1 2.8 1 2 1-2z"/>`,
  conexion: `<circle ${A} cx="12" cy="12" r="4.5"/><path d="M10 14.2a3.6 3.6 0 0 1 0-5.1l2.1-2.1a3.6 3.6 0 0 1 5.1 5.1L16 13.3"/><path d="M14 9.8a3.6 3.6 0 0 1 0 5.1l-2.1 2.1a3.6 3.6 0 0 1-5.1-5.1L8 10.7"/>`,

  // Estados y confirmaciones
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  confirmado: `<circle ${A} cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8 5.4-5.6"/>`,
  error: `<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>`,
  cerrar: `<path d="M6 6l12 12M18 6L6 18"/>`,
  alerta: `<path ${A} d="M10.3 4.2a2 2 0 0 1 3.4 0l8 13.5A2 2 0 0 1 20 20.7H4a2 2 0 0 1-1.7-3z"/><path d="M10.3 4.2a2 2 0 0 1 3.4 0l8 13.5A2 2 0 0 1 20 20.7H4a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4.5"/><circle ${S} cx="12" cy="17.2" r="1.1"/>`,
  pendiente: `<path ${A} d="M8.5 20.5c0-2.6 7-2.6 7 0z"/><path d="M6.5 3h11M6.5 21h11M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9"/>`,
  prohibido: `<circle ${A} cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>`,
  candado: `<rect ${A} x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>`,
  calendario: `<path ${A} d="M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10h-17z"/><rect x="3.5" y="5.5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M9.5 14.5l5 4M14.5 14.5l-5 4"/>`,
  historial: `<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>`,
  reloj: `<circle ${A} cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>`,

  // Avisos y comunicación
  campana: `<path ${A} d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z"/><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2zM10 20.8a2.2 2.2 0 0 0 4 0M12 3V2"/>`,
  telefono: `<path ${A} d="M5.2 3.5h3l2 5-2.6 1.6a11 11 0 0 0 6.3 6.3l1.6-2.6 5 2v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.2 5.5a2 2 0 0 1 2-2z"/><path d="M5.2 3.5h3l2 5-2.6 1.6a11 11 0 0 0 6.3 6.3l1.6-2.6 5 2v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.2 5.5a2 2 0 0 1 2-2z"/>`,
  celular: `<rect ${A} x="6" y="2.5" width="12" height="19" rx="2.5"/><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>`,
  llamada_app: `<rect ${A} x="3.5" y="2.5" width="11" height="19" rx="2.5"/><rect x="3.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M7.5 18.5h3M17.8 8.5a4.5 4.5 0 0 1 0 7M20.4 6a8 8 0 0 1 0 12"/>`,
  mensaje: `<path ${A} d="M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.5L4.5 21v-3.5H4.5A1.5 1.5 0 0 1 3 16V6a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.5L4.5 21v-3.5A1.5 1.5 0 0 1 3 16V6a1.5 1.5 0 0 1 1.5-1.5zM7.5 9.5h9M7.5 13h5.5"/>`,
  voz: `<circle ${A} cx="8.5" cy="8.5" r="4"/><circle cx="8.5" cy="8.5" r="4"/><path d="M2 21a6.5 6.5 0 0 1 13 0M16 6.5a4 4 0 0 1 0 5M18.8 4a7.5 7.5 0 0 1 0 10"/>`,
  parlante: `<path ${A} d="M4 9h3.5L13 4.5v15L7.5 15H4z"/><path d="M4 9h3.5L13 4.5v15L7.5 15H4zM16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>`,
  senal: `<path ${A} d="M3.5 17h3v3.5h-3zM8.5 13.5h3v7h-3zM13.5 10h3v10.5h-3zM18.5 6h3v14.5h-3z"/><path d="M3.5 17h3v3.5h-3zM8.5 13.5h3v7h-3zM13.5 10h3v10.5h-3zM18.5 6h3v14.5h-3z" stroke-width="1.5"/>`,
  sin_senal: `<path d="M3.5 17h3v3.5h-3zM8.5 13.5h3v7h-3zM13.5 10h3v10.5h-3zM18.5 6h3v14.5h-3z" stroke-width="1.5" opacity=".45"/><path d="M3 3l18 18"/>`,

  // Administración y documentos
  licencia: `<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><rect ${A} x="5" y="8.5" width="5.5" height="7" rx="1"/><rect x="5" y="8.5" width="5.5" height="7" rx="1" stroke-width="1.5"/><path d="M13.5 9.5h5M13.5 12.5h5M13.5 15.5h3"/>`,
  tarjeta: `<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path ${A} d="M2.5 9h19v3.2h-19z"/><path d="M2.5 9h19M2.5 12.2h19M6 15.5h4"/>`,
  camara: `<path ${A} d="M3 8.2h4l2-3h6l2 3h4V19H3z"/><path d="M3 8.2h4l2-3h6l2 3h4V19H3z"/><circle cx="12" cy="13.2" r="3.5"/>`,
  galeria: `<rect x="3" y="4" width="18" height="16" rx="2.2"/><path ${A} d="M3.8 19.2l5.2-6 3.8 4 3-3 4.4 5z"/><path d="M3.5 18l5.5-5.3 3.8 4 3-3 4.7 4.8"/><circle ${A} cx="15.5" cy="8.5" r="1.8"/>`,
  lapiz: `<path ${A} d="M4 20l1-4.2L15.8 5l3.2 3.2L8.2 19z"/><path d="M4 20l1-4.2L15.8 5l3.2 3.2L8.2 19zM13.8 7l3.2 3.2"/>`,
  chispa: `<path ${A} d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9zM18.5 15l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/>`,
  celebrar: `<path ${A} d="M3.5 20.5l4.3-11.2 6.9 6.9z"/><path d="M3.5 20.5l4.3-11.2 6.9 6.9zM14 3.5v2.2M18.3 9.7h2.2M16.8 4.5l-1.2 1.8M20 6.8l-1.8 1"/><circle ${S} cx="12.5" cy="8.5" r="1"/>`,
  pulgar: `<path ${A} d="M7.5 11l3.8-6.8a2 2 0 0 1 3.4 2L13.6 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 16.9 20H7.5z"/><path d="M7.5 11l3.8-6.8a2 2 0 0 1 3.4 2L13.6 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 16.9 20H7.5zM3.5 11h4v9h-4z"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  estacionado: `<rect ${A} x="3.5" y="3.5" width="17" height="17" rx="3"/><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M10 17V7h3.2a3 3 0 0 1 0 6H10"/>`,
  play: `<path ${A} d="M8 5.5v13l10.5-6.5z"/><path d="M8 5.5v13l10.5-6.5z"/>`,
  pausa: `<rect ${A} x="6" y="5" width="4" height="14" rx="1"/><rect ${A} x="14" y="5" width="4" height="14" rx="1"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>`,
} as const;

export type NombreIcono = keyof typeof ICONOS;

/** Qué ícono reemplaza a cada emoji o símbolo que usaba la app. */
export const EMOJI_A_ICONO: Record<string, NombreIcono> = {
  "🚐": "furgon", "🚗": "auto", "🧭": "brujula", "🗺️": "mapa", "📍": "pin", "📡": "gps", "🏁": "meta",
  "🏠": "casa", "🏫": "colegio", "🌅": "ida",
  "👤": "persona", "👥": "personas", "👨‍👩‍👧": "familia", "👧": "alumno", "🙋": "subio", "🧑‍✈️": "conductora", "🧑‍💼": "admin", "🤝": "conexion",
  "✓": "check", "✔️": "check", "✅": "confirmado", "✗": "error", "✖️": "error", "❌": "error", "✕": "cerrar",
  "⚠️": "alerta", "⚠": "alerta", "⏳": "pendiente", "🚫": "prohibido", "🔒": "candado", "📅": "calendario", "🕘": "historial",
  "🔔": "campana", "📞": "telefono", "📱": "celular", "📲": "llamada_app", "💬": "mensaje", "🗣️": "voz", "🔊": "parlante",
  "📶": "senal", "📵": "sin_senal",
  "🪪": "licencia", "💳": "tarjeta", "📷": "camara", "🖼️": "galeria", "✏️": "lapiz", "✨": "chispa", "🎉": "celebrar", "👍": "pulgar", "☰": "menu", "🅿️": "estacionado", "▶️": "play", "▶": "play", "⏸️": "pausa", "⏸": "pausa",
};

/** Expresión que encuentra cualquiera de esos emojis en un texto (los más largos primero). */
export const REGEX_EMOJI = new RegExp(
  Object.keys(EMOJI_A_ICONO).sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/️/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "️?").join("|"),
  "gu",
);

/** Nombre del ícono para un emoji (con o sin selector de variación). */
export function iconoDeEmoji(e: string): NombreIcono | null {
  return EMOJI_A_ICONO[e] ?? EMOJI_A_ICONO[e.replace(/️/g, "")] ?? EMOJI_A_ICONO[`${e}️`] ?? null;
}

/** SVG completo de un ícono, listo para insertar. */
export function svgIcono(nombre: NombreIcono, op: { tam?: number | string; color?: string; acento?: string; clase?: string } = {}): string {
  const { tam = 24, color = "currentColor", acento = AMARILLO_ESCOLAR, clase } = op;
  // Un var() de CSS va como estilo: en atributos de presentación no todos los navegadores lo aceptan.
  const interior = ICONOS[nombre].replace(/fill="ACENTO"/g, acento.startsWith("var(") ? `style="fill:${acento}"` : `fill="${acento}"`)
    .replace(/currentColor/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" ${clase ? `class="${clase}" ` : ""}width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${interior}</svg>`;
}
