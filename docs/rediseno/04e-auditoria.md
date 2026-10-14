# Rediseño — Etapa 4e: auditoría de accesibilidad y calidad (revisión adversarial)

Autor/a: auditoría de accesibilidad y calidad · 14-10-2026.
Revisé completos `01-inventario.md`, `03-diagnostico.md`, `04a-color.md`, `04b-identidad.md`,
`04c-ux.md`, `04d-movimiento.md` y el código de `original/Furgon_Escolar_App.html` (más su
diferencia con `Furgon_Escolar_Familias.html`). No edité ningún otro archivo.

Cómo verifiqué: contrastes **recalculados por mí** con un script Python sin librerías (fórmula
oficial WCAG 2.x); tamaños y funciones de las fuentes **descargando** los archivos de Google Fonts
y abriéndolos con fontTools; la ley con búsqueda web (los sitios .gob.cl y bcn.cl no abrieron desde
este entorno, así que el texto exacto lo tomé de reproducciones; lo marco).

---

## 0. Veredicto en 5 líneas

1. **Se puede implementar, pero no tal cual**: los 4 documentos se contradicen en 12 puntos
   (color de la ruta, animaciones infinitas, botón al presionar, alto de los botones, menú en hoja vs.
   pestaña «Más», duración del toast…). Abajo elijo una solución para cada uno (§4).
2. **Los números de 04a son correctos** (coinciden al centésimo los 44 pares), pero la paleta **no
   «pasa todo»**: el anillo de foco falla dentro del toast (claro y oscuro) y dentro de la alarma
   amarilla en oscuro (1,00:1), y «Deshacer» en amarillo dentro del toast oscuro mide 1,45:1.
3. Hay **4 bloqueantes nuevos** que nadie vio: «Deshacer» un «Ausente» hace que el motor marque al
   niño «Subió» solo; la alarma como `role="alert"` dentro de `#pantalla` se volvería a anunciar en
   cada redibujo; el foco se pierde en **cada** toque (no solo en el recorrido); y falta `lang="es"`.
4. La cita de la **Ley 21.377 es correcta en lo esencial** (Ley No Chat, 12-10-2021, art. 199 n.º 5
   de la Ley 18.290, gravísima, 1,5–3 UTM y suspensión de 5–45 días); lo del semáforo y el motor
   apagado es interpretación de autoridades y prensa, no texto de la ley. Pero la misma ley **invalida**
   el argumento de los botones de 76 px (esa cifra es para tocar *manejando*).
5. **Exceso de alcance**: el gesto de arrastrar la hoja, el sistema FLIP con «fantasmas» completo,
   el minimapa por hijo, las pantallas de «cargando/error» y la sincronización Cobros↔Pagos no
   pagan su costo en una maqueta. Recomiendo dejarlos fuera de la primera versión (§7).

---

## 1. Tabla de hallazgos

Gravedad: **B** = bloqueante (rompe una función, la accesibilidad mínima o la ley), **I** =
importante (hay que resolverlo antes de implementar), **M** = menor.

| # | Grav. | Doc. | Problema | Corrección concreta |
|---|---|---|---|---|
| H1 | **B** | 04c, 04d | **«Deshacer» o corregir un estado después de que el furgón pasó la casa no funciona.** El motor (F-04) marca `entregado` cuando `etaMin === 0 && estado === "pendiente"`. Si la tía deshace «Subió» o «Ausente» y el estado vuelve a `pendiente`, en el siguiente tick (250 ms) el motor lo marca `entregado` solo. Peor: deshacer un «Ausente» termina mostrando **«Subió al furgón»** a la familia. | Guardar `rec.manual[id] = true` cuando la tía toca o corrige; el motor solo marca automáticamente si `!rec.manual[id]`. Deshacer devuelve al estado anterior guardado (no siempre a `pendiente`). Incluir `manual` en la firma. |
| H2 | **B** | 04d §4.9 | La alarma como `role="alert"` **dentro de `#pantalla`**: cada `pintar()` completo (cambia la firma cuando otro niño es avisado o entregado) la destruye y la crea de nuevo con contenido → el lector de pantalla la vuelve a gritar. Además, si los minutos que se parchan están **dentro** de la región viva, se anunciarían cada ~2,5 s (en la demo, 25 min caben en 62 s). | Un solo anunciador oculto fijo **fuera** de `#pantalla` (`<div id="anuncio" role="alert">` vacío al cargar). Se le escribe texto **una vez** cuando aparece la alarma («El furgón llega en unos 4 minutos por Sofía») y una vez en el recordatorio de 2 min. La tarjeta visible de la alarma **no** es región viva. |
| H3 | **B** | todos | **El foco del teclado se pierde en cada toque**, no solo en el recorrido: `pintar()` reemplaza `#pantalla` entero en cada clic (interruptor, segmento, ↑↓, «Deshacer»…). 04d lo resuelve solo para ↑↓ y para el menú. | Regla general al final de `pintar()`: si antes del redibujo el foco estaba en un elemento con `data-k` (o `id`), enfocar el elemento nuevo con la misma clave (`preventScroll: true`); si ya no existe, enfocar el `<h1>` de la pantalla. |
| H4 | **B** | original, ninguno lo cita | El HTML no tiene `lang`: `<html>` sin idioma (y además `<title>` y la hoja de fuentes quedaron dentro de `<body>` por un envoltorio del archivo subido). WCAG 3.1.1 (nivel A): el lector lee el español con voz inglesa. | `<!doctype html><html lang="es-CL"><head><meta charset="utf-8">…<title>` en el `<head>`. |
| H5 | **B** | 04a | Anillo de foco **dentro del toast** (fondo invertido): marino sobre `--texto` claro = **1,51:1**; amarillo sobre `--texto` oscuro = **1,45:1**. Y «Deshacer» en amarillo dentro del toast oscuro = **1,45:1**. Con el «Deshacer» de 04c/04d esto se vuelve necesario. | Dentro del toast: `--foco: var(--fondo)` (16,65 / 16,29) y «Deshacer» en el mismo color del texto del toast, en negrita y subrayado. |
| H6 | **B** | 04a + 04b | Anillo de foco **dentro de la alarma amarilla en oscuro**: amarillo sobre amarillo = **1,00:1** (invisible). En claro, marino sobre amarillo = 6,38 (pasa). | `.alarma { --foco: var(--sobreAmarillo); }` (9,66 / 10,85 en ambos modos). |
| H7 | **I** | 04c R-j vs 04b | Botones del recorrido: 04c pide **76 px** (Android Auto) y 24 px de separación; 04b define **56 px**. La cifra de 76 dp es para pantallas del auto que se tocan **mientras se maneja**; el propio 04c dice que la tía no debe tocar manejando (Ley 21.377). Fuente mal aplicada. | **56 px de alto**, ancho completo o mitad, **16 px** de separación. Mantener lo bueno de 04c: zona del pulgar abajo y solo 2 botones grandes por parada. |
| H8 | **I** | 04b vs 04a | Color de la **ruta en el mapa**: 04b la quiere amarilla con contorno oscuro; 04a la define marino y declara el furgón «lo único amarillo del mapa». Amarillo sobre manzana en claro = **1,47:1**; el contorno oscuro sobre manzana en oscuro = **1,11:1**. | Gana **04a**: ruta marino punteada sin opacidad (9,41 / 8,30). |
| H9 | **I** | 04b vs 04d | **Animaciones infinitas**: 04b pone ondas en la alarma «una vez por segundo», halo del furgón que late y punto «en curso» que late. 04d prohíbe toda animación infinita decorativa (WCAG 2.2.2, nivel A). | Gana **04d**: campana 3 ciclos (< 5 s) y quieta; halo y punto **fijos**. Lo único que se mueve sin parar es el furgón. |
| H10 | **I** | 04c vs 04d | **Menú ⋮**: 04c lo elimina (pasa a pestaña «Más»); 04d dedica §4.7 y §4.7.1 a una hoja inferior con gesto de arrastre para ese menú. | Gana **04c** (pestaña «Más»). El `<dialog>` de 04d se usa para: confirmar eliminar ruta, confirmar terminar, hoja «Comenzar», hoja de minutos de aviso y hoja «Nueva ruta». **Sin** gesto de arrastre en v1. |
| H11 | **I** | 04d §4.7 | Con `<dialog>`, Esc cierra el diálogo **nativamente** pero `S.menu`/`S.confirmar` siguen activos → el siguiente `pintar()` lo vuelve a abrir. Además `showModal()` sobre uno ya abierto puede lanzar error. | Escuchar `cancel` y `close` para limpiar `S` y llamar `pintar()`; abrir solo `if (!dlg.open)`. |
| H12 | **I** | 04d §4.7 | Un `<dialog>` modal se dibuja respecto de **la ventana**, no del «teléfono». En escritorio la hoja inferior aparecería pegada al borde de abajo del navegador, fuera del marco. | En pantallas > 480 px: centrar el diálogo con `max-width` igual al teléfono, o posicionarlo con el `getBoundingClientRect()` de `#telefono`. Probar en 1280×800. |
| H13 | **I** | 04d | `::backdrop { background: var(--capa) }`: en Safari anterior a la herencia nueva de `::backdrop` (cambio de la especificación de 2023; **verificar versión exacta**) las variables de `:root` no llegan al fondo y queda transparente. | `background: var(--capa, rgba(28,26,22,.45));` con valor de respaldo escrito. |
| H14 | **I** | 04d §2.1 | La firma no incluye nada que cambie con el «recordatorio a los 2 min», pero 04d dice que se dispara «una vez por la firma»: así nunca se dispararía. | Guardar `rec.recordado[id] = true` en el tick cuando `eta <= 2` y meterlo en la firma (junto a `manual` de H1). |
| H15 | **I** | 04d §2.2 | `conMovimiento` llama `entrarPantalla()` **sin** el parámetro de dirección (queda `undefined` → sin desplazamiento y con duración «media»). Y el interruptor de §4.2 anida `data-k` dentro de `data-k`, que la propia regla de 04d prohíbe. | Pasar la dirección (`"hermana"`, `"hija"`, `"volver"`) según la vista de origen y destino; la perilla lleva solo `data-v`. |
| H16 | **I** | 04d §2.2 | Los «fantasmas» son copias con `cloneNode(true)`: duplican `id` (`pf-nombre`, `resp-1`…) mientras dura la animación; `getElementById` podría tomar la copia si queda antes en el documento. | Al clonar, quitar todos los `id`, `for` y `name` del clon; la capa de fantasmas va **después** de `#pantalla` en el HTML. |
| H17 | **I** | 04c §5.2, F-76 | La hoja «Comenzar» antes de iniciar no debe aplicarse al botón de Familias «Simular que la tía inicia…» (F-76): la familia nunca ve pantallas de la tía, y según §0 del inventario «al iniciar solo lleva a la tía si el rol es tía». | `data-iniciar-demo` llama directo a `iniciar()`; la hoja solo existe en el rol tía. |
| H18 | **I** | 04c §5.2.4 | «El furgón llegó» en vez de «Subió» cuando nadie confirmó: es buena idea, pero requiere un dato nuevo (quién marcó). Si no se define, se rompe el texto de F-72 y F-80 («Tus hijos ya subieron»). | Con el campo `manual` de H1: `entregado && !manual` → «El furgón llegó a tu casa»; `entregado && manual` → «Subió». Decide el dueño. |
| H19 | **I** | 04c Fa-d, 04b, 04d §4.2 | **Tres diseños distintos** del «Hoy no va»: dos píldoras (04b), «Mañana: va / no va» (04c), interruptor con `aria-label` «no viaja» (04d). | Gana **04c** con interruptor `role="switch"`: etiqueta **fija y afirmativa** «Va en la mañana» (marcado = va), texto visible «Sí va» / «No va» al lado, bloqueado con «Ya subió» tras subir. Toda la fila es la zona táctil (≥ 48 px). |
| H20 | **I** | original + 04d | WCAG 2.5.3 (Etiqueta en el nombre): el interruptor de hoy muestra «Ida (mañana)» pero su nombre accesible es «Sofía Demo: no viaja ida» (no contiene el texto visible). ↑ ↓ ✕ se llaman «Subir», «Bajar», «Quitar» sin decir de quién (tres «Subir» iguales). | Nombre accesible = texto visible + contexto: `aria-labelledby="nombre-sofia fila-manana"`; ↑ = «Subir a Sofía Demo», ✕ = «Quitar a Sofía Demo de la ruta». |
| H21 | **I** | original, nadie | El punto rojo de «Mensajes» (y el futuro de «Más») es un `<span>` vacío: el lector de pantalla no sabe que hay algo pendiente (1.1.1 y 1.4.1). | Texto oculto visualmente dentro del botón: «Mensajes, 1 sin responder». |
| H22 | **I** | 04c §6, 04b | Barra de 5 pestañas de la tía en 320 px: 64 px por pestaña; «Mensajes» en Atkinson 700 a 14 px mide ≈ 66–70 px. No cabe, y al 200 % de texto menos. | 13 px en la barra, `overflow-wrap: anywhere` y permitir **dos líneas** (la barra crece). Nunca ocultar las etiquetas. |
| H23 | **I** | original, 04c | Celular **acostado** (ancho 844 > 480): se aplica el diseño de escritorio con `min-height: 560px` en un alto de ~390 px → la barra inferior queda fuera de la vista. Y `100vh` en iPhone incluye la barra de direcciones. | Tratar como pantalla completa también con `@media (max-height: 500px)`; usar `height: 100dvh` con `100vh` de respaldo. |
| H24 | **I** | 04c C-b vs 04d §4.8 | Duración del toast: 04c dice 4 s / 8 s con «Deshacer»; 04d dice `max(2600, 1200 + 50·letras)`, tope 6 s, 5 s con «Deshacer». | Gana **04c**: **4 s**, **8 s** con «Deshacer», en pausa mientras tiene el foco, el puntero o el dedo encima. Siempre hay un lugar fijo para corregir. |
| H25 | **I** | 04b vs 04d | Botón al presionar: 04b baja 3 px y aplasta la base («tecla»); 04d escala .97 + velo. Mismo selector `.btn:active`, efectos opuestos. | Botones con base (amarillo principal): `translateY(3px)` + base que se achica (identidad A). Resto: solo velo de opacidad. Sin `scale`. Con «reducir movimiento»: solo velo. Clase `.presionado` en `pointerdown` (04d) para iPhone. |
| H26 | **I** | 04b §3 | `--sombra-2` (`var(--texto)`) y `--sombra-boton` (mezcla con `--texto`) **no se redefinen en oscuro**: la «base más oscura» del botón amarillo se vuelve **más clara** que el botón (luminancia 0,68 contra 0,57) y la sombra de la alarma es una franja crema. | En oscuro: `--sombra-boton: 0 4px 0 0 color-mix(in srgb, var(--amarillo) 55%, #000)` y `--sombra-2: none` (la tarjeta destacada se marca con su borde de 2 px). |
| H27 | **I** | 04b vs 04a | Botón dentro de la alarma: 04b lo quiere «píldora oscura sobre `--texto`»; en oscuro `--texto` es crema → píldora crema sobre amarillo (borde 1,45:1). 04a mantiene fondo `--sobreAmarillo` con texto amarillo. | Gana **04a**: fondo `--sobreAmarillo`, texto `--amarillo` (9,66 / 10,85). |
| H28 | **I** | WCAG 2.4.11 | Con barra fija abajo y toast encima, un elemento enfocado con teclado puede quedar **tapado** (criterio nuevo de WCAG 2.2, AA). | `#pantalla { scroll-padding-bottom: 96px }` y el toast no se pone encima del elemento enfocado. |
| H29 | **I** | 04c §4, 04c M-a | Respuestas rápidas con emoji («Recibido 👍») contradicen «cero emojis en la interfaz» (04b). | «Recibido, gracias». |
| H30 | **I** | Familias, F-82 | La respuesta automática a los 4 s llama `pintar()` completo: si la familia está escribiendo otro mensaje, **se borra lo que escribe** (rompe la regla de F-06). | La respuesta automática respeta la regla «no redibujar con un campo enfocado» (reintenta al salir del campo) y lleva la etiqueta visible «(respuesta simulada)», como propone 03. |
| H31 | M | 04a | «Fallan 19 de los 44 pares»: 4 de los 44 no tienen valor actual (son pares nuevos); son **19 de 40**. Una fila («amarillo como texto») es hipotética porque ese uso no existe hoy. | Corregir el texto; no cambia ninguna decisión. |
| H32 | M | 04b | 04b cita «solo los SVG de `diseno/iconos.ts`» y «faltan 3 íconos», pero la maqueta trae solo 26 íconos: `confirmado`, `prohibido`, `pulgar`, `colegio`, `estacionado`, `celebrar` y `play` existen en `iconos.ts` y **no** en el HTML. | Copiar esos 7 al objeto `ICONOS` del HTML, más los 3 nuevos (`vuelta`, `sumar`, `en_vivo`). |
| H33 | M | 04b §5.4 | «Ícono sobre amarillo: el acento pasa a `--superficie`». Si se hace redefiniendo `--amarillo` en `.alarma`, también cambia **el fondo de la alarma** (que usa la misma variable). | Redefinir solo en los íconos: `.alarma .ico, .btn:not(.sec) .ico { --amarillo: var(--superficie); }`. |
| H34 | M | 04b §6 | La familia: «solo su casa y el furgón; nada más» quitaría el colegio, que el original sí le muestra (F-07). «Relleno amarillo» en su casa compite con el furgón (regla de 04a). | La familia ve su casa (marino, con ícono o ⌂), el colegio y el furgón. |
| H35 | M | 04d §2.1 | `parcheVivo` aplica `Math.max(1, …)` a todos los minutos; en la tía el original mostraba 0. | Usar `max(1)` solo en la familia, como hoy. |
| H36 | M | 04a vs 04b | Tokens duplicados con valores distintos: `--capa` (04a: tinta cálida .45 / negro .6; 04b: negro .45). 04a deja `--ui: "Inter"` «sin cambios» y 04b reemplaza Inter. | Valen los `--capa` de 04a. `--ui: var(--f-texto)` como alias; se elimina `--mono` (el código FAM-7K2Q va en Atkinson 700 con espaciado). |
| H37 | M | 04b, 04c | Tamaño táctil mínimo: 44 px (04c, 04d) contra 48 px (04b). | **48 px** (`--toque-min`), que cumple los dos. |
| H38 | M | 04b | «~4 min»: los lectores en español leen «tilde 4 min». | Visible «4 min» en números grandes; en texto, «unos 4 min». |
| H39 | M | rendimiento | La foto de perfil se guarda como data URL del archivo completo (varios MB de una cámara) y se reinyecta en `innerHTML` en cada `pintar()` (y se clona en los fantasmas). | Reducir la foto a ~256 px con `<canvas>` antes de guardarla. |
| H40 | M | privacidad | La regla del proyecto (`cerca_de_otra_casa`) oculta el furgón real cerca de la casa de otro niño; la maqueta no lo hace (tampoco el original). El furgón suave de 04d hace más fácil seguir su trayecto. | No es del contrato F-07. Si el dueño quiere que la demo muestre la regla real: en modo familia, ocultar el furgón cuando está a menos de ~15 unidades de otra casa. Decide el dueño. |
| H41 | M | 04d §4.4 vs 04c R-d | Para evitar el toque doble sobre la tarjeta que sube: 04c desactiva los botones medio segundo; 04d ignora clics 450 ms. Desactivar (`disabled`) **hace perder el foco**. | 04d: ignorar `[data-marcar]` durante 450 ms por marca de tiempo, sin `disabled`. |

---

## 2. Contrastes recalculados

Script propio (Python, sin librerías): canal → lineal con c ≤ 0,04045 → c/12,92; si no
((c+0,055)/1,055)^2,4; L = 0,2126 R + 0,7152 G + 0,0722 B; razón = (L₁+0,05)/(L₂+0,05).

### 2.1 Pares de 04a: coinciden

Recalculé los 44 pares de la tabla de 04a: **todos coinciden al centésimo** (incluidos los valores
«actuales» del original: blanco/verde 4,21 y 2,21; blanco/rojo 4,77 y 2,79; foco amarillo 1,80;
número de casa en oscuro 2,07; colegio 1,65; borde de campo 1,26 y 1,33). También coinciden
`#B8860B`/blanco = 3,25, Okabe-Ito `#009E73` = 3,42 y `#D55E00` = 3,87, y la tabla «al sol»
(7,98 y 2,65 para texto/fondo). Los ΔE00 de daltonismo **no** los recalculé (necesitan la librería
`colour-science`).

| Par (propuesta 04a) | Mín. | Claro | Oscuro |
|---|---|---|---|
| Texto / fondo | 4,5 | 16,65 | 16,29 |
| Texto / tarjeta | 4,5 | 17,37 | 15,03 |
| Texto suave / tarjeta | 4,5 | 7,28 | 7,21 |
| Texto suave / fondo | 4,5 | 6,98 | 7,82 |
| Texto suave / superficie2 (chips, segmentos) | 4,5 | 6,46 | 6,50 |
| Texto suave sobre fondos suaves (amarillo/marino/verde/rojo/alerta) | 4,5 | 6,13–6,57 | 5,34–6,17 |
| Texto sobre botón amarillo | 4,5 | 9,66 | 10,85 |
| Texto sobre botón verde / rojo (`--sobreEstado`) | 4,5 | 6,44 / 5,94 | 8,95 / 8,25 |
| Rojo como texto / tarjeta | 4,5 | 5,94 | 7,61 |
| Alerta como texto / fondo | 4,5 | 5,54 | 9,32 |
| Chip verde / verdeSuave · rojo / rojoSuave | 4,5 | 5,60 · 4,99 | 6,69 · 6,51 |
| Marino (enlace) / fondo | 4,5 | 11,02 | 9,52 |
| Foco / fondo · tarjeta · superficie2 | 3 | 11,02 · 11,50 · 10,20 | 11,22 · 10,35 · 9,33 |
| Borde de campo / tarjeta · fondo · superficie2 | 3 | 4,02 · 3,85 · 3,56 | 4,64 · 5,03 · 4,18 |
| Borde de campo / amarilloSuave (tarjeta destacada) | 3 | 3,62 | 3,43 |
| Interruptor: perilla / pista apagada · verde · roja | 3 | 4,02 · 6,44 · 5,94 | 5,03 · 8,95 · 8,25 |
| Segmento elegido: borde `--amarilloBorde` / superficie2 | 3 | 5,78 | 9,33 |
| Toast (colores invertidos) | 4,5 | 16,65 | 16,29 |
| Mapa: ruta / manzana · calle | 3 | 9,41 · 11,50 | 8,30 · 6,43 |
| Mapa: número / casa · ✓ / casa lista | 4,5 | 11,50 · 6,44 | 9,16 · 8,95 |
| Mapa: colegio / manzana · letra / colegio | 3 · 4,5 | 14,22 · 17,37 | 14,21 · 16,29 |
| Mapa: furgón relleno / manzana · contorno / manzana | 3 | 1,47 ✗ · 14,25 | 9,78 · 1,11 ✗ |

El furgón pasa porque **siempre** lleva relleno y contorno (en claro cuenta el contorno, en oscuro
el relleno), como dice 04a. Si alguien quita el contorno en claro, falla.

### 2.2 Pares que 04a no midió (y fallan)

| Par | Mín. | Claro | Oscuro | Arreglo |
|---|---|---|---|---|
| Foco `--foco` dentro del toast (fondo `--texto`) | 3 | **1,51 ✗** | **1,45 ✗** | `--foco: var(--fondo)` en el toast → 16,65 / 16,29 |
| «Deshacer» en amarillo dentro del toast | 4,5 | 9,64 | **1,45 ✗** | mismo color del texto del toast + subrayado |
| «Deshacer» en `--amarilloTexto` / `--marino` dentro del toast | 4,5 | 2,67 ✗ / 1,51 ✗ | 1,32 ✗ / 1,71 ✗ | no usarlos |
| Foco dentro de la alarma (amarillo) | 3 | 6,38 | **1,00 ✗** | `--foco: var(--sobreAmarillo)` → 9,66 / 10,85 |
| Píldora `--texto` (propuesta 04b) vs fondo de la alarma | 3 | 9,64 | **1,45 ✗** | usar el botón de 04a |
| Ruta amarilla (propuesta 04b) / manzana | 3 | **1,47 ✗** | 9,78 | ruta marino (04a) |
| Contorno oscuro de la ruta (04b) / manzana | 3 | 14,25 | **1,11 ✗** | ídem |
| Píldora de pestaña activa `--amarilloSuave` / barra (04d) | — | 1,11 | 1,35 | decorativa: válida solo porque hay negrita + ícono relleno + `aria-current` |
| Base del botón (`--sombra-boton`) / botón amarillo | — | 2,55 | 1,18 | decorativa; en oscuro queda más clara que el botón (H26) |
| `--amarilloBorde` / relleno amarillo en oscuro | — | 3,62 | 1,00 | sin efecto: en oscuro el relleno ya contrasta 9,33 con superficie2 |
| Botón deshabilitado (opacidad .45) | exento | 2,21 | 3,19 | exento por WCAG, pero **siempre** con texto que explique por qué (04c T-c) |

---

## 3. Fuentes: lo que comprobé

Descargué el CSS y los archivos «latin» de la URL recomendada en 04b:

- CSS: 3 229 bytes; **Fredoka 600 = 16 468 bytes**; **Atkinson Hyperlegible Next = 33 996 bytes**
  (un solo archivo variable para 400 y 700). Total ≈ **50 KB**: 04b es correcto.
- Fredoka **no** tiene `tnum` y sus cifras miden distinto (el «1» = 383 unidades, el «2» = 577):
  confirmado. Atkinson Next **sí** tiene `tnum`: confirmado. Ninguna trae «→» ni «≈»; las dos traen
  «~»: confirmado.
- Consecuencia: los números que cambian en vivo en Fredoka (minutos de la alarma y de «Furgón en
  vivo») van en una caja `min-width: 2ch; text-align: center`; todo número en listas y chips va en
  Atkinson con `font-variant-numeric: tabular-nums`. El número de parada (40 px) no cambia en vivo.

---

## 4. Contradicciones entre documentos y la solución elegida

| # | Tema | Qué dice cada uno | Solución elegida | Por qué |
|---|---|---|---|---|
| X1 | Tipografía | 04a: `--ui` Inter + `--mono` «sin cambios». 04b: Fredoka + Atkinson Next | **04b**; `--ui` pasa a alias de `--f-texto`; sin `--mono` | La identidad es tarea de 04b; peso similar (≈ 50 KB) |
| X2 | Tamaños de letra vs. layout | 04b `--t-alarma` 56 px; 04c «minutos en grande»; barra a 14 px | 56 px en la alarma y en «Furgón en vivo»; 13 px en la barra con dos líneas permitidas (H22) | Cabe en 320 px |
| X3 | Botones del recorrido | 04c 76 px; 04b 56 px | **56 px**, separación 16 px (H7) | 76 dp es para tocar manejando, lo que la ley prohíbe |
| X4 | Mínimo táctil | 44 (04c, 04d) / 48 (04b) | **48 px** | Cumple ambos |
| X5 | Menú | 04d hoja inferior con arrastre; 04c pestaña «Más» | **Pestaña «Más»**; `<dialog>` solo para confirmaciones y hojas cortas; sin arrastre (H10) | Navegación visible; menos código |
| X6 | Color de la ruta y de la casa de la familia | 04b amarillo; 04a marino y furgón único amarillo | **04a** (H8, H34) | Contraste y jerarquía |
| X7 | Casas del mapa | 04b ícono `casa` de 18 px con número en el círculo; 04a círculo con número / ✓ | **04a** | Ícono y número no caben en 20 px |
| X8 | Animaciones infinitas | 04b ondas, halo, punto que late; 04d ninguna | **04d** (H9) | WCAG 2.2.2 (nivel A) |
| X9 | Presionar | 04b `translateY(3px)`; 04d `scale(.97)` + velo | Combinado (H25) | Mantiene la «tecla» de la identidad |
| X10 | Sombras en oscuro | 04b solo redefine `--sombra-1` | Redefinir `--sombra-2` y `--sombra-boton` (H26) | Hoy se invierten |
| X11 | Toast | 04c 4 s / 8 s; 04d fórmula, tope 6 s, 5 s con «Deshacer» | **04c** (H24) | Más tiempo y más simple |
| X12 | «Hoy no va» | 04b píldoras; 04c «va / no va»; 04d interruptor «no viaja» | **Interruptor afirmativo** (H19) | Sin doble negación; nombre fijo |
| X13 | Botón de la alarma | 04b píldora `--texto`; 04a `--sobreAmarillo` | **04a** (H27) | Falla en oscuro |
| X14 | Textos | «Ausente» (04b) / «No estaba» (04c); «Familia avisada / Aviso pendiente» (04b) / «Avisada / Se le avisa 7 min antes» (04c); «Recibido, te espero» (04b) / «Recibido» + «Ver dónde viene» (04c) | Botón **«No estaba»**, estado en la lista **«Ausente»**; chips **«Familia avisada» / «Se avisa 7 min antes»**; alarma con **«Ver dónde viene»** y **«Recibido, te espero»** | Lo más informativo de cada uno |
| X15 | Ícono del menú | 04b «usar `menu` ☰ en vez de ⋮» | ☰ es el ícono de la pestaña «Más» | Ya no hay ⋮ |
| X16 | Evitar el toque doble | 04c desactivar 0,5 s; 04d ignorar 450 ms | **04d** (H41) | `disabled` pierde el foco |
| X17 | Radios y movimiento | 04b radios de 22–28 px; 04d FLIP | Sin conflicto: FLIP solo mueve con `transform`; el velo usa `border-radius: inherit` | — |

---

## 5. Riesgos de perder funciones (contra el inventario)

La tabla de trazabilidad de 04c (§8) está completa: **ningún F-xx desaparece**. Pero estos
cambios de flujo tienen trampas:

| F-xx | Propuesta | Riesgo | Condición para aprobarla |
|---|---|---|---|
| F-01–F-03 | Ninguna toca el motor | — | No cambiar `puntosRuta`, `largo`, `puntoEn`, `etaMin` |
| F-04 | Deshacer y corregir estados (04c, 04d) | **H1**: el motor vuelve a marcar solo | Campo `manual` |
| F-04 | Hoja «Comenzar» | Romper F-76 | **H17** |
| F-04 / F-72 / F-80 | «El furgón llegó» si nadie confirmó | Textos incoherentes | **H18**, decide el dueño |
| F-05 | Confirmación si quedan pendientes; nuevo texto («Recorrido cerrado…») | Cambia el texto del contrato | Aceptable si el dueño aprueba el texto; anotarlo en la verificación |
| F-06 | Firma + parche | Que deje de cumplirse «no redibujar con un campo enfocado» y «conservar el desplazamiento» | Mantener las dos reglas en el redibujo completo; `pintar.firma` solo se actualiza cuando sí se dibujó |
| F-07 | Mapa más bajo / plegable (tía), más alto (familia), onda en casas | Que el modo familia muestre la ruta, otras casas o pierda el colegio | La familia ve: su casa, el colegio, el furgón. `aria-label` del mapa fijo, sin listar casas |
| F-08 | Cálculo automático + sugerencia en Hoy | Perder «El orden actual ya es el más corto» y «Descartar» | El botón «Calcular la mejor ruta» sigue en el detalle con sus 3 resultados |
| F-11 / F-60 | Consejos a la hoja «Comenzar» | «Volver a mostrar los avisos» queda sin sentido si ya no hay avisos que cerrar | Mantener la tarjeta de consejos la primera vez y el botón en «Más» |
| F-14 | Hoy con una ruta abierta | Perder «A buscar / A dejar hoy (n)» y el enlace a Google Maps | Mantener ambos en la tarjeta |
| F-20 | Próxima parada | Perder «● En curso», «Volver al inicio (el recorrido sigue)» y la lista «Atendidos» | Las tres siguen; la nota de minutos se reemplaza por la de cada parada (arreglo del defecto 5) |
| F-40 | Errores bajo el campo | La validación de hora `HH:MM` | Misma expresión regular |
| F-71 | «Ver dónde viene» cuenta como «Recibido» | — | Marca `confirmado` y navega a «Furgón en vivo» |
| F-73 | Interruptor afirmativo | Invertir mal el dato (`noVa` = no marcado) | `checked = !noVa`; probar ida y vuelta para los dos hijos |
| F-74 | Hoja con 5 opciones | Perder valores | Mismos valores 3 · 5 · 7 · 10 · 15, como grupo de opciones (`aria-pressed` o radios) |
| F-81 | «Avisaste el pago» | Hoy el dato es `pagado: true` | Estado nuevo `avisado`; «Me equivoqué» lo revierte |
| F-82 | Respuesta automática | **H30** | Respetar el campo enfocado y etiqueta «(simulada)» |
| F-91 | Toast fijo fuera de `#pantalla` | Que deje de verse en el marco del teléfono | Va dentro de `#telefono`, fuera de `#pantalla` |
| F-93 | Selector «Demo» más chico | Que baje de 48 px | Mínimo 48 px de alto, `aria-pressed` |
| F-94 | 320–430 px | **H23** | `dvh` y alto bajo |
| §0 | Modo `#familias` | Olvidar título, nota, alto, botón demo o respuesta automática | `document.title`, nota y alto según el modo; leerlo al cargar y en `hashchange` |

---

## 6. Requisitos de accesibilidad obligatorios (checklist verificable)

Cada punto se puede comprobar con un sí o un no en la etapa 6.

**Documento**
- [ ] `<html lang="es-CL">`, `<meta charset="utf-8">`, `<title>` en `<head>` según el modo.
- [ ] El `viewport` **no** lleva `maximum-scale` ni `user-scalable=no`.
- [ ] Un `<h1>` por pantalla; tarjetas con `<h2>`; listas con `<ul>/<li>`.
- [ ] Regiones: `<main id="pantalla">`, `<nav aria-label="Secciones">`; selector de rol en un grupo con nombre.

**Navegación y foco**
- [ ] La barra es `<nav>` con botones; la pestaña actual lleva `aria-current="page"`. **Sin** `role="tablist"`, `role="tab"` ni `aria-selected` (y el CSS que usaba `[aria-selected]` pasa a `[aria-current]`).
- [ ] Punto rojo con texto oculto («1 sin responder»).
- [ ] Tras **cualquier** `pintar()`, el foco vuelve al elemento con la misma clave; si desapareció, al `<h1>` (H3).
- [ ] Al cambiar de pantalla, foco al `<h1>` (`tabindex="-1"`).
- [ ] Durante el recorrido, con el foco en «Subió», pasan 10 s sin que el foco se pierda.
- [ ] Anillo de foco de 3 px, separado 2 px, color `--foco`; dentro del toast `--fondo`; dentro de la alarma `--sobreAmarillo` (H5, H6).
- [ ] Un elemento enfocado nunca queda tapado por la barra ni por el toast (2.4.11).
- [ ] Todo se puede hacer con teclado, en orden visual: selector de rol → pantalla → barra.

**Diálogos y hojas**
- [ ] `<dialog>` con `showModal()`; se cierra con Esc, con «Cancelar»/«Cerrar» y tocando fuera; `S` se limpia en `cancel`/`close` (H11).
- [ ] Foco inicial en la opción segura («Cancelar», «Seguir el recorrido»); al cerrar vuelve al botón que lo abrió.
- [ ] `aria-labelledby` apunta al título del diálogo.
- [ ] En escritorio, el diálogo se ve dentro del marco del teléfono (H12).
- [ ] Ningún gesto es la única forma de hacer algo (2.5.1).

**Regiones vivas**
- [ ] Un solo toast `role="status"` que existe vacío desde la carga, fuera de `#pantalla`.
- [ ] Un solo anunciador de alarma `role="alert"`, vacío al cargar, fuera de `#pantalla`; se escribe una vez por alarma y una vez por recordatorio (H2).
- [ ] Ningún número que se actualiza solo (minutos, furgón) está dentro de una región viva.
- [ ] El toast dura 4 s (8 s con «Deshacer»), se pausa con foco, puntero o dedo, y nunca es la única señal.

**Controles**
- [ ] Zonas táctiles ≥ 48 × 48 px: ✕ de avisos, ↑ ↓ ✕, avatar, «Volver», «cambiar», segmentos, «+ nombre», «Tomar foto», «Galería», filas de interruptores, «Deshacer» del toast, selector de rol.
- [ ] Botones del recorrido de 56 px, separados 16 px.
- [ ] Interruptores `role="switch"`, nombre fijo y afirmativo; el anillo de foco se ve en la pista (`input:focus-visible + .pista`).
- [ ] Segmentos y opciones con `aria-pressed` (o radios).
- [ ] El nombre accesible contiene el texto visible y dice de quién es (H20).
- [ ] Botones deshabilitados con un texto visible que explica por qué (`aria-describedby`).
- [ ] Errores de formulario bajo el campo, con `aria-invalid="true"` y `aria-describedby`; el foco va al primer campo con error.
- [ ] Campos de texto a 16 px.

**Color y movimiento**
- [ ] Los pares de §2 pasan en claro y oscuro (con el script de §2).
- [ ] Ningún estado se distingue solo por color (tabla de redundancia de 04a §4).
- [ ] No hay animación infinita salvo el furgón; la campana se mueve < 5 s y para.
- [ ] Con «reducir movimiento»: sin desplazamientos, escalas ni ondas; solo fundidos ≤ 150 ms; el furgón sigue.
- [ ] Nada parpadea más de 3 veces por segundo.

**Tamaño y orientación**
- [ ] Sin desplazamiento horizontal en 320, 360, 390 y 430 px de ancho.
- [ ] Al 200 % de zoom y con texto grande del sistema, no se corta ni se tapa texto (sin altos fijos en contenedores de texto).
- [ ] Funciona acostado (H23).
- [ ] Botones con borde transparente para que se vean en modo de alto contraste de Windows.

---

## 7. Rendimiento y exceso de alcance

**Rendimiento (bien encaminado).**
- Fuentes ≈ 50 KB (verificado), parecido al original. Mantener `preconnect` y `display=swap`.
- Firma + parche: el redibujo completo baja de 4 por segundo a unas 8–10 veces por recorrido. Es la
  mejora con más impacto en accesibilidad **y** en rendimiento: va primero.
- Furgón con `requestAnimationFrame`: un `setAttribute` por cuadro sobre un SVG de 300×200, costo
  despreciable; se detiene sin mapa. Correcto.
- FLIP: dos mediciones solo en toques; aceptable.
- Corregir la foto en data URL (H39).

**Exceso de alcance (lo digo con franqueza).**

| Propuesta | Costo | Beneficio en una maqueta | Recomendación |
|---|---|---|---|
| Arrastrar la hoja para cerrarla (04d §4.7.1) | ~30 líneas, umbrales a probar, choque con scroll | Bajo; además, el menú desaparece (X5) | **Fuera** |
| FLIP + fantasmas para todo (04d §2.2) | ~60 líneas, claves en todo el HTML, ids duplicados (H16), anidación (H15) | Medio | **Fase 2**, y solo para ↑↓ y marcar niños |
| Minimapa en la tarjeta de cada hijo (04b) | Otro SVG por hijo que se redibuja; más superficie de privacidad | Bajo | **Fuera** |
| Pantallas de «cargando» y «error» (04c §4) | Estados que la maqueta nunca muestra | Ninguno en la demo | **Solo documentarlas** |
| Cobros ↔ Pagos sincronizados (04c Mas-a) | Estado nuevo compartido | Bajo | Opcional |
| Cálculo automático de la mejor ruta + «Volver al orden anterior» (04c T-e) | Lógica nueva | Medio | Opcional; el botón manual basta |
| Vibración con patrones distintos (04d §6) | Pocas líneas | Solo Android | Se puede quedar, siempre opcional |
| ✓ que se «dibuja» (04d §4.4) | Poco | Bajo | Opcional |
| Franja «sin GPS» (04c) | — | La maqueta no tiene GPS | Solo documentarla |

**Orden recomendado:** H4 → firma + parche + furgón (con H1, H2, H14) → foco general (H3) → toast y
anunciador → `<dialog>` (H11, H12, H13) → nueva paleta y fuentes → flujos de 04c → presión de
botones → FLIP (fase 2).

---

## 8. Afirmaciones dudosas o sin fuente

| Doc. | Afirmación | Estado |
|---|---|---|
| 04c §0.6 y §5.1 | Ley 21.377 «Ley No Chat» | **Correcta en lo esencial.** Publicada en el Diario Oficial el **12-10-2021**; agrega el **n.º 5 al art. 199** de la Ley 18.290 (y suprime el n.º 32 del art. 200): conducir manipulando un teléfono móvil u otro aparato electrónico no incorporado de fábrica, salvo manos libres según el reglamento, pasa de grave a **gravísima**: multa de **1,5 a 3 UTM** y suspensión de la licencia de **5 a 45 días** (BCN, vía buscador). Lo de «ambas manos en el volante» viene del **reglamento** de manos libres (Decreto 73, 2022), no del artículo. «También detenido en un semáforo» y «solo detenido y con el motor apagado» son **interpretaciones** de CONASET, autoridades y prensa, no texto de la ley. 04c cita la fecha de despacho en la Cámara (22-09-2021), no la de publicación. Su «no sé» sobre tocar con el furgón detenido y el motor encendido es honesto: lo debe ver un abogado. |
| 04c R-j | 76 × 76 dp de Google | La cifra existe (Android Auto), pero es para pantallas del auto que se tocan **manejando**; mal aplicada aquí (H7). |
| 04c R-i | Hoober 2013: 49 % usa el celular con una mano | Dato correcto, pero la tía usa el teléfono **en un soporte**: no se aplica a ella (sí a la familia). |
| 04c §0.1 | Toques perdidos según duración | Creíble y coherente con el código: si el botón se reemplaza entre `pointerdown` y `pointerup`, el clic cae en el contenedor y la delegación no encuentra `data-*`. No lo repetí. |
| 04c | NN/g: la navegación escondida reduce su descubrimiento «casi a la mitad» | Coincide con el resumen público del artículo; no lo leí completo. |
| 04a | «19 de 44 pares fallan» | Son 19 de 40 medidos (H31). |
| 04a | «La paleta pasa todos los pares que exige WCAG 2.2 AA» | Incompleto: faltan el foco en el toast y en la alarma oscura (§2.2). |
| 04a | ΔE00 con Machado 2009 | No recalculado por mí. |
| 04a | Decreto 38 (furgones amarillos) | 04a ya lo marca como tomado de prensa; sin verificar. |
| 04b | Pesos, ejes, `tnum` y glifos de las fuentes | **Verificado** (§3). |
| 04b | Atkinson Hyperlegible Next lanzada el 10-02-2025 | No verificado por mí. |
| 04b | «16 px en campos evita el zoom de iPhone» | Comportamiento conocido de Safari en iOS; correcto en la práctica. |
| 04b | Bar y Neta 2006 → radios grandes = más cálido | El estudio existe; la extrapolación a interfaces es hipótesis (04b ya lo dice). |
| 04d | `closedby` Chrome 134 / Safari sin soporte; `requestClose` Safari 18.4; `pseudoElement` en Safari 14 | Plausibles; no verificados por mí. Ninguno es imprescindible. |
| 04d | «2,6 px por salto», «~62 s», tabla de curvas Bézier | **Verificados** (476 u × 0,004 × 1,36 px; mismas cifras de la tabla, máximo 109,8 %). |
| 04d | «WCAG 2.2.2: la alarma actual no cumple» | Interpretación razonable (empieza sola, dura > 5 s, junto a otro contenido, no es esencial). |
| 04d | `role="alert"` se anuncia aunque se inserte con su contenido | Cierto en general (MDN), pero ver H2: justamente por eso se re-anuncia en cada redibujo. |
| 04d | «Microinteracciones de 100–300 ms» | 04d ya lo marca como sin fuente primaria. |

Fuentes de la verificación de la ley (encontradas por buscador; bcn.cl y diariooficial.interior.gob.cl
no abrieron desde este entorno):
[BCN – Ley 21.377](https://www.bcn.cl/leychile/Navegar?idNorma=1166274) ·
[Diario Oficial 12-10-2021](https://www.diariooficial.interior.gob.cl/publicaciones/2021/10/12/43075/01/2023964.pdf) ·
[ChileAtiende – Ley No Chat](https://www.chileatiende.gob.cl/fichas/104320-ley-no-chat) ·
[DOE Actualidad Jurídica](https://actualidadjuridica.doe.cl/quien-conduzca-utilizando-dispositivos-de-telefonia-sera-sancionado-con-una-multa-de-15-a-3-unidades-tributarias-mensuales/) ·
[La Tercera, 12-10-2021](https://www.latercera.com/mtonline/noticia/lo-que-tienes-que-saber-ley-no-chat-comenzo-a-regir-este-12-de-octubre/HZ473I5HONCVBMJ6GDWN5PNOX4/) ·
[24 Horas – acciones prohibidas](https://www.24horas.cl/motores-24/ley-no-chat-que-acciones-estan-prohibidas-y-cuales-son-las-sanciones) ·
[Reglamento (Diario Oficial 14-03-2022)](https://www.diariooficial.interior.gob.cl/publicaciones/2022/03/14/43202/01/2098511.pdf)

---

## 9. Glosario

- **Auditoría adversarial:** revisión que busca a propósito errores y contradicciones, no confirmar
  lo que ya se dijo.
- **Contraste (razón de):** cuánto se diferencia la luz de dos colores, de 1:1 a 21:1. Texto normal
  pide 4,5:1; controles, bordes y foco piden 3:1.
- **Luminancia relativa:** cuánta luz emite un color comparado con el blanco (0 a 1).
- **WCAG 2.2 AA:** reglas internacionales de accesibilidad web; «AA» es el nivel exigible. Los
  criterios se nombran con números (por ejemplo 2.5.8 = tamaño mínimo de lo que se toca).
- **Anillo de foco:** el borde que muestra qué botón está elegido al usar teclado.
- **Foco:** el elemento que recibe el teclado o el lector de pantalla.
- **Lector de pantalla:** programa que lee la pantalla en voz alta (VoiceOver en iPhone, TalkBack en
  Android).
- **Región viva (`role="status"`, `role="alert"`):** zona cuyo texto nuevo el lector de pantalla lee
  solo. «status» espera a que termine de hablar; «alert» interrumpe.
- **Anunciador:** región viva oculta que se usa solo para decir algo una vez.
- **`aria-current="page"`:** marca cuál pestaña de la navegación es la actual.
- **`role="switch"`:** dice al lector de pantalla que un control es un interruptor encendido/apagado.
- **Nombre accesible:** el nombre que el lector de pantalla dice para un control.
- **`<dialog>` / `showModal()`:** ventana nativa del navegador que bloquea lo de atrás y se cierra con Esc.
- **`::backdrop`:** el fondo oscuro detrás de un `<dialog>`.
- **Zona táctil:** el área que responde al dedo; puede ser más grande que el dibujo.
- **Tick:** cada paso del temporizador del recorrido (cada 250 ms).
- **Firma + parche:** redibujar todo solo si cambió algo importante; si no, cambiar solo los números
  y el furgón.
- **FLIP / fantasma:** técnica para animar elementos que cambian de lugar al redibujar; el fantasma
  es una copia que se desvanece.
- **`requestAnimationFrame`:** pedirle al navegador que avise antes de dibujar cada cuadro.
- **Números tabulares (`tnum`):** cifras del mismo ancho, para que un número que cambia no salte.
- **`dvh`:** alto real de la pantalla visible en el celular (sin la barra de direcciones).
- **Reducir movimiento:** ajuste del teléfono para pedir menos animaciones.
- **UTM:** Unidad Tributaria Mensual de Chile; las multas se fijan en UTM.
- **Bloqueante / importante / menor:** impide aprobar / hay que resolverlo antes de implementar /
  conviene arreglarlo.
