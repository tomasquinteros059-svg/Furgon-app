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
  amarilloBorde: string; // borde del botón principal (trazo de los íconos)
  amarilloHondo: string; // canto inferior del botón amarillo (se hunde al tocarlo)
  crema: string;         // fondo de los ítems dentro de una tarjeta (cada niño de la lista)
  rojoSuave: string;     // fondo de la etiqueta «Hoy no va»
  marino: string;      // enlaces y avisos informativos
  verde: string;
  rojo: string;
}

export const PALETA: { claro: Paleta; oscuro: Paleta } = {
  // Rediseño «Trazo y relleno» (octubre 2026): fondo amarillo muy suave, tarjetas blancas con borde.
  claro: {
    fondo: "#FDF9EC", superficie: "#FFFFFF", superficie2: "#F3EEDF", borde: "#E8E3D6",
    texto: "#1C1A16", suave: "#5B564D",
    amarillo: "#F5B700", sobreAmarillo: "#1F1A00", amarilloSuave: "#FFF3CC", amarilloBorde: "#7A5800", amarilloHondo: "#D9A200", crema: "#FDF9EC", rojoSuave: "#FBE4E1",
    marino: "#1E3A5F", verde: "#0A6C4C", rojo: "#C0261D",
  },
  oscuro: {
    fondo: "#14120B", superficie: "#1E1B12", superficie2: "#28241A", borde: "#3A3426",
    texto: "#F1EEE8", suave: "#ADA69B",
    amarillo: "#F0C23C", sobreAmarillo: "#1A1500", amarilloSuave: "#3A3116", amarilloBorde: "#F0C23C", amarilloHondo: "#B88F18", crema: "#191710", rojoSuave: "#3D1F1C",
    marino: "#93BCE8", verde: "#4FC79A", rojo: "#FF8A7D",
  },
};

export type PreferenciaTema = "sistema" | "claro" | "oscuro";
