# Rediseño — Etapa 4b: concepto visual e identidad

Autor: diseño (identidad). Lo leí contra `original/Furgon_Escolar_App.html`, `01-inventario.md`,
`diseno/colores.ts`, `diseno/iconos.ts` y, solo como referencia, `docs/demo-interactiva.html`.
Los colores exactos los define otro especialista: aquí uso los nombres de los tokens que ya existen
(`--amarillo`, `--texto`, `--borde`, `--superficie`…) y no invento valores nuevos.

## Resumen (5 líneas)

1. Recomiendo la dirección **A, «Trazo y relleno»**: la interfaz entera se dibuja como los íconos propios (contorno de 2 px del color del texto y relleno amarillo), así la app, los íconos y el furgón dibujado se ven como una sola familia.
2. Tipografía: **Fredoka** (redondeada, cálida) solo para títulos, botones grandes y el número de minutos; **Atkinson Hyperlegible Next** para todo lo que se lee.
3. Formas blandas (radios de 12 a 28 px) y una sombra «de sello»: una sombra sólida corta, sin difuminar, en lugar de la típica sombra gris borrosa.
4. Ilustración ligera hecha con las mismas piezas de los íconos: el furgón, el mapa tipo «papel» y los estados vacíos; los 9 tipos de emoji que quedan se cambian por íconos (faltan 3 íconos nuevos).
5. Textos en tono de «la tía»: tuteo, frases cortas, decir qué pasa después y nunca culpar; peso total de fuentes verificado ≈ 50 KB.

---

## Dirección A — «Trazo y relleno» (recomendada)

**Idea en una frase:** la app se ve como un cuaderno de stickers dibujado con el mismo lápiz que
los íconos: contorno firme, relleno amarillo y esquinas redondas.

- **Tipografía:** Fredoka 600 (títulos, botones principales, números grandes) + Atkinson
  Hyperlegible Next 400/700 (texto, campos, chips, datos).
- **Formas:** tarjetas con radio 22 px y borde de 2 px; botones tipo «píldora» (totalmente
  redondeados en los extremos); chips con radio completo. El borde de 2 px es el mismo grosor del
  trazo de los íconos: esa coincidencia es la firma visual.
- **Profundidad:** pocas capas. Las tarjetas «apoyan» sobre una sombra sólida de 3 px hacia abajo
  (como una calcomanía levantada). El botón amarillo principal tiene una base más oscura de 4 px que
  se aplasta al tocarlo (se siente como una tecla).
- **Ilustración:** furgón amarillo dibujado a partir del ícono `furgon`, mapa con calles gruesas y
  esquinas redondeadas, casas como el ícono `casa`.

**Inicio de familia con la alarma.** Arriba, saludo en Fredoka («Hola, Carolina») y el avatar
redondo. Debajo, la **alarma** ocupa todo el ancho: tarjeta amarilla con borde de 2 px del color
del texto, radio 28 px y sombra de sello de 5 px. A la izquierda, el ícono `campana` en un círculo
blanco con dos ondas que se expanden suavemente (una vez por segundo, se apagan si el sistema pide
«reducir movimiento»). Al centro, el número grande «4» en Fredoka 56 px con «min» al lado, y la
frase «La tía llega por Sofía». Abajo, un botón píldora oscuro (texto sobre `--texto`) «Recibido,
te espero». Luego, una tarjeta por hijo con su avatar de iniciales, el colegio con el ícono
`colegio`, el estado como chip («En camino · ~4 min») y el botón «Ver el furgón en vivo», con un
mapa en miniatura recortado en la esquina de la tarjeta. Los interruptores «Hoy no va» se ven como
una fila de dos píldoras grandes: «Mañana» y «Tarde».

**Recorrido de la tía.** La barra inferior desaparece. Arriba: «Ruta Mañana» en Fredoka con el
ícono `ida` y un chip «En curso» con un punto que late. El mapa ocupa ~40 % de la pantalla, con
bordes redondeados y la línea del trayecto en amarillo con contorno oscuro (como una calle
pintada). Debajo, la **próxima parada** es una sola tarjeta grande: número de parada en un círculo
amarillo, nombre en 22 px, dirección, chip «Familia avisada» con `campana`, y dos botones grandes
de 56 px de alto: «Subió» (verde, ícono `subio`) y «Ausente» (contorno, ícono `prohibido`). El
resto de las paradas va en una lista compacta, y los atendidos aparecen colapsados («3 listos»).
Al final, «Terminar recorrido» como botón de contorno rojo, separado para no tocarlo sin querer.

## Dirección B — «Señalética de camino»

**Idea en una frase:** la app se inspira en los letreros del camino y la franja del furgón escolar:
bloques amarillos con texto negro, números enormes y líneas rectas.

- **Tipografía:** Bricolage Grotesque (títulos, números; tiene un eje de «tamaño óptico» que la
  vuelve más apretada y expresiva en tamaños grandes) + Atkinson Hyperlegible Next (texto).
- **Formas:** radios chicos (6–10 px), franjas horizontales gruesas, chips con forma de patente,
  separadores en línea de 2 px. Más rectángulo que curva.
- **Profundidad:** casi plana; la jerarquía se hace con bloques de color, no con sombras.

**Inicio de familia con la alarma.** Una franja amarilla de borde a borde, como letrero de «zona
escolar»: arriba en mayúsculas pequeñas «AVISO», abajo el número «4 MIN» en Bricolage 72 px y
la línea «Furgón llegando por Sofía». El botón de confirmar es un rectángulo negro sin redondeo.
Las tarjetas de los hijos son filas separadas por líneas, sin cajas.

**Recorrido de la tía.** Encabezado negro con texto amarillo («RUTA MAÑANA · EN CURSO»). El mapa
lleva una cuadrícula visible y el trayecto como línea amarilla con borde negro. La próxima parada
se muestra como un letrero: número de parada gigante a la izquierda y botones rectangulares.

## Recomendación

**Recomiendo A, «Trazo y relleno».** Es la única que nace de lo que el proyecto ya tiene (los
íconos de trazo 2 px y relleno amarillo) y que se siente cercana, como pidió el dueño.

**Descarto B** porque su lenguaje de letrero vial se lee como urgencia y control, no como «la tía»
(hipótesis mía), y Bricolage pesa más: 77 KB contra 16 KB de Fredoka en una sola variante
(medido, ver verificación). Lo que sí rescato de B: números muy grandes para el tiempo de llegada
y botones muy grandes en el recorrido de la tía.

---

## Especificación de la dirección recomendada (A)

### 1. Tipografía

**Pareja y papeles**

| Familia | Para qué | Pesos que se cargan |
|---|---|---|
| Fredoka | títulos de pantalla (h1), número de minutos de la alarma, botón principal, número de parada, nombre de la app | solo 600 |
| Atkinson Hyperlegible Next | todo lo demás: textos, etiquetas, campos, chips, listas, montos, el código FAM-7K2Q | 400 y 700 |

Regla: si se **lee**, va en Atkinson; si se **reconoce de un vistazo** (un título, un número
grande, un botón), va en Fredoka. Nunca un párrafo en Fredoka.

**Cómo se cargan** (una sola petición; la URL la probé y responde bien):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap">
```

Así se reemplazan Inter (5 pesos) y JetBrains Mono del original. Si las fuentes no cargan, la app
sigue usable con las del sistema (`display=swap`).

**Tokens CSS**

```css
:root {
  /* Familias */
  --f-titulo: "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
  --f-texto: "Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Pesos */
  --p-normal: 400;   /* Atkinson: texto */
  --p-fuerte: 700;   /* Atkinson: énfasis, etiquetas, chips */
  --p-titulo: 600;   /* Fredoka: el único peso que se descarga */

  /* Escala de tamaños (px; base 16 para lectura cómoda en celular) */
  --t-xs: 12px;    /* notas al pie, nunca info importante */
  --t-s: 14px;     /* chips, textos secundarios, barra inferior (13 px en la barra si no cabe) */
  --t-m: 16px;     /* texto normal y campos (16 evita que iPhone haga zoom al escribir) */
  --t-l: 18px;     /* botones, nombre del alumno en listas */
  --t-xl: 22px;    /* títulos de tarjeta (h2), próxima parada */
  --t-2xl: 28px;   /* título de pantalla (h1) */
  --t-3xl: 40px;   /* número de parada en el recorrido */
  --t-alarma: 56px;/* minutos de la alarma («4») */

  /* Alturas de línea */
  --a-apretada: 1.05;  /* números grandes y h1 en Fredoka */
  --a-titulo: 1.2;     /* h2, botones */
  --a-texto: 1.5;      /* párrafos y avisos */
  --a-chip: 1.25;

  /* Espaciado entre letras */
  --e-titulo: -0.01em;   /* Fredoka grande */
  --e-mayus: 0.04em;     /* textos cortos en mayúsculas, si se usan */
}
```

Dos detalles que encontré al revisar los archivos de fuente:

- **Fredoka no tiene números tabulares** (todos los dígitos del mismo ancho; la función `tnum` no
  está en el archivo y el «1» es más angosto que el «4»). Al pasar de «10» a «9» min el número
  saltaría de ancho. Solución: el número de la alarma va en una caja de ancho fijo
  (`min-width: 2ch; text-align: center`). Los números que cambian en listas y chips («~4 min»,
  montos «$65.000») van en Atkinson con `font-variant-numeric: tabular-nums`, que sí lo trae.
- Ninguna de las dos trae «→» ni «≈» en el subconjunto latino que descarga Google: si se usan, el
  navegador los toma de la fuente del sistema. Preferible escribir «unos 4 min» o «~4 min» (la
  virgulilla sí está).

### 2. Formas (radios y bordes)

```css
:root {
  --r-s: 8px;      /* casillas, interior del segmento */
  --r-m: 12px;     /* campos de texto, avisos */
  --r-l: 22px;     /* tarjetas */
  --r-xl: 28px;    /* alarma, hojas (menú, diálogos), mapa */
  --r-pildora: 999px; /* botones, chips, segmento, interruptores */

  --b-fino: 1px;   /* separadores de lista */
  --b-trazo: 2px;  /* bordes de tarjeta, botón secundario, contorno del mapa = trazo de los íconos */
}
```

Reglas: el borde de tarjeta usa `--borde`; la tarjeta **destacada** (alarma, próxima parada,
mensaje sin responder) usa `--texto` como borde, para que se «dibuje» igual que un ícono. Un radio
interior = radio exterior − espacio interior (si la tarjeta tiene 22 px y 12 px de relleno, lo de
adentro va con ~10 px), para que las curvas queden paralelas.

### 3. Profundidad (sombras y capas)

En vez de la sombra gris difusa genérica, una **sombra de sello**: sólida, corta, hacia abajo.

```css
:root {
  --sombra-0: none;                                         /* plano: listas, fondos */
  --sombra-1: 0 3px 0 0 var(--borde);                       /* tarjetas */
  --sombra-2: 0 5px 0 0 var(--texto);                       /* alarma, próxima parada */
  --sombra-boton: 0 4px 0 0 color-mix(in srgb, var(--amarillo) 55%, var(--texto)); /* base del botón amarillo */
  --sombra-hoja: 0 -8px 24px -8px rgb(0 0 0 / .25);         /* menú y diálogos que suben desde abajo */
  --capa: rgb(0 0 0 / .45);                                 /* fondo que oscurece detrás de una hoja */
}
/* Botón al tocarlo: baja 3 px y la base se achica (se siente como tecla) */
.btn:active { transform: translateY(3px); box-shadow: 0 1px 0 0 color-mix(in srgb, var(--amarillo) 55%, var(--texto)); }
```

**Modo oscuro:** una sombra oscura sobre fondo oscuro no se ve. Ahí la profundidad se hace con
superficies más claras: fondo `--fondo` → tarjeta `--superficie` → destacado `--superficie2`, y la
`--sombra-1` pasa a ser `0 3px 0 0 rgb(0 0 0 / .5)`. La alarma mantiene su borde de 2 px (en
oscuro, del color `--amarillo` sobre fondo oscuro). El especialista de color debe confirmar que la
mezcla de `--sombra-boton` contrasta en ambos modos.

Solo 3 niveles: plano (0), apoyado (1), destacado (2). Si todo es destacado, nada lo es: máximo
**una** tarjeta nivel 2 por pantalla.

### 4. Espaciado (escala de 4 px)

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px;
  --toque-min: 48px;     /* alto mínimo de botones y zonas táctiles */
  --toque-grande: 56px;  /* botones del recorrido de la tía y «Recibido» de la alarma */
}
```

Uso: margen lateral de pantalla `--s-4`; separación entre tarjetas `--s-3`; relleno de tarjeta
`--s-4`; entre título y contenido `--s-2`. Las ✕ de cerrar avisos pasan de 28 px a 48 px de zona
táctil (el dibujo puede seguir siendo de 20 px). Referencia: WCAG 2.2 pide mínimo 24×24 px (nivel
AA, criterio 2.5.8) y recomienda 44×44 px (nivel AAA, criterio 2.5.5); Apple recomienda 44 pt y
Material 48 dp (ver fuentes). Elijo 48 px porque la tía usa el teléfono con prisa, a veces de pie
en la puerta del furgón (hipótesis mía sobre el uso).

### 5. Íconos

**Reglas de uso**

1. Solo los SVG de `diseno/iconos.ts`, siempre con trazo 2 px y `currentColor`. **Cero emojis**
   en la interfaz (sí se respetan si los escribe una persona en un mensaje: son datos).
2. Tamaños: 20 px junto a texto, 24 px en la barra inferior y botones, 32 px en encabezados de
   tarjeta, 48–96 px en ilustraciones (ahí el trazo se mantiene visualmente en ~2–3 px usando
   `vector-effect: non-scaling-stroke` o redibujando con trazo 3).
3. El relleno amarillo (acento) es la «luz» del ícono: se ve en el ícono activo de la barra, en
   los íconos de títulos y en las ilustraciones. En la barra, los inactivos van sin relleno (ya lo
   hace el original).
4. **Ícono sobre fondo amarillo** (alarma, botón principal): el acento amarillo desaparecería; ahí
   el acento pasa a `--superficie` (blanco) para que el ícono siga teniendo su «luz».
5. Un ícono por elemento, siempre a la izquierda del texto, nunca solo un ícono sin texto salvo
   ✕ cerrar y ⋮ menú (con `aria-label`).

**Emojis y símbolos del original → ícono**

| En el original | Dónde | Reemplazo |
|---|---|---|
| ✅ (5 veces) | «Subió ✅», «En su hogar ✅», «Tus hijos ya subieron ✅» | `confirmado` |
| ✓ | «✓ Vigente hasta…» (licencia) | `check` |
| ✕ | cerrar avisos y tarjetas | `cerrar` |
| 🌅 | «🌅 Ida», recorrido de ida | `ida` |
| 🏠 | «🏠 Vuelta», recorrido de vuelta | **falta ícono `vuelta`** (hoy 🏠 = `casa`, pero «casa» ya significa «la casa del niño» en el mapa; se confunden) |
| ⌂ | la casa de la familia en el mapa | `casa` |
| 🔔 | alarma, «Apoderado avisado», «Llega en ~n min» | `campana` |
| 🆕 | «Se sumaron a tus rutas» | **falta ícono `sumar`** (persona con un «+»); `chispa` ya está tomado por ✨ |
| 👍 | «El orden actual ya es el más corto» | `pulgar` |
| ✨ | «Ruta recomendada» | `chispa` |
| 📅 | «📅 Hoy no va · tocar si sí va» | `prohibido` (lo que importa es «no va», no la fecha) |
| 👤 | «Mi perfil» en el menú | `persona` |
| ● | chip «En curso» | **falta ícono `en_vivo`** (punto con anillo; se anima con CSS) |
| ⋮ | menú de la tía | `menu` existe pero es ☰ (tres rayas horizontales); recomiendo usar `menu` y dejar de usar ⋮ para no crear otro ícono |
| ▶ | «Simular que la tía inicia…» (Familias) | `play` |
| 😊 | respuesta automática de la «tía» en la versión Familias | se deja: es un mensaje escrito por una persona (dato), no interfaz |

**Íconos nuevos que faltan** (mismo estilo: grilla 24×24, trazo 2, un relleno de acento):
`vuelta` (casa con un sol bajo / atardecer detrás), `sumar` (persona con «+»), `en_vivo` (punto
relleno con anillo). Se agregan en `diseno/iconos.ts` en la etapa de construcción, no ahora.

### 6. Ilustración ligera

Regla general: **toda ilustración se arma con piezas de los íconos** (mismo trazo, mismo acento),
nunca dibujos de otro estilo ni fotos de stock.

- **El furgón dibujado (mapa y estados):** el ícono `furgon` agrandado a 40 px dentro de un círculo
  `--superficie` con borde de 2 px y un halo amarillo que late suave mientras el recorrido está en
  curso. Mira hacia donde avanza (se voltea con `scaleX(-1)` cuando va a la izquierda).
- **Mapa SVG (300×200, conserva F-07 y la privacidad):** estilo «mapa de papel»: manzanas como
  rectángulos con radio 6 en `--manzana`, calles gruesas (8 px) en `--calle` con extremos
  redondeados, sin texto de calles. El trayecto (solo la tía) en amarillo con un contorno oscuro de
  2 px por debajo (como calle pintada). Casas: ícono `casa` de 18 px en un círculo con número;
  verdes con `confirmado` chico cuando ya se atendieron. Colegio: ícono `colegio` en lugar de la
  «C». Para la familia: solo su casa (ícono `casa` grande, relleno amarillo) y el furgón; nada más.
- **Estados vacíos** (una ilustración de 96 px + una frase + una acción):
  - Familia sin recorrido: `furgon` estacionado junto a `estacionado` → «La tía todavía no sale.
    Te avisamos cuando falten 5 min.»
  - Sin mensajes: `mensaje` → «Aquí aparecen los mensajes de las familias.» (tía) / «¿Algo que
    contarle a la tía? Escríbele aquí.» (familia)
  - Ruta sin alumnos: `ruta` → «Esta ruta está vacía. Agrega a los niños abajo.»
  - Todos atendidos: `celebrar` → «Todos listos. ¡Buen viaje!»
- **Movimiento:** solo tres animaciones (ondas de la alarma, halo del furgón, punto «en curso»),
  todas desactivadas con `@media (prefers-reduced-motion: reduce)`.

---

## Microcopy (tono de los textos)

**Reglas de tono**

1. Habla como la tía: tú, frases cortas, cariño sin infantilizar. Se dice «la tía», no «el
   conductor» ni «el sistema».
2. Primero lo importante (quién, cuánto falta), después el detalle.
3. Siempre decir qué pasa después o qué hacer: un error dice cómo arreglarlo, no qué hizo mal la
   persona.
4. Sin barras de género («atento/a»): reescribir la frase para que no haga falta.
5. Máximo un «¡…!» por pantalla. Sin emojis en la interfaz.
6. Chilenismos suaves y de uso común («la tía», «el furgón», «apoderado» solo donde es formal);
   nada que suene a chiste. Que esto se sienta «cálido» para las familias es hipótesis mía; hay que
   probarlo con 3–5 apoderados reales.

**Ejemplos reescritos (textos reales de la app)**

| # | Texto original | Propuesta | Por qué |
|---|---|---|---|
| 1 | «🔔 El furgón llega en ~4 min a buscar a Sofía» | «**4 min** · La tía llega por Sofía» | el número primero y grande; «la tía» es más cercano que «el furgón» |
| 2 | «Recibido, estoy atento/a» | «Recibido, te espero» | sin barra de género; responde a la tía como persona |
| 3 | «Te avisaremos cuando el furgón esté cerca.» | «Te avisamos cuando falten 5 min.» | concreto: usa los minutos que eligió la familia (`minutosAviso`) |
| 4 | «Esperando respuesta…» | «La tía responde cuando no está manejando.» | explica la demora y refuerza la seguridad |
| 5 | «Inicia el recorrido antes de partir. Los avisos a los apoderados se envían solos: no necesitas tocar el teléfono mientras manejas.» | «Toca «Iniciar» antes de partir. Los avisos salen solos: tú solo maneja.» | la mitad de largo, misma instrucción |
| 6 | «Los alumnos siguen registrados; solo se quitan de esta ruta.» (diálogo de eliminar) | «¿Borrar la ruta «Mañana»? Los niños no se borran: siguen en tu lista de Alumnos.» | dice qué se borra y qué no, con el nombre de la ruta |
| 7 | «La hora va como 07:30.» | «Escribe la hora así: 07:30» | indica cómo arreglarlo |
| 8 | «Recorrido terminado. ¡Buen trabajo!» | «Recorrido cerrado. ¡Gracias por cuidarlos, tía!» | cálido y verdadero aunque haya quedado alguien ausente |
| 9 | «🔔 Apoderado avisado» / «Aún sin aviso» | «Familia avisada» / «Aviso pendiente» | dos estados paralelos, sin emoji |
| 10 | «Listo: la tía ya sabe que hoy no viaja.» | «Listo. La tía sabe que Sofía no va hoy.» | con nombre: con hermanos, evita dudas sobre quién |

---

## Verificación de fuentes (hecha el 14-10-2026)

**Método:** pedí cada familia a la API de Google Fonts
(`https://fonts.googleapis.com/css2?family=…&display=swap`) con un navegador Chrome simulado, revisé
los rangos de caracteres y pesos que devuelve, descargué el archivo WOFF2 del subconjunto «latin»
y lo abrí con la librería fontTools para comprobar los caracteres reales, los ejes variables y las
funciones tipográficas. Los tamaños son los de ese archivo para Chrome; otros navegadores pueden
recibir archivos algo distintos.

| Familia | ¿Existe en Google Fonts? | Pesos | ¿Variable? | Español (á é í ó ú ñ Ñ ü ¿ ¡ ° « » … —) | Números tabulares | Tamaño (subconjunto latino) |
|---|---|---|---|---|---|---|
| **Fredoka** | Sí (HTTP 200) | 300 a 700 | Sí: peso 300–700 y ancho 75–125 (solo si se pide el ancho) | Todos presentes | **No** | 1 peso (600) estático: **16,5 KB**; variable de peso: 29,7 KB; con eje ancho: 67,8 KB |
| **Atkinson Hyperlegible Next** | Sí (HTTP 200) | 200 a 800, más cursiva | Sí: peso 200–800 | Todos presentes | Sí (`tnum`) | 400 y 700 juntos: **34,0 KB** (Google entrega el variable); 400 solo: 12,1 KB; 700 solo: 12,7 KB |
| Bricolage Grotesque (dirección B) | Sí (HTTP 200) | 200 a 800 | Sí: peso 200–800, tamaño óptico 12–96, ancho 75–100 | Todos presentes | Sí | 77 KB (tamaño óptico + pesos 500–800) |
| Inter (original, referencia) | Sí | — | Sí | — | — | 48,3 KB (los 5 pesos del original) |

**Total recomendado:** Fredoka 600 + Atkinson Next 400/700 ≈ **50 KB** en una petición CSS de
3,2 KB, frente a ~48 KB de Inter más JetBrains Mono del original (Mono no lo medí: no verificado).
El subconjunto «latin-ext» solo se descarga si aparece un carácter fuera del español (no debería).

URLs probadas (todas devolvieron 200):

- https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap (la recomendada)
- https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap
- https://fonts.googleapis.com/css2?family=Fredoka:wdth,wght@75..125,300..700&display=swap
- https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@200..800&display=swap
- https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap

No pude abrir las páginas de muestra de fonts.google.com (el proxy de este entorno las bloquea);
la existencia, los pesos y los caracteres los confirmé con la API y los archivos mismos, que es
lo que usa la app.

**Fuentes sobre legibilidad y percepción** (marco qué verifiqué y qué no):

- Atkinson Hyperlegible la creó el Braille Institute (2019) para lectores con baja visión,
  diferenciando letras que se confunden (I, l, 1; O, 0). La versión «Next» se lanzó el
  10-02-2025 con 7 pesos y más de 150 idiomas. Esto es lo que **declara su autor**, no un estudio
  independiente que yo haya leído. Página oficial: https://www.brailleinstitute.org/freefont/ (no
  la pude abrir desde aquí; el dato lo tomé de la reproducción del comunicado de prensa:
  https://bakercityherald.com/?p=216504 y https://en.wikipedia.org/wiki/Atkinson_Hyperlegible ,
  encontradas por búsqueda). Por eso elegí Atkinson para el código «FAM-7K2Q».
- Fredoka: diseño latino de Milena Brandão, hebreo de Ben Nathan (Hafontia), versión variable de
  Fredoka One, licencia OFL. Fuente: https://fonts.google.com/specimen/Fredoka/about (vía
  búsqueda, no abierta).
- Preferencia por las formas curvas: Bar, M. y Neta, M. (2006), «Humans Prefer Curved Visual
  Objects», *Psychological Science* 17(8), 645–648, PMID 16913943. Encontrado por búsqueda; no
  leí el artículo completo. Es un estudio de laboratorio con objetos y patrones, no con
  interfaces: que los radios grandes hagan la app «más cálida» sigue siendo **hipótesis mía**
  apoyada en ese hallazgo.
- Tamaño táctil: WCAG 2.2, criterio 2.5.8 (24×24 px, nivel AA) y 2.5.5 (44×44 px, nivel AAA):
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (no la pude abrir desde
  aquí; datos confirmados por búsqueda en, p. ej.,
  https://smashingmagazine.com/2024/07/getting-bottom-minimum-wcag-conformant-interactive-element-size/).
- «16 px en campos evita el zoom automático de iPhone»: lo sé por experiencia, **no verificado** hoy.
- `ui-rounded` (fuente redondeada del sistema como respaldo): según lo que sé solo la reconoce
  Safari; **no verificado** hoy. Si no existe, se usa la siguiente de la lista sin problema.

---

## Alternativas descartadas (por decisión)

| Decisión | Elegí | Descarté | Por qué |
|---|---|---|---|
| Dirección | A «Trazo y relleno» | B «Señalética de camino» | B se siente urgente y fría (hipótesis mía) y pesa 77 KB en títulos |
| Fuente de títulos | Fredoka | Nunito | redondeada y cálida, pero es de las más vistas en apps; no da identidad propia (opinión mía) |
| Fuente de títulos | Fredoka | Baloo 2 | muy gruesa en pesos altos; a 56 px compite con el amarillo (opinión mía; no la medí) |
| Fuente de títulos | Fredoka | Barlow Condensed (demo anterior) | condensada = estilo deportivo/vial, menos cálido |
| Fuente de texto | Atkinson Hyperlegible Next | Lexend | sus beneficios de lectura los afirma su creadora y no los pude verificar aquí; Atkinson Next además trae números tabulares (verificado) |
| Fuente de texto | Atkinson Hyperlegible Next | Inter (original) | correcta pero es exactamente el «look de plantilla» que hay que evitar |
| Fuente de texto | Atkinson Next | Atkinson Hyperlegible (2019) | solo 2 pesos y sin variable; «Next» es su versión nueva del mismo autor |
| Tercera fuente mono para códigos | ninguna | JetBrains Mono / Atkinson Mono | regla de máximo 2 familias; Atkinson Next ya diferencia 0/O y 1/l |
| Cargar Fredoka | solo 600 (16,5 KB) | rango 300–700 (29,7 KB) o eje ancho (67,8 KB) | un solo peso alcanza para títulos |
| Sombras | sombra de sello sólida | sombra gris difusa | es la marca del look genérico y no se ve en modo oscuro |
| Radios | 22–28 px y píldoras | 8–12 px | los radios chicos se leen más «oficina» (hipótesis mía, ver Bar y Neta 2006) |
| Íconos | solo SVG propios | mezclar emojis | dos estilos a la vez (defecto 9 del inventario) y los emojis cambian según el teléfono |
| Ícono de menú | `menu` (☰) existente | nuevo ícono ⋮ | evita dibujar un ícono más |
| Ícono de vuelta | nuevo `vuelta` | seguir con `casa` | `casa` ya significa «la casa del niño» en el mapa |
| Ilustraciones | armadas con piezas de los íconos | ilustraciones externas o fotos | mantienen un solo estilo y casi no pesan |

---

## Glosario

- **Fuente variable:** un solo archivo de letra que contiene todos los grosores (y a veces anchos);
  se elige el punto exacto con CSS. Útil si se usan muchos pesos; si se usa uno, un archivo fijo
  («estático») pesa menos.
- **Peso:** el grosor de la letra (400 = normal, 700 = negrita).
- **Eje:** cada cosa que una fuente variable deja ajustar: peso (`wght`), ancho (`wdth`), tamaño
  óptico (`opsz`, la letra cambia su dibujo según lo grande que se muestre).
- **Subconjunto (subset):** Google Fonts parte cada fuente en trozos por idioma; el navegador solo
  baja el trozo «latin» si el texto es en español.
- **WOFF2:** formato comprimido de fuentes para la web.
- **display=swap:** la página muestra el texto al tiro con una fuente del sistema y la cambia
  cuando llega la descargada; nunca queda texto invisible.
- **preconnect:** aviso al navegador para que abra la conexión con el servidor de fuentes antes de
  necesitarla.
- **Token:** un nombre para un valor de diseño (p. ej. `--r-l: 22px`); se cambia en un solo lugar
  y se actualiza toda la app.
- **Radio:** cuánto se redondea una esquina. **Píldora:** radio tan grande que los extremos quedan
  como medio círculo.
- **Elevación / profundidad:** la sensación de que algo está «encima» de otra cosa; se logra con
  sombras o con superficies más claras.
- **Sombra de sello:** sombra sólida y corta, sin difuminar, como una calcomanía levantada.
- **Números tabulares (`tnum`):** todos los dígitos ocupan el mismo ancho, así un número que cambia
  no hace saltar el texto.
- **Altura de línea:** espacio vertical de cada línea de texto (1,5 = una vez y media el tamaño).
- **Microcopy:** los textos cortos de la interfaz: botones, avisos, errores, estados vacíos.
- **Estado vacío:** lo que muestra una pantalla cuando aún no hay datos (sin mensajes, sin
  recorrido).
- **Toast:** aviso breve que aparece y se va solo.
- **Acento:** el relleno amarillo de cada ícono propio.
- **WCAG:** pautas internacionales de accesibilidad web del W3C; AA es el nivel exigible, AAA el
  más alto.
- **`prefers-reduced-motion`:** preferencia del teléfono para pedir menos animaciones; la app la
  respeta apagando las suyas.
- **`color-mix`:** función de CSS que mezcla dos colores (aquí, para oscurecer el amarillo sin
  inventar otro color).
