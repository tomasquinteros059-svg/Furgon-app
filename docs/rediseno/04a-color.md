# Rediseño — Etapa 4a: color (percepción, contraste y daltonismo)

> Archivo base: `original/Furgon_Escolar_App.html` (tokens en las líneas 6-19) y `diseno/colores.ts`.
> Decisiones fijas del dueño: se queda el **amarillo furgón** como marca, se quedan los **íconos
> propios** (rellenan su acento con `var(--amarillo)`), tono cálido, modo claro y oscuro, un solo
> archivo, celular primero.

## Resumen (5 líneas)

1. El amarillo `#F5B700` se queda tal cual en modo claro (marca e íconos). Pero **sobre blanco
   mide 1,80:1**, así que nunca se usa como texto ni como única señal: para eso hay `--amarilloTexto`/`--amarilloBorde` (`#7A5800`, 6,51:1).
2. Hoy fallan **19 de los 44 pares medidos**: 11 solo en claro, 4 solo en oscuro y 4 en ambos. Los peores: texto blanco sobre el verde (4,21 en claro, 2,21 en oscuro), foco amarillo en claro (1,80), bordes de campos e interruptores (1,26), número blanco en las casas del mapa en oscuro (2,07) y colegio amarillo en el mapa (1,65).
3. La paleta propuesta **pasa todos los pares que exige WCAG 2.2 AA**. Solo queda el relleno amarillo sobre blanco, y ese se resuelve con borde o texto oscuro, no con color.
4. Verde, rojo y alerta **se confunden con daltonismo rojo-verde** (ΔE00 de 1,6 a 19,8 en la simulación de Machado 2009). Por eso cada estado lleva **ícono + palabra**, y en el mapa cada cosa tiene **su forma**.
5. Neutros cálidos (en vez de grises azulados), oscuro casi negro `#121110` con superficies más claras a medida que «suben», y un amarillo algo menos saturado en oscuro. Esto último es criterio de diseño; donde no encontré evidencia, lo marco como **hipótesis mía**.

**Sobre las fuentes.** En esta sesión el acceso directo a sitios web estaba bloqueado por la red. Solo pude usar un buscador, así que confirmé autor, año, título y el resumen de cada fuente, pero **no leí los textos completos**. Lo indico en cada fuente. Todos los números de contraste y daltonismo los **calculé yo** con scripts (no vienen de una fuente).

---

## 1. Tabla de tokens

Un **token** es un color con nombre (por ejemplo `--texto`) que se define una sola vez y se usa en todo el
archivo. Si cambia el valor, cambia en toda la app. Los nombres que ya existían **se mantienen**, así que no se rompe nada; los nuevos están marcados con ★.

### Marca y acciones

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--amarillo` | `#F5B700` | `#F0C23C` | Marca. Botón principal, elegido en segmentos y en el selector de rol, relleno de acento de los íconos, alarma, furgón del mapa. **Nunca es texto sobre fondo claro.** |
| `--sobreAmarillo` | `#1F1A00` | `#1A1500` | Texto e íconos sobre amarillo |
| `--amarilloSuave` | `#FFF3CC` | `#3A3116` | Resaltes suaves (chip «ya subió», fila destacada) |
| ★ `--amarilloTexto` | `#7A5800` | `#F3CD62` | Cuando se quiere «amarillo» en texto o en un ícono de trazo sobre fondo claro |
| ★ `--amarilloBorde` | `#7A5800` | `#F0C23C` | Borde interior de 2 px del elemento elegido (segmento, rol), para que el estado se note con 3:1 |
| `--marino` | `#1E3A5F` | `#93BCE8` | Secundario: enlaces, botones de texto, avisos informativos, ruta y casas en el mapa, foco en claro |
| ★ `--sobreMarino` | `#FFFFFF` | `#0E1622` | Texto sobre marino (número de la casa en el mapa) |
| ★ `--marinoSuave` | `#E7EEF6` | `#1D2A3A` | Fondo de aviso informativo |

### Neutros, superficies y texto (el «70 % blanco» y el «10 % gris»)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--mesa` | `#ECE9E3` | `#090807` | Fondo detrás del «teléfono» (solo en pantallas grandes) |
| `--fondo` | `#FBFAF7` | `#121110` | Fondo de pantalla, el 70 %. En claro es blanco cálido, en oscuro casi negro cálido |
| `--superficie` | `#FFFFFF` | `#1B1A17` | Tarjetas, hojas, campos, barra inferior. En oscuro es **más clara** que el fondo (se ve «más arriba») |
| `--superficie2` | `#F4F1EB` | `#25231F` | Zonas de apoyo: segmentos, chips neutros, avisos |
| `--borde` | `#E4DFD6` | `#38342E` | Separadores y bordes de tarjeta (decorativos: no necesitan 3:1) |
| ★ `--bordeFuerte` | `#857E73` | `#8A8378` | Borde de campos de formulario y pista del interruptor apagado (sí necesitan 3:1) |
| `--texto` | `#1C1A16` | `#F1EEE8` | Texto principal (no es negro ni blanco puros) |
| `--suave` | `#5B564D` | `#ADA69B` | Texto secundario, pestañas no elegidas |

### Foco y controles

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| ★ `--foco` | `#1E3A5F` | `#F0C23C` | Anillo de foco del teclado (3 px, separado 2 px) |
| ★ `--perilla` | `#FFFFFF` | `#121110` | Círculo del interruptor |
| ★ `--capa` | `rgba(28,26,22,.45)` | `rgba(0,0,0,.6)` | Velo detrás de las hojas o modales |
| ★ `--sombra` | `0 20px 50px -20px rgba(28,26,22,.35)` | `0 20px 50px -20px rgba(0,0,0,.7)` | Sombra del «teléfono» |

### Estados (siempre con ícono y palabra, ver §5)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--verde` | `#0A6C4C` | `#4FC79A` | Éxito / confirmado / «ya subió» / recorrido activo |
| ★ `--verdeSuave` | `#E2F3EC` | `#16302A` | Fondo del chip o aviso de éxito |
| `--rojo` | `#C0261D` | `#FF8A7D` | Error / peligro / «hoy no va» / borrar |
| ★ `--rojoSuave` | `#FBE7E5` | `#3D1F1C` | Fondo del chip o aviso de error |
| ★ `--alerta` | `#A14F00` | `#F4A55A` | Advertencia (pago por vencer, sin señal). Es naranjo tostado, **distinto del amarillo de marca** |
| ★ `--alertaSuave` | `#FDEEDD` | `#3A2716` | Fondo de aviso de advertencia |
| ★ `--sobreEstado` | `#FFFFFF` | `#121110` | Texto sobre botón verde o rojo y número sobre casa lista. En oscuro es **oscuro**, porque el verde y el rojo son claros |

### Mapa SVG

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--manzana` | `#ECE8E0` | `#211F1B` | Fondo del mapa (manzanas) |
| `--calle` | `#FFFFFF` | `#36322C` | Calles. Contraste bajo **a propósito**: son contexto, no información |
| ★ `--ruta` | `#1E3A5F` | `#93BCE8` | Línea punteada del recorrido (sin la opacidad .7 de hoy) |
| ★ `--casa` | `#1E3A5F` | `#93BCE8` | Círculo de casa pendiente, con número |
| ★ `--casaLista` | `#0A6C4C` | `#4FC79A` | Círculo de casa ya atendida, con **✓** en vez de número |
| ★ `--halo` | `#FFFFFF` | `#121110` | Contorno de 2,5 px de casas y colegio, que los separa de la ruta (hoy es `#fff` fijo) |
| ★ `--colegio` | `#1C1A16` | `#F1EEE8` | Cuadrado del colegio (antes era amarillo) |
| ★ `--sobreColegio` | `#FFFFFF` | `#121110` | Letra o ícono dentro del colegio |
| ★ `--furgon` | `#F5B700` | `#F0C23C` | Carrocería del furgón: **lo único amarillo del mapa** |
| ★ `--furgonBorde` | `#1F1A00` | `#1A1500` | Contorno del furgón |
| ★ `--furgonVidrio` | `#BFE3F5` | `#A9D3EA` | Ventanas |
| ★ `--furgonRueda` | `#15202B` | `#0A0908` | Ruedas |

### Alias por función (opcionales; apuntan a los de arriba)

`--primario` → `--amarillo` · `--sobrePrimario` → `--sobreAmarillo` · `--acento` → `--amarillo`
(los íconos) · `--secundario` → `--marino` · `--info` → `--marino` · `--infoSuave` → `--marinoSuave` ·
`--exito` → `--verde` · `--exitoSuave` → `--verdeSuave` · `--error` → `--rojo` · `--errorSuave` →
`--rojoSuave`.

> **Primario y acento son el mismo tono a propósito.** La marca tiene un solo color protagonista.
> Si se agrega un segundo color llamativo, compite con el amarillo (ver §6, atención).

### Mapeo token viejo → token nuevo (y valores fijos que hay que reemplazar)

Ningún token se renombra: los 15 de hoy (`fondo, superficie, superficie2, borde, texto, suave,
amarillo, sobreAmarillo, amarilloSuave, marino, verde, rojo, mesa, calle, manzana`) siguen con el mismo nombre y
solo cambian de valor. **`var(--amarillo)` en los íconos sigue funcionando sin tocar nada.**
Lo que sí hay que cambiar en el HTML son los colores escritos a mano:

| Hoy (en el HTML) | Pasa a ser |
|---|---|
| `.btn.exito`, `.btn.peligro` → `color:#fff` | `color: var(--sobreEstado)` |
| `.interruptor` → `background: var(--borde)` | `background: var(--bordeFuerte)` |
| `.interruptor::after` → `background:#fff` | `background: var(--perilla)` |
| `.campo input/textarea/select` → `border: 1px solid var(--borde)` | `border-color: var(--bordeFuerte)` |
| `:focus-visible` → `outline: 3px solid var(--amarillo)` | `outline: 3px solid var(--foco)` |
| `.capa` → `rgba(0,0,0,.45)` · `.telefono` → `box-shadow …` | `var(--capa)` · `var(--sombra)` |
| `.chip.ok` / `.chip.no` → `color-mix(… 18 % / 16 %)` | `background: var(--verdeSuave)` / `var(--rojoSuave)` |
| Segmento o rol elegido (`aria-pressed="true"`) | agregar `box-shadow: inset 0 0 0 2px var(--amarilloBorde)` |
| Mapa: `stroke="var(--marino)" … opacity=".7"` (ruta) | `stroke="var(--ruta)"`, sin opacidad |
| Mapa: casas `fill=var(--marino)/var(--verde)`, `stroke="#fff"`, texto `fill="#fff"` | `var(--casa)` / `var(--casaLista)`, `stroke="var(--halo)"`, texto `var(--sobreMarino)` / `var(--sobreEstado)`; la casa lista muestra «✓» |
| Mapa: colegio `fill="var(--amarillo)"` y texto `var(--sobreAmarillo)` | `var(--colegio)` y `var(--sobreColegio)` |
| Mapa: furgón `#F5B700`, `#1F1A00`, `#BFE3F5`, `#15202B` | `var(--furgon)`, `var(--furgonBorde)`, `var(--furgonVidrio)`, `var(--furgonRueda)` |
| Alarma: botón con `background:var(--sobreAmarillo);color:var(--amarillo)` | se mantiene (9,66:1 en claro) |

`diseno/colores.ts` (la app Expo) no se toca en esta etapa. Si se aprueba la paleta, después hay que
copiar ahí los mismos valores para que la app y la maqueta coincidan.

---

## 2. Bloque CSS listo para pegar

Reemplaza el bloque de las líneas 6-19 del original (deja `--ui` y `--mono` como están).

```css
:root {
  color-scheme: light;
  /* Marca y acciones */
  --amarillo: #F5B700; --sobreAmarillo: #1F1A00; --amarilloSuave: #FFF3CC;
  --amarilloTexto: #7A5800; --amarilloBorde: #7A5800;
  --marino: #1E3A5F; --sobreMarino: #FFFFFF; --marinoSuave: #E7EEF6;
  /* Neutros cálidos */
  --mesa: #ECE9E3; --fondo: #FBFAF7; --superficie: #FFFFFF; --superficie2: #F4F1EB;
  --borde: #E4DFD6; --bordeFuerte: #857E73; --texto: #1C1A16; --suave: #5B564D;
  /* Foco y controles */
  --foco: #1E3A5F; --perilla: #FFFFFF;
  --capa: rgba(28, 26, 22, .45); --sombra: 0 20px 50px -20px rgba(28, 26, 22, .35);
  /* Estados */
  --verde: #0A6C4C; --verdeSuave: #E2F3EC; --rojo: #C0261D; --rojoSuave: #FBE7E5;
  --alerta: #A14F00; --alertaSuave: #FDEEDD; --sobreEstado: #FFFFFF;
  /* Mapa */
  --manzana: #ECE8E0; --calle: #FFFFFF; --ruta: #1E3A5F; --casa: #1E3A5F; --casaLista: #0A6C4C;
  --halo: #FFFFFF; --colegio: #1C1A16; --sobreColegio: #FFFFFF;
  --furgon: #F5B700; --furgonBorde: #1F1A00; --furgonVidrio: #BFE3F5; --furgonRueda: #15202B;
  /* Alias por función (no se redefinen en oscuro: siguen a los de arriba) */
  --primario: var(--amarillo); --sobrePrimario: var(--sobreAmarillo); --acento: var(--amarillo);
  --secundario: var(--marino); --info: var(--marino); --infoSuave: var(--marinoSuave);
  --exito: var(--verde); --exitoSuave: var(--verdeSuave); --error: var(--rojo); --errorSuave: var(--rojoSuave);
  /* Tipografía (sin cambios) */
  --ui: "Inter", "Roboto", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  color-scheme: dark;
  --amarillo: #F0C23C; --sobreAmarillo: #1A1500; --amarilloSuave: #3A3116;
  --amarilloTexto: #F3CD62; --amarilloBorde: #F0C23C;
  --marino: #93BCE8; --sobreMarino: #0E1622; --marinoSuave: #1D2A3A;
  --mesa: #090807; --fondo: #121110; --superficie: #1B1A17; --superficie2: #25231F;
  --borde: #38342E; --bordeFuerte: #8A8378; --texto: #F1EEE8; --suave: #ADA69B;
  --foco: #F0C23C; --perilla: #121110;
  --capa: rgba(0, 0, 0, .6); --sombra: 0 20px 50px -20px rgba(0, 0, 0, .7);
  --verde: #4FC79A; --verdeSuave: #16302A; --rojo: #FF8A7D; --rojoSuave: #3D1F1C;
  --alerta: #F4A55A; --alertaSuave: #3A2716; --sobreEstado: #121110;
  --manzana: #211F1B; --calle: #36322C; --ruta: #93BCE8; --casa: #93BCE8; --casaLista: #4FC79A;
  --halo: #121110; --colegio: #F1EEE8; --sobreColegio: #121110;
  --furgon: #F0C23C; --furgonBorde: #1A1500; --furgonVidrio: #A9D3EA; --furgonRueda: #0A0908;
} }
:root[data-theme="dark"] {
  color-scheme: dark;
  --amarillo: #F0C23C; --sobreAmarillo: #1A1500; --amarilloSuave: #3A3116;
  --amarilloTexto: #F3CD62; --amarilloBorde: #F0C23C;
  --marino: #93BCE8; --sobreMarino: #0E1622; --marinoSuave: #1D2A3A;
  --mesa: #090807; --fondo: #121110; --superficie: #1B1A17; --superficie2: #25231F;
  --borde: #38342E; --bordeFuerte: #8A8378; --texto: #F1EEE8; --suave: #ADA69B;
  --foco: #F0C23C; --perilla: #121110;
  --capa: rgba(0, 0, 0, .6); --sombra: 0 20px 50px -20px rgba(0, 0, 0, .7);
  --verde: #4FC79A; --verdeSuave: #16302A; --rojo: #FF8A7D; --rojoSuave: #3D1F1C;
  --alerta: #F4A55A; --alertaSuave: #3A2716; --sobreEstado: #121110;
  --manzana: #211F1B; --calle: #36322C; --ruta: #93BCE8; --casa: #93BCE8; --casaLista: #4FC79A;
  --halo: #121110; --colegio: #F1EEE8; --sobreColegio: #121110;
  --furgon: #F0C23C; --furgonBorde: #1A1500; --furgonVidrio: #A9D3EA; --furgonRueda: #0A0908;
}
body { background: var(--mesa); color: var(--texto); }
```

Nota técnica: los alias (`--primario: var(--amarillo)`, etc.) se resuelven en el mismo elemento
`:root` donde el modo oscuro cambia `--amarillo`, así que siguen al tema sin repetirlos.

---

## 3. Contrastes calculados (actual vs propuesto)

**Cómo se calculó.** Usé la fórmula oficial de WCAG 2.x. Cada canal sRGB se pasa a lineal con
c ≤ 0,04045 → c/12,92; si no, ((c+0,055)/1,055)^2,4. Luego la luminancia relativa es
L = 0,2126·R + 0,7152·G + 0,0722·B, y el contraste es (L_clara + 0,05)/(L_oscura + 0,05). El rango va de
1:1 (igual) a 21:1 (negro sobre blanco).

En los colores con transparencia, primero mezclé el color con el fondo, como lo hace el
navegador: `color-mix` 18 % en los chips de hoy, opacidad .7 en la ruta de hoy. Script en Python,
sin librerías.

**Mínimos (WCAG 2.2 AA):** 4,5:1 para texto normal; 3:1 para texto grande (≥ 24 px, o ≥ 18,66 px en
negrita); 3:1 para componentes de interfaz, estados y gráficos necesarios (criterio 1.4.11). La
marca ✗ indica que no llega al mínimo.

| Par | Mín | Actual claro | Actual oscuro | Propuesto claro | Propuesto oscuro |
|---|---|---|---|---|---|
| Texto principal sobre fondo | 4.5:1 | 17.79 | 17.18 | 16.65 | 16.29 |
| Texto principal sobre tarjeta | 4.5:1 | 17.79 | 15.85 | 17.37 | 15.03 |
| Texto secundario sobre tarjeta | 4.5:1 | 5.78 | 6.83 | 7.28 | 7.21 |
| Texto secundario sobre superficie2 (chips, segmentos) | 4.5:1 | 5.26 | 6.18 | 6.46 | 6.50 |
| Texto sobre botón amarillo | 4.5:1 | 9.66 | 11.02 | 9.66 | 10.85 |
| Amarillo usado como texto/acento sobre tarjeta¹ | 4.5:1 | 1.80 ✗ | 10.54 | 6.51 | 11.37 |
| Amarillo de marca (relleno) vs tarjeta² | 3.0:1 | 1.80 ✗ | 10.54 | 1.80 ✗ | 10.35 |
| Enlace / botón texto (marino) sobre fondo | 4.5:1 | 11.50 | 9.12 | 11.02 | 9.52 |
| Texto sobre botón verde («Aceptar») | 4.5:1 | 4.21 ✗ | 2.21 ✗ | 6.44 | 8.95 |
| Texto sobre botón rojo | 4.5:1 | 4.77 | 2.79 ✗ | 5.94 | 8.25 |
| Rojo como texto («Eliminar ruta») sobre tarjeta | 4.5:1 | 4.77 | 6.24 | 5.94 | 7.61 |
| Verde como texto sobre tarjeta | 4.5:1 | 4.21 ✗ | 7.91 | 6.44 | 8.26 |
| Chip «ok» de hoy: verde sobre color-mix 18 % | 4.5:1 | 3.36 ✗ | 5.62 | 4.92 | 5.86 |
| Chip «ok» propuesto: verde sobre verdeSuave | 4.5:1 | — | — | 5.60 | 6.69 |
| Chip «no» de hoy: rojo sobre color-mix 16 % | 4.5:1 | 3.75 ✗ | 4.97 | 4.56 | 5.74 |
| Chip «no» propuesto: rojo sobre rojoSuave | 4.5:1 | — | — | 4.99 | 6.51 |
| Aviso info: texto sobre marinoSuave | 4.5:1 | — | — | 14.86 | 12.55 |
| Segmento/rol elegido: relleno amarillo vs superficie2 | 3.0:1 | 1.64 ✗ | 9.54 | 1.60 ✗ | 9.33 |
| Segmento/rol elegido: borde amarilloBorde vs superficie2³ | 3.0:1 | 1.64 ✗ | 9.54 | 5.78 | 9.33 |
| Chip «ya subió»: texto sobre amarilloSuave | 4.5:1 | 16.59 | 13.37 | 15.67 | 11.12 |
| Alerta como texto sobre alertaSuave | 4.5:1 | — | — | 5.08 | 7.00 |
| Borde de campo de formulario vs tarjeta | 3.0:1 | 1.26 ✗ | 1.33 ✗ | 4.02 | 4.64 |
| Separador decorativo (no exige mínimo) | — | 1.26 | 1.33 | 1.33 | 1.41 |
| Anillo de foco vs fondo | 3.0:1 | 1.80 ✗ | 11.42 | 11.02 | 11.22 |
| Anillo de foco vs tarjeta | 3.0:1 | 1.80 ✗ | 10.54 | 11.50 | 10.35 |
| Borde de tarjeta verde vs fondo | 3.0:1 | 4.21 | 8.57 | 6.17 | 8.95 |
| Borde de tarjeta roja vs fondo | 3.0:1 | 4.77 | 6.77 | 5.69 | 8.25 |
| Interruptor apagado: pista vs tarjeta | 3.0:1 | 1.26 ✗ | 1.33 ✗ | 4.02 | 4.64 |
| Interruptor: perilla vs pista apagada | 3.0:1 | 1.26 ✗ | 13.12 | 4.02 | 5.03 |
| Interruptor: perilla vs pista verde | 3.0:1 | 4.21 | 2.21 ✗ | 6.44 | 8.95 |
| Interruptor: perilla vs pista roja | 3.0:1 | 4.77 | 2.79 ✗ | 5.94 | 8.25 |
| Punto rojo de notificación vs barra | 3.0:1 | 4.77 | 6.24 | 5.94 | 7.61 |
| Toast (colores invertidos) | 4.5:1 | 17.79 | 17.18 | 16.65 | 16.29 |
| Mapa: calle vs manzana (contexto, bajo a propósito) | — | 1.25 | 1.26 | 1.22 | 1.29 |
| Mapa: ruta vs manzana | 3.0:1 | 4.51 | 4.61 | 9.41 | 8.30 |
| Mapa: ruta vs calle | 3.0:1 | 4.01 | 3.91 | 11.50 | 6.43 |
| Mapa: casa vs manzana | 3.0:1 | 10.54 | 7.98 | 9.41 | 8.30 |
| Mapa: número sobre casa | 4.5:1 | 11.50 | 2.07 ✗ | 11.50 | 9.16 |
| Mapa: casa lista vs manzana | 3.0:1 | 3.85 | 7.50 | 5.27 | 7.81 |
| Mapa: número o ✓ sobre casa lista | 4.5:1 | 4.21 ✗ | 2.21 ✗ | 6.44 | 8.95 |
| Mapa: colegio vs manzana | 3.0:1 | 1.65 ✗ | 10.00 | 14.22 | 14.21 |
| Mapa: letra sobre colegio | 4.5:1 | 9.66 | 11.02 | 17.37 | 16.29 |
| Mapa: furgón vs manzana (lo mejor entre relleno y contorno)⁴ | 3.0:1 | 15.96 | 9.18 | 14.25 | 9.78 |
| Mapa: furgón vs calle (lo mejor entre relleno y contorno) | 3.0:1 | 12.80 | 7.28 | 17.41 | 7.57 |

¹ Hoy no existe un token de «amarillo para texto»: la fila muestra lo que pasa si se usa `--amarillo`.
² **No tiene arreglo sin cambiar la marca.** Ningún amarillo claro llega a 3:1 sobre blanco: incluso
`#B8860B` (ya café) da 3,25. Se resuelve así: el botón amarillo se reconoce por su texto oscuro
(9,66:1), que es lo que pide 1.4.11; los estados llevan `--amarilloBorde`; y el amarillo nunca es la
única señal.
³ Hoy no hay borde: la fila «actual» repite el relleno.
⁴ En claro, el relleno amarillo casi no contrasta con la manzana (1,47), pero el contorno oscuro
sí (14,25). En oscuro pasa al revés: el contorno se pierde (1,11) y el relleno contrasta (9,78). Por
eso el furgón lleva siempre las dos cosas.

**Qué falla hoy, en simple:** en modo oscuro el texto blanco sobre el verde y el rojo claros casi no
se lee (2,2-2,8:1). En modo claro, el anillo de foco amarillo es casi invisible (1,8:1). Los
campos de formulario y el interruptor apagado no tienen borde visible (1,26:1). En el mapa en modo
oscuro, los números de las casas apenas se ven (2,07:1).

### 3.1 Al sol (la familia mira el celular en la calle)

Cuando el sol se refleja en la pantalla, a lo claro y a lo oscuro se les suma el mismo brillo
reflejado. Con eso el contraste efectivo es (L_clara·Lmáx + Lr)/(L_oscura·Lmáx + Lr). La fórmula es
la que usan los fabricantes de pantallas legibles al sol (fuentes 15).

Supuse que la pantalla da 800 cd/m² (Lmáx) y probé con 100 cd/m² y 450 cd/m² de reflejo (Lr). **Estos dos valores son
supuestos míos**, solo para comparar órdenes de magnitud; no los medí.

| Par | WCAG | Con reflejo de 100 | Con reflejo de 450 |
|---|---|---|---|
| Texto / fondo (claro) | 16.65 | 7.98 | 2.65 |
| Texto secundario propuesto / tarjeta | 7.28 | 5.13 | 2.38 |
| Texto secundario actual / tarjeta | 5.78 | 4.39 | 2.25 |
| Texto sobre botón amarillo | 9.66 | 4.86 | 1.91 |
| Blanco sobre verde actual / propuesto | 4.21 / 6.44 | 3.46 / 4.72 | 2.05 / 2.31 |
| Amarillo sobre blanco | 1.80 | 1.71 | 1.43 |
| Ruta / manzana (propuesto) | 9.41 | 5.62 | 2.27 |

Conclusión: al sol todo pierde contraste, y lo que en la sombra apenas pasaba deja de leerse primero. Por eso (a) la información clave, como el
tiempo de llegada, el nombre del niño o «Hoy no va», va en `--texto` (más de 15:1) y en tamaño grande,
no en `--suave`; (b) los estados no dependen de matices de color, que se pierden antes que el
brillo; (c) el mapa usa contrastes altos para la ruta, las casas y el colegio. El modo claro como opción por defecto para
uso exterior se apoya en la evidencia de polaridad de §6. Que una pantalla oscura «haga de espejo» y
muestre más el reflejo de la cara o del cielo es **hipótesis mía**.

---

## 4. Daltonismo: simulación y resultados

**Método.** Usé la simulación de Machado, Oliveira y Fernandes (2009) con severidad 1,0, que equivale a
la forma más fuerte (dicromacia). Se aplica en RGB lineal, con las matrices de la librería
`colour-science` 0.4.7. La diferencia la medí con ΔE00 (CIEDE2000). La propia librería advierte que la simulación tritán
de Machado es una aproximación.

Elegí Machado y no Brettel/Viénot porque modela también las formas **leves** (anomalías), que
son las más comunes, y es una sola matriz por tipo.

**¿Cuánta gente?** Cerca del 8 % de los hombres y del 0,4 % de las mujeres de ascendencia europea tiene
algún déficit rojo-verde (Birch 2012). **Para Chile no encontré un dato propio: no sé** la
cifra local.

### Cómo se ven los estados (hex simulados)

| Propuesto claro | Normal | Protán | Deután | Tritán |
|---|---|---|---|---|
| verde | `#0A6C4C` | `#6A634A` | `#5F5B4E` | `#006C63` |
| rojo | `#C0261D` | `#584E19` | `#7E7013` | `#D40026` |
| alerta | `#A14F00` | `#675A00` | `#7B6D00` | `#B13C43` |
| amarillo | `#F5B700` | `#D1B800` | `#E0C719` | `#FFA49C` |
| marino | `#1E3A5F` | `#2A3D61` | `#21365E` | `#004248` |

| Propuesto oscuro | Normal | Protán | Deután | Tritán |
|---|---|---|---|---|
| verde | `#4FC79A` | `#C3BA98` | `#B2AE9D` | `#00C7BA` |
| rojo | `#FF8A7D` | `#A59C7B` | `#C2B57B` | `#FF7887` |
| alerta | `#F4A55A` | `#BEAB53` | `#D0BD5B` | `#FF9494` |
| amarillo | `#F0C23C` | `#D9C025` | `#E4CD43` | `#FFB1A8` |
| marino | `#93BCE8` | `#ABBDEA` | `#A1B4E7` | `#77C6CB` |

### Diferencia entre pares (ΔE00; más alto = más distinguible)

| Par | Paleta | Normal | Protán | Deután | Tritán |
|---|---|---|---|---|---|
| verde vs rojo | actual claro | 67.4 | 15.0 | **8.4** | 63.3 |
| verde vs rojo | actual oscuro | 66.4 | 14.8 | **8.4** | 68.0 |
| verde vs rojo | propuesto claro | 58.7 | 11.0 | 19.4 | 57.4 |
| verde vs rojo | propuesto oscuro | 58.9 | **8.4** | 11.8 | 63.2 |
| verde vs alerta | propuesto claro | 44.6 | 13.3 | 19.8 | 52.5 |
| verde vs alerta | propuesto oscuro | 43.4 | 12.3 | 18.4 | 57.2 |
| rojo vs alerta | propuesto claro | 16.5 | **6.6** | **1.6** | **8.4** |
| rojo vs alerta | propuesto oscuro | 20.6 | 12.5 | **7.4** | **6.3** |
| alerta vs amarillo | propuesto claro | 35.3 | 34.7 | 29.8 | 30.1 |
| alerta vs amarillo | propuesto oscuro | 15.7 | 9.0 | **5.9** | **7.4** |
| verde (casa lista) vs marino (casa) | propuesto claro | 33.8 | 32.2 | 28.3 | 15.1 |
| verde (casa lista) vs marino (casa) | propuesto oscuro | 32.3 | 31.6 | 26.9 | 10.0 |

Para leer los ΔE00: ~1 es la diferencia mínima que se nota en laboratorio. Que por debajo de ~10 sea
**riesgoso para elementos chicos** como un chip o un punto es **regla práctica mía**, no un umbral
publicado que haya verificado.

**Resultados:**

- Con daltonismo rojo-verde, **verde y rojo se confunden** en ambas paletas: se ven como dos
  café oliva. Cambiar a un verde azulado (`#0A6C4C`, idea tomada de la paleta de Okabe e Ito) duplica la
  distancia para deuteranopía en claro (8,4 → 19,4), pero **no la vuelve segura**. En oscuro, para
  protán, no mejora.
- **Rojo y alerta son prácticamente iguales para un deután (1,6)**. Alerta y amarillo de marca se
  acercan en oscuro (5,9).
- Por lo tanto, **ningún estado puede depender solo del color** (WCAG 1.4.1, Uso del color).

### Redundancia obligatoria (forma + palabra + color)

| Elemento | Además del color lleva |
|---|---|
| Éxito («Ya subió», «Confirmado», tarjeta verde) | Ícono ✓ + palabra |
| Error / «Hoy no va» / borrar | Ícono ✕ o «no va» + palabra; los botones de borrar dicen «Eliminar …» |
| Alerta (pago, sin señal) | Triángulo ⚠ + palabra; nunca solo el borde naranjo |
| Info | Ícono «i» + texto |
| Chips | Siempre con ícono a la izquierda del texto (✓ / ✕ / reloj) |
| Avisos con borde izquierdo de color | Ícono al inicio; el borde es adorno, no la señal |
| Interruptor | La posición de la perilla ya es la señal; además, etiqueta de texto al lado |
| Mapa: casa pendiente / lista | Pendiente = círculo con **número**; lista = círculo con **✓**. La forma del contenido cambia, no solo el color |
| Mapa: colegio | **Cuadrado** (no círculo) con ícono de colegio o «C» |
| Mapa: furgón | Silueta de furgón; es lo **único amarillo** del mapa |
| Pestaña elegida | Negrita + ícono con relleno amarillo + texto `--texto` (los no elegidos van en `--suave` y sin relleno) |
| Segmento o rol elegido | Relleno amarillo + borde interior `--amarilloBorde` + `aria-pressed` |

---

## 5. Justificación de cada decisión (con fuente o «hipótesis mía»)

1. **Amarillo como marca.** No lo justifico con «el amarillo da alegría o energía». Una revisión de Elliot y Maier
   (2014) describe la psicología del color como un campo joven, con problemas de método:
   muchos estudios no controlan el tono, la claridad y la saturación por separado. Por eso **no uso efectos emocionales del color
   como argumento**. El argumento real es otro: en Chile, por norma, los furgones escolares son amarillos. Según la prensa, deben ser
   amarillos salvo algunos de mayor peso, que pueden ser blancos (fuente 14; conviene confirmarlo en el texto del Decreto 38 en bcn.cl).
   Las familias ya asocian ese color con «el furgón». Esa asociación es aprendida y local; **no es un
   efecto innato del color**.
2. **Un solo color llamativo, reservado.** El color es uno de los atributos que con más seguridad
   guían la atención visual (Wolfe y Horowitz 2004). Si solo una cosa por pantalla es amarilla (el
   botón principal, la alarma o el furgón en el mapa), la vista la encuentra primero. Por eso el colegio deja de
   ser amarillo. Que la proporción exacta 70/20/10 sea óptima es **convención de diseño, no
   ciencia**: la mantengo porque es regla del proyecto, no porque haya evidencia del número.
3. **Carga cognitiva: pocos tonos y siempre con el mismo significado** (amarillo = acción o furgón,
   marino = información o ruta, verde = listo, rojo = no o peligro, naranjo tostado = advertencia). Que esto
   reduzca el esfuerzo de aprender la app es **hipótesis mía**, razonable pero no la medí. Que
   rojo signifique «no» y verde «sí» es una convención cultural (semáforo), no algo biológico.
4. **Modo claro por defecto y texto oscuro sobre fondo claro.** Piepenbrock y otros (2013) encontraron
   ventaja de la polaridad positiva (oscuro sobre claro) en agudeza visual y corrección de textos, en
   jóvenes y en mayores. Buchner, Mayr y Brandt (2009) la atribuyen a la mayor luminancia de la
   pantalla, que achica la pupila y da una imagen más nítida. Dobres y otros (2017), en lectura de
   «vistazo», dicen que la ventaja es pequeña y más bien una «desventaja» de la polaridad
   negativa. NN/g (Budiu 2020) resume lo mismo para usuarios de visión normal. Conclusión: el modo oscuro
   se ofrece (preferencia y uso de noche), pero no se vende como «mejor para la vista».
5. **Sin blanco puro con negro puro en grandes áreas** (`#1C1A16` sobre `#FBFAF7`). **No encontré
   evidencia** de que esto reduzca la fatiga visual. Lo elijo por **tono cálido (hipótesis
   estética mía)**, y porque deja que la tarjeta `#FFFFFF` se vea «encima» del fondo. El costo es mínimo:
   17,37 → 16,65:1.
6. **Oscuro casi negro, no negro puro, y superficies más claras al subir.** Material Design 2
   recomienda `#121212` como superficie base y mostrar la elevación aclarando la superficie, porque en
   fondo oscuro las sombras no se ven (fuente 10). Usé `#121110`, la misma luminancia pero cálida.
7. **Amarillo algo menos saturado en oscuro** (`#F0C23C`, saturación HSL 0,86, contra 1,00 de `#F5B700`).
   Que los colores muy saturados «vibren» sobre fondo oscuro lo recuerdo de la guía de Material, pero
   **no pude confirmarlo en esta sesión: tómalo como hipótesis mía**. Lo que sí está medido es
   que el contraste se mantiene: 10,85:1 con su texto y 11,22:1 contra el fondo.
8. **Texto claro sobre oscuro no es blanco puro** (`#F1EEE8`). El «halo» o halación que verían
   las personas con astigmatismo es muy repetido en blogs, pero **no encontré un estudio riguroso**:
   es hipótesis.
9. **Verde azulado y rojo bermellón oscuros.** La idea viene de la paleta de Okabe e Ito (2008),
   pensada para daltonismo (verde azulado `#009E73`, bermellón `#D55E00`). Sus valores exactos no
   sirven con texto blanco (3,42 y 3,87:1), así que oscurecí los tonos hasta pasar 4,5:1.
10. **Foco marino en claro y amarillo en oscuro.** El criterio 1.4.11 pide 3:1 para los indicadores
    visuales de estado. El foco amarillo actual mide 1,80:1 en claro. Con marino da 11,02:1. En oscuro el amarillo da 11,22:1,
    así que se mantiene y conserva la marca.
11. **Borde fuerte para campos e interruptores.** Según 1.4.11, lo que permite reconocer un control debe
    tener 3:1. Hoy el borde de los campos mide 1,26:1. Los separadores decorativos siguen suaves (1,33:1)
    para no recargar la pantalla.
12. **Chips con fondos fijos en vez de `color-mix`.** Con porcentajes de mezcla, el contraste depende
    del fondo que haya detrás, y hoy falla (3,36 y 3,75:1). Con tokens fijos queda medido (5,60 y 4,99:1).
13. **Mapa.** Calles con poco contraste a propósito (1,22:1): son contexto. Ruta, casas y colegio
    van sobre 5:1. El contorno `--halo` separa los íconos de la ruta. Que esta jerarquía haga el mapa
    más rápido de leer se apoya en el punto 2 (atención); cuánto más rápido, **no lo sé**.

---

## 6. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Oscurecer el amarillo de marca hasta 3:1 sobre blanco | Hay que llegar a un café mostaza (`#B8860B` = 3,25:1): se pierde la marca y el color del furgón real. Mejor un token aparte (`--amarilloTexto`) |
| Medir con APCA (el método de contraste del borrador WCAG 3) | WCAG 3 sigue siendo borrador y le faltan años; lo exigible hoy es WCAG 2.2. Se puede revisar más adelante |
| Mantener el verde `#1E8E3E` | Texto blanco 4,21:1, no llega a 4,5. Y para deután se confunde más con el rojo (ΔE 8,4 vs 19,4) |
| Usar tal cual los colores de Okabe e Ito | Con texto blanco no pasan 4,5:1 (3,42 y 3,87) |
| Fondo blanco puro `#FFFFFF` | Válido (el contraste sería algo mayor). Se descartó solo por tono cálido y para que la tarjeta se separe del fondo; la diferencia es chica |
| Negro puro `#000000` en oscuro (ahorra batería en OLED) | No hay forma de mostrar «capas» con superficies más claras, y Material recomienda gris muy oscuro. No medí el ahorro de batería |
| Texto blanco sobre botones verde y rojo también en oscuro | 2,21 y 2,79:1. En oscuro el texto sobre estado va oscuro (`--sobreEstado`) |
| Colegio amarillo en el mapa | Compite con el furgón (los dos amarillos) y en claro mide 1,65:1. Pasa a cuadrado de color tinta |
| Foco amarillo también en claro | 1,80:1, invisible para mucha gente |
| Distinguir estados solo por color (más saturación) | La simulación muestra que rojo, verde y alerta colapsan con daltonismo; ningún ajuste de tono lo arregla del todo |
| Simulación Brettel/Viénot | Sirve para dicromacia, pero Machado cubre también las anomalías leves (las más comunes) con el mismo método |
| Usar «el azul da confianza» u otros significados emocionales | La evidencia es débil y depende de la cultura (Elliot y Maier 2014). El marino se elige por contraste y para no competir con el amarillo |

---

## 7. Glosario

- **Token (de diseño):** un nombre para un valor, por ejemplo `--texto: #1C1A16`. Se cambia en un lugar y
  se actualiza en todos lados.
- **sRGB:** el espacio de color estándar de las pantallas. Los números hex (`#F5B700`) están en sRGB.
- **RGB lineal:** los mismos colores pero «sin la curva gamma», es decir, proporcionales a la luz real. Hay que
  pasar a lineal antes de sumar luces.
- **Luminancia relativa (L):** cuánta luz emite un color comparado con el blanco (0 = negro, 1 = blanco),
  ponderando más el verde porque el ojo es más sensible a él (0,2126 R + 0,7152 G + 0,0722 B).
- **Razón de contraste:** (L clara + 0,05)/(L oscura + 0,05). Va de 1:1 a 21:1. El 0,05 representa un poco de luz ambiente.
- **WCAG 2.2 AA:** las pautas de accesibilidad web del W3C. «AA» es el nivel que se exige normalmente.
- **Texto grande:** ≥ 24 px, o ≥ 18,66 px en negrita (18 pt y 14 pt en la norma).
- **Componente de interfaz (1.4.11):** botón, campo, interruptor, foco, etc. Lo que permite identificarlo y ver
  su estado debe tener 3:1.
- **Anillo de foco:** el borde que marca qué elemento está activo al navegar con teclado.
- **Polaridad positiva/negativa:** texto oscuro sobre fondo claro (positiva) o claro sobre oscuro
  (negativa, el «modo oscuro»).
- **Contraste efectivo al sol:** el contraste que queda cuando el reflejo de la luz ambiente se suma a lo
  claro y a lo oscuro de la pantalla.
- **Daltonismo / deficiencia de visión de color:** protán (falla el cono del rojo), deután (el del verde),
  tritán (el del azul). «Anomalía» es la forma leve; «dicromacia», la fuerte (severidad 1,0 en Machado).
- **ΔE00 (CIEDE2000):** número que estima cuán distintos se ven dos colores para una persona. Cerca de 1 es
  apenas perceptible.
- **Saturación / croma:** qué tan «puro» o intenso es un color, frente a uno agrisado.
- **Atributo que guía la atención:** propiedad visual (color, movimiento, orientación) que hace que algo
  «salte a la vista» sin buscarlo uno por uno.
- **Elevación:** la sensación de que una tarjeta está «encima» de otra. En oscuro se logra aclarando la
  superficie, no con sombra.
- **Halación:** el efecto de que el texto claro sobre fondo oscuro parezca «sangrar» o brillar alrededor.
- **`prefers-color-scheme` / `data-theme`:** la preferencia de tema del sistema del teléfono y el
  interruptor manual de la app que la reemplaza.
- **`color-mix`:** función CSS que mezcla dos colores en un porcentaje.
- **OLED:** tipo de pantalla donde el negro es un píxel apagado.

---

## 8. Fuentes

Confirmé autor, año, título y resumen con un buscador web. El acceso directo a las páginas
estaba bloqueado por la red de esta sesión, así que **no leí los textos completos**. Donde un DOI
lo pongo de memoria, lo digo.

1. W3C (2023). *Web Content Accessibility Guidelines (WCAG) 2.2* — definición de luminancia relativa
   y razón de contraste. https://www.w3.org/TR/WCAG22/ y
   https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html
2. W3C. *Understanding SC 1.4.11 Non-text Contrast* (3:1 para componentes y gráficos).
   https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast
3. W3C. *Understanding SC 1.4.3 Contrast (Minimum)* y *1.4.1 Use of Color*.
   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ·
   https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html (URL estándares; no las abrí en esta sesión).
4. Machado, G. M., Oliveira, M. M., y Fernandes, L. A. F. (2009). *A Physiologically-based Model for
   Simulation of Color Vision Deficiency*. IEEE TVCG 15(6), 1291-1298. DOI 10.1109/TVCG.2009.113.
   https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
5. Colour Developers. *colour-science* 0.4.7, `colour.blindness.machado2009` (matrices usadas).
   https://colour.readthedocs.io/en/v0.4.7/_modules/colour/blindness/machado2009.html · Nota sobre RGB
   lineal: https://zeileis.codeberg.page/colorspace/articles/color_vision_deficiency.html
6. Birch, J. (2012). *Worldwide prevalence of red-green color deficiency*. JOSA A 29(3), 313-320.
   DOI 10.1364/JOSAA.29.000313. https://doi.org/10.1364/JOSAA.29.000313
7. Elliot, A. J., y Maier, M. A. (2014). *Color psychology: Effects of perceiving color on psychological
   functioning in humans*. Annual Review of Psychology 65, 95-120. (DOI de memoria:
   10.1146/annurev-psych-010213-115035). Ficha: https://www.scinapse.io/papers/2164901293 ·
   Revisión relacionada: Elliot (2015), Frontiers in Psychology,
   https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00368/full
8. Piepenbrock, C., Mayr, S., Mund, I., y Buchner, A. (2013). *Positive display polarity is advantageous
   for both younger and older adults*. Ergonomics 56(7). (DOI de memoria: 10.1080/00140139.2013.790485).
   Ficha: https://documentacion.fundacionmapfre.org/documentacion/bib/143702.do
9. Buchner, A., Mayr, S., y Brandt, M. (2009). *The advantage of positive text-background polarity is
   due to high display luminance*. Ergonomics. https://madoc.bib.uni-mannheim.de/26118/
10. Google. *Material Design 2 — Dark theme* (`#121212`, elevación con superficies más claras).
    https://m2.material.io/design/color/dark-theme
11. Dobres, J., Chahine, N., y Reimer, B. (2017). *Effects of ambient illumination, contrast polarity,
    and letter size on text legibility under glance-like reading*. Applied Ergonomics 60. (DOI de
    memoria: 10.1016/j.apergo.2016.11.001). La conclusión la tomé de cómo la cita
    https://arxiv.org/pdf/2203.16546
12. Budiu, R. (2020). *Dark Mode vs. Light Mode: Which Is Better?* Nielsen Norman Group.
    https://www.nngroup.com/articles/dark-mode/
13. Wolfe, J. M., y Horowitz, T. S. (2004). *What attributes guide the deployment of visual attention
    and how do they do it?* Nature Reviews Neuroscience 5. https://search.bwh.harvard.edu/new/pubs/WolfeHorowitzNRN04.pdf
14. Furgón escolar amarillo en Chile (prensa y guías, no el texto legal):
    https://www.t13.cl/noticia/nacional/en-debes-fijarte-hora-contratar-furgon-escolar-tus-hijos ·
    https://practicatest.cl/blog/articulos-especiales/furgones-escolares-requisitos — Norma citada: Decreto
    Supremo N° 38 (2003) del Ministerio de Transportes y Telecomunicaciones (verificar versión vigente en https://www.bcn.cl).
15. Contraste efectivo con luz ambiente (pantallas legibles al sol):
    https://lcd.creol.ucf.edu/Publications/2012/JDT%20Cheng%20Sunlight%20readable.pdf ·
    https://riverdi.com/blog/what-makes-a-monitor-sunlight-readable
16. Okabe, M., e Ito, K. (2008). *Color Universal Design (CUD): How to make figures and presentations
    that are friendly to colorblind people*. https://jfly.uni-koeln.de/color/ · Difundida por Wong, B.
    (2011), *Points of view: Color blindness*, Nature Methods 8, 441 (DOI de memoria: 10.1038/nmeth.1618).
17. W3C. *WCAG 3.0 Working Draft* (estado de borrador; APCA). https://www.w3.org/TR/WCAG30/ ·
    https://www.yatil.net/blog/wcag-3-is-not-ready-yet
