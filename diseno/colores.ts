// Paleta de Furgón Escolar (fuente única de los colores).
//
// Proporción 70 / 20 / 10:
//  · 70 % blanco (o el fondo oscuro en modo oscuro): fondos y tarjetas.
//  · 20 % amarillo escolar: la acción principal, lo seleccionado y los acentos de los íconos.
//  · 10 % gris: bordes, separadores, textos secundarios y superficies de apoyo.
// Combinación extra: azul marino solo para enlaces y avisos informativos, para que el amarillo
// destaque sin competir. Verde y rojo se reservan para estados (confirmado / alerta).

export interface Paleta {
  fondo: string;       // 70 %: fondo de pantalla
  superficie: string;  // tarjetas, hojas y campos
  superficie2: string; // gris muy suave para zonas de apoyo
  borde: string;       // gris: bordes y separadores
  texto: string;       // texto principal
  suave: string;       // gris: texto secundario
  amarillo: string;    // 20 %: acción principal y selección
  sobreAmarillo: string; // texto sobre amarillo
  amarilloSuave: string; // resaltes muy puntuales
  marino: string;      // enlaces y avisos informativos
  verde: string;
  rojo: string;
}

export const PALETA: { claro: Paleta; oscuro: Paleta } = {
  claro: {
    fondo: "#FFFFFF", superficie: "#FFFFFF", superficie2: "#F3F4F6", borde: "#E3E5E8",
    texto: "#14181F", suave: "#5F6672",
    amarillo: "#F5B700", sobreAmarillo: "#1F1A00", amarilloSuave: "#FFF7DB",
    marino: "#1E3A5F", verde: "#1E8E3E", rojo: "#D93025",
  },
  oscuro: {
    fondo: "#0E1116", superficie: "#161A21", superficie2: "#1E232B", borde: "#2A313B",
    texto: "#F3F4F6", suave: "#9AA3AE",
    amarillo: "#F7C21A", sobreAmarillo: "#1A1500", amarilloSuave: "#2E2810",
    marino: "#8DB8E6", verde: "#4DC47F", rojo: "#FF6B5E",
  },
};

export type PreferenciaTema = "sistema" | "claro" | "oscuro";
