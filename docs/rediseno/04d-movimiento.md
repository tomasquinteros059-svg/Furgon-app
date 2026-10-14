# Rediseño — Etapa 4d: movimiento y microinteracciones

Autor/a: diseño de interacción y movimiento. Base: `original/Furgon_Escolar_App.html` y el contrato
`01-inventario.md` (códigos F-xx). Decisiones del dueño que respeto: **un solo archivo HTML sin
librerías**, **celular primero**, **amarillo e íconos propios**, **tono cálido**.

> Cómo leer este documento: cada decisión trae **qué**, **por qué**, **la alternativa que descarté**
> y, cuando hace falta, un fragmento de código de referencia (no es el archivo completo). Las
> afirmaciones con fuente llevan enlace; las que son criterio mío dicen **«hipótesis mía»**.

---

## 0. Resumen en 10 líneas

1. Hoy `pintar()` rehace todo el HTML en cada cambio y 4 veces por segundo durante el recorrido.
   Por eso **ninguna transición CSS puede verse** (el elemento que iba a animarse ya no existe), se
   pierde el foco y el furgón avanza a saltos de ~2,6 px cada 250 ms.
2. **Recomiendo no cambiar la arquitectura** (S + `pintar()`), sino agregarle tres piezas chicas:
   - **«Firma + parche»**: durante el recorrido, si no cambió nada importante, *no* se redibuja;
     solo se actualizan los números y la posición del furgón.
   - **«Antes/después con clave»** (técnica FLIP): `pintar()` sigue regenerando todo, pero antes mide
     dónde estaba cada elemento con `data-k` y después anima lo que se movió, apareció o desapareció.
   - **Furgón con `requestAnimationFrame`**: se interpola entre ticks; se mueve suave a 60/120 fps.
3. **View Transitions: no en esta versión** (bloquea toques durante la animación, se cancela con el
   siguiente tick, iPhone solo desde iOS 18). Queda como mejora opcional para cambiar de pestaña.
4. La **alarma no debe latir para siempre**: entra con un movimiento, la campana se mueve 3 veces
   (≈ 3,9 s, menos de los 5 s de WCAG 2.2.2) y queda quieta, amarilla y clara.
5. **Vibración**: solo Android (Chrome). **iPhone no la soporta** (confirmado en los datos de MDN).
   Nunca es el único aviso.
6. Con «Reducir movimiento» activado: se quitan desplazamientos, rebotes y ondas; quedan **fundidos
   cortos**. El furgón sigue moviéndose (es información, no decoración).
7. Gestos: solo **deslizar hacia abajo para cerrar la hoja del menú**, siempre con botón «Cerrar»,
   tocar fuera y tecla Esc. Descarto deslizar tarjetas para marcar «Subió» (riesgo de error).

---

## 1. El problema técnico, explicado simple

La app funciona como una pizarra: cada vez que algo cambia, **se borra la pizarra entera y se
vuelve a dibujar** (`el.innerHTML = …` en `#pantalla` y `#barra`). Es simple y confiable, pero:

| Síntoma | Por qué pasa | Dónde se nota |
|---|---|---|
| El interruptor «Hoy no viaja» salta en vez de deslizarse | Al tocarlo, `avisar()` llama a `pintar()`; el interruptor que estaba haciendo su `transition: .2s` se destruye y aparece uno nuevo ya en la posición final | F-73 |
| El furgón «tirita» | Cada 250 ms avanza 0,4 % del recorrido. En la ruta Mañana (≈ 476 unidades de mapa, ≈ 1,36 px por unidad en un teléfono de 408 px de mapa) son **≈ 2,6 px por salto, 4 saltos por segundo** | F-06, F-07 |
| Se pierde el foco y el lector de pantalla «se reinicia» | El botón enfocado deja de existir 4 veces por segundo | Defecto 1 del inventario |
| La alarma reinicia su latido 4 veces por segundo | La animación CSS empieza de nuevo cada vez que el nodo es nuevo | F-71 |
| La hoja del menú y el diálogo aparecen de golpe | Se insertan ya abiertos; al cerrar se borran sin salida | F-60, F-40 |
| El toast puede no anunciarse | Se crea un `role="status"` nuevo junto con su texto; MDN recomienda que la región viva **exista antes** de cambiar su contenido ([MDN, regiones vivas](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)) | F-91 |

Cálculo del largo de la ruta Mañana (para que lo puedas revisar): partida (20,180) → casa Demo
(60,52) = 134,1; → Benjamín (120,130) = 98,4; → Isidora (150,40) = 94,9; → colegio (250,150) = 148,7.
Total ≈ 476. 0,4 % de 476 ≈ 1,9 unidades por tick.

---

## 2. Cómo lograr movimiento sin romper `pintar()`: opciones evaluadas

| Opción | Cómo funciona | A favor | En contra | Veredicto |
|---|---|---|---|---|
| **A. Dejar todo igual y poner animaciones CSS de entrada** | `@keyframes` en `.tarjeta`, etc. | Cero JS | Como todo se recrea, **todo se re-anima en cada `pintar()`** (y 4 veces por segundo en el recorrido). Insoportable | Descartada |
| **B. Firma + parche vivo** | En cada tick se calcula una «firma» del estado importante; si no cambió, no se redibuja: solo se tocan números y furgón | Arregla el foco (defecto 1), el lector de pantalla y el costo; poco código | Dos caminos de dibujo (completo y parche) que hay que mantener coherentes | **Sí** (base) |
| **C. Antes/después con clave (FLIP + fantasmas)** | `pintar()` igual; antes se miden los elementos con `data-k`, después se animan los movidos, nuevos y borrados con Web Animations API | Funciona con innerHTML; anima reordenar ↑↓, marcar Subió, casa verde, pestañas; Safari iOS 13.1+ | ~60 líneas propias; hay que poner claves únicas | **Sí** (acciones del usuario) |
| **D. View Transitions API** (`document.startViewTransition`) | El navegador saca una «foto» antes y después y anima entre ambas | Muy poco código para un fundido entre pantallas | Mientras anima, **los toques no llegan a los elementos** (la especificación dice que el *hit testing* va al documento) ([CSS View Transitions 1](https://drafts.csswg.org/css-view-transitions-1/#document-rendering-suppression-for-view-transitions)); **una transición nueva cancela la anterior** (con ticks cada 250 ms se cancelarían entre sí); dos elementos con el mismo nombre hacen que se salte ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)); iPhone solo desde **iOS 18** | Descartada en v1; opcional después para pestañas |
| **E. Escribir un «reconciliador» (diff del DOM tipo morphdom)** | Comparar el HTML nuevo con el viejo y cambiar solo lo distinto | Las transiciones CSS funcionarían solas | Es reinventar una librería: 200+ líneas, errores sutiles con listas, foco y formularios | Descartada |
| **F. Pasar a un framework (React, etc.)** | — | Resuelve todo | Contradice «un solo archivo sin librerías» | Descartada |

**Recomendación: B + C + furgón con `requestAnimationFrame`.** B se encarga de lo que pasa solo
(ticks), C de lo que hace la persona (toques). Así `S` sigue siendo la única verdad y `pintar()`
sigue siendo la única forma de dibujar la pantalla completa.

### 2.1 Pieza B — firma + parche vivo

```js
// Lo que, si cambia, obliga a redibujar todo. Lo demás (avance, minutos) va por parche.
function firma() {
  const r = S.recorrido;
  return JSON.stringify([S.rol, S.vista[S.rol], S.menu, !!S.confirmar,
    r && r.estados, r && r.avisado, r && r.confirmado, S.noVa]);
}

// En el setInterval de iniciar(), en vez de pintar(true):
if (firma() !== pintar.firma) pintar(true);   // pasó algo: casa atendida, aviso, «no va»…
else parcheVivo();                            // nada importante: solo números y furgón

function parcheVivo() {
  for (const el of document.querySelectorAll("[data-eta]")) {
    const txt = String(Math.max(1, etaMin(el.dataset.eta) ?? 0));
    if (el.textContent !== txt) el.textContent = txt;   // escribir solo si cambió
  }
  furgon.objetivo(S.recorrido.progreso);               // ver 2.3
}
// Y al final de pintar():  pintar.firma = firma();
```

- Los números de minutos llevan `data-eta="sofia"` en el HTML que ya genera cada pantalla.
- Los números **no** son región viva (`aria-live`): cambiarían cada minuto y el lector de pantalla
  hablaría sin parar. El anuncio importante es la alarma (sección 5).
- Efecto colateral bueno: como el recorrido ya casi nunca redibuja, **el foco y lo que se escribe
  dejan de perderse** (defecto 1). La regla actual «no redibujar si el cursor está en un campo»
  se mantiene para los redibujos completos.

### 2.2 Pieza C — «antes/después con clave» (FLIP)

FLIP = *First, Last, Invert, Play*: mido dónde estaba (First), dibujo (Last), calculo la diferencia
y pongo el elemento **visualmente** donde estaba (Invert) y lo dejo volver a su lugar (Play).

En fórmulas, para cada elemento con la misma clave antes y después:

- Δx = x_antes − x_después, Δy = y_antes − y_después
- se anima `transform: translate(Δx, Δy)` → `translate(0, 0)`.

Solo se anima `transform` y `opacity` (el navegador puede hacerlo sin recalcular la página).
No anima tamaño (escalar texto lo deforma).

Reglas de las claves:

- `data-k` = identidad (única en la pantalla): `pend:sofia`, `fila:manana:sofia`, `atendido:sofia`,
  `casa:60,52`, `tab:inicio`, `pildora-tema`, `perilla:sofia:ida`, `alarma:sofia`.
- `data-v` = estado visible: si la clave es la misma pero `data-v` cambió (p. ej. casa
  `pendiente` → `listo`), se reproduce la animación «cambio» de ese tipo de elemento.
- No anidar elementos con `data-k` que se muevan (el hijo heredaría el movimiento del padre dos
  veces). Los hijos solo llevan `data-v`.

```js
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const T = { corta: 150, media: 220, larga: 320 };
const E = { estandar: "cubic-bezier(.2,0,0,1)", entrada: "cubic-bezier(.05,.7,.1,1)",
            salida: "cubic-bezier(.3,0,.8,.15)", rebote: "cubic-bezier(.34,1.56,.64,1)" };

function medir(raiz) {
  const m = new Map();
  for (const el of raiz.querySelectorAll("[data-k]"))
    m.set(el.dataset.k, { el, r: el.getBoundingClientRect(), v: el.dataset.v });
  return m;
}

// Envuelve cualquier acción del usuario:  conMovimiento(() => { cambiarS(); pintar(); })
function conMovimiento(accion) {
  const raiz = document.getElementById("telefono");
  const misma = pintar.ultima;                 // ¿seguimos en la misma pantalla?
  const antes = medir(raiz);
  accion();
  if (pintar.ultima !== misma) return entrarPantalla();   // cambio de pantalla: ver §4.6
  const despues = medir(raiz);
  for (const [k, d] of despues) {
    const a = antes.get(k);
    if (!a) { entrar(d.el); continue; }
    const dx = a.r.left - d.r.left, dy = a.r.top - d.r.top;
    if (!RM.matches && Math.hypot(dx, dy) > 1)
      d.el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }],
                   { duration: T.media, easing: E.estandar });
    if (a.v !== d.v) cambio(d.el);
  }
  for (const [k, a] of antes) if (!despues.has(k)) fantasma(a);   // lo que se fue
}

// «Fantasma»: copia visual del elemento borrado, encima, que se desvanece y se elimina.
function fantasma({ el, r }) {
  const capa = document.getElementById("capa-fantasmas");      // div fijo dentro de .telefono
  const base = document.getElementById("telefono").getBoundingClientRect();
  const g = el.cloneNode(true);
  g.setAttribute("aria-hidden", "true"); g.inert = true;
  Object.assign(g.style, { position: "absolute", margin: 0, pointerEvents: "none",
    left: r.left - base.left + "px", top: r.top - base.top + "px", width: r.width + "px" });
  capa.append(g);
  g.animate([{ opacity: 1, transform: "none" },
             { opacity: 0, transform: RM.matches ? "none" : "translateX(24px)" }],
            { duration: T.corta, easing: E.salida }).finished.then(() => g.remove());
}
```

Costo: dos mediciones (`getBoundingClientRect`) **solo cuando la persona toca algo**, nunca en los
ticks. Con menos de ~50 elementos con clave, estimo menos de 2 ms en un Android de gama media
(**hipótesis mía**, medir con Chrome DevTools → Performance). No hay «layout thrash» porque se mide
todo junto, se escribe todo junto (no se alterna medir/escribir dentro de un bucle).

### 2.3 Pieza del furgón — interpolación con `requestAnimationFrame`

El tick (cada 250 ms) solo fija un **objetivo**; otro bucle, sincronizado con la pantalla, dibuja
la posición intermedia en cada cuadro.

Fórmula (interpolación lineal **del avance**, no de x/y, para que el furgón doble por la calle y no
corte en diagonal en las esquinas):

- `u = min(1, (ahora − t_tick) / 250 ms)`
- `f_mostrado = f_desde + (f_objetivo − f_desde) · u`
- posición = `puntoEn(puntosRuta(r), f_mostrado)` (la misma función F-02 de hoy)

`f_desde` es lo que se estaba mostrando en el momento del tick (no el objetivo anterior), así no hay
saltos si un tick llega tarde. El costo: el furgón va **un tick atrasado** (≤ 250 ms ≈ 2,6 px),
imperceptible.

```js
const furgon = {
  desde: 0, hasta: 0, t: 0, mostrado: 0, id: 0,
  objetivo(f) { this.desde = this.mostrado; this.hasta = f; this.t = performance.now(); this.arrancar(); },
  arrancar() { if (!this.id) this.id = requestAnimationFrame((n) => this.cuadro(n)); },
  cuadro(ahora) {
    this.id = 0;
    const g = document.querySelector("[data-k='furgon']"); const rec = S.recorrido;
    if (!g || !rec) return;                                   // sin mapa o sin recorrido: se detiene
    const u = Math.min(1, (ahora - this.t) / 250);
    this.mostrado = this.desde + (this.hasta - this.desde) * u;
    const p = puntoEn(puntosRuta(ruta(rec.rutaId)), this.mostrado);
    g.setAttribute("transform", `translate(${(p.x - 13).toFixed(1)},${(p.y - 9).toFixed(1)})`);
    if (u < 1) this.arrancar();
  },
};
// Al final de pintar(): si hay mapa, furgon.cuadro(performance.now()) para que el SVG recién
// creado nazca ya en la posición interpolada (si no, salta un cuadro al punto del tick).
```

Detalles:

- Se usa el **tiempo** que entrega `requestAnimationFrame`, no «cuadros contados»: los teléfonos de
  120 Hz llaman más veces por segundo ([MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
- `requestAnimationFrame` se pausa en pestañas en segundo plano en la mayoría de los navegadores
  (misma fuente): no gasta batería con el teléfono bloqueado.
- **Dirección**: si el tramo actual va hacia la izquierda (Δx < 0), voltear el dibujo con
  `scale(-1,1)` dentro del `<g>`. No rotarlo: es un dibujo de costado y rotado se ve raro
  (**hipótesis mía**).
- **Teletransporte**: si la familia marca «Hoy no va» en pleno recorrido, `puntosRuta` cambia y la
  misma fracción `f` cae en otro lugar (ver defecto 6 del inventario). No interpolar ahí (se vería
  cruzar manzanas): si el salto es > 20 unidades, hacer `desde = hasta` y un fundido del furgón de
  150 ms (opacidad 0 → 1).
- En la app real con GPS (posiciones cada varios segundos) se usa lo mismo, cambiando 250 ms por el
  intervalo medido entre posiciones (promedio móvil). Para no «atrasar» más de un intervalo se
  podría extrapolar con la velocidad, pero se pasaría de largo en cada parada: **no lo recomiendo**.
- Se mueve con el atributo SVG `transform` de un `<g>`: repinta solo el SVG, no reacomoda la página.
  Alternativa descartada: furgón como `<div>` HTML encima del mapa con `transform` CSS (se
  compone en GPU, pero hay que sincronizar escalas mapa/píxeles; no vale la pena para 300×200).

---

## 3. Tokens de movimiento (CSS)

Base: la escala de Material Design 3 (duraciones de 50 a 1000 ms en pasos de 50 y curvas
«standard» y «emphasized»), tomada de la documentación oficial de Material Components
([Motion.md en GitHub](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).
La elección de **qué** duración va en cada caso es **hipótesis mía**, guiada por esa regla de
Material: *«la duración debe crecer con el área o el recorrido de la animación»* (misma fuente).

```css
:root {
  /* Duraciones */
  --dur-0: 0ms;          /* presionar: respuesta en el mismo cuadro */
  --dur-micro: 100ms;    /* soltar un botón, cambio de color */
  --dur-corta: 150ms;    /* fundidos, salida de toast, contenido de pestaña */
  --dur-media: 220ms;    /* reordenar (FLIP), interruptor, entrada de tarjetas, diálogo */
  --dur-larga: 320ms;    /* abrir hoja inferior, entrada de la alarma */
  --dur-enfasis: 700ms;  /* un ciclo de campana, onda de casa atendida (600–700) */

  /* Curvas (cubic-bezier) */
  --ease-estandar: cubic-bezier(.2, 0, 0, 1);      /* M3 standard: se mueve dentro de la pantalla */
  --ease-entrada:  cubic-bezier(.05, .7, .1, 1);   /* M3 emphasized decelerate: algo que llega */
  --ease-salida:   cubic-bezier(.3, 0, .8, .15);   /* M3 emphasized accelerate: algo que se va */
  --ease-rebote:   cubic-bezier(.34, 1.56, .64, 1);/* pasa ~10 % y vuelve: solo íconos chicos */
  --ease-lineal:   linear;                          /* furgón (velocidad constante) */

  /* Distancias: se anulan con «reducir movimiento» */
  --mov-dist: 8px;  --mov-dist-larga: 24px;  --mov-escala: .97;
}
@media (prefers-reduced-motion: reduce) {
  :root { --mov-dist: 0px; --mov-dist-larga: 0px; --mov-escala: 1;
          --dur-larga: 150ms; --dur-media: 150ms; --dur-enfasis: 0ms; }
}
```

### 3.1 Qué significan las curvas (para revisar con números)

Una `cubic-bezier(x1, y1, x2, y2)` es una curva de Bézier de grado 3 con extremos (0,0) y (1,1):

- x(s) = 3(1−s)²s·x1 + 3(1−s)s²·x2 + s³  → fracción de **tiempo**
- y(s) = 3(1−s)²s·y1 + 3(1−s)s²·y2 + s³  → fracción de **avance**

Para un tiempo dado se despeja s en x(s) y se evalúa y(s). Calculé (bisección numérica) cuánto
avance hay a cada fracción de tiempo:

| Curva | 10 % tiempo | 25 % | 50 % | 75 % | 90 % | Máximo |
|---|---|---|---|---|---|---|
| estándar (.2,0,0,1) | 16 % | 61 % | 88 % | 98 % | 100 % | 100 % |
| entrada (.05,.7,.1,1) | 62 % | 83 % | 95 % | 99 % | 100 % | 100 % |
| salida (.3,0,.8,.15) | 1 % | 4 % | 15 % | 41 % | 68 % | 100 % |
| rebote (.34,1.56,.64,1) | 40 % | 82 % | 109 % | 106 % | 101 % | **109,8 %** |

Lectura: «entrada» llega casi entera en el primer cuarto y se acomoda suave (se siente rápida);
«salida» casi no se mueve al principio y acelera al final (lo que se va no compite con lo que llega);
«rebote» se pasa ~10 % y vuelve (alegre, por eso solo en íconos pequeños, nunca en hojas o texto).

### 3.2 Tiempos de respuesta: qué está probado y qué no

- **0,1 s** se percibe como instantáneo; **1 s** se nota pero no corta el hilo; **10 s** es el límite
  de atención. Fuente: Jakob Nielsen, *Response Times: The 3 Important Limits* (NN/g, 1993); la
  página original no pude abrirla desde este entorno, la verifiqué por el video oficial
  [NN/g: 3 response time limits](https://www.nngroup.com/videos/3-response-time-limits-interaction-design/)
  y resúmenes. Por eso: **el feedback de presionar aparece en `pointerdown`**, no en `click`
  (que llega después de levantar el dedo).
- **Procesar un evento en menos de 50 ms** y **producir un cuadro de animación en ≈ 10 ms**
  (16 ms por cuadro a 60 fps, menos ~6 ms que usa el navegador): modelo RAIL de Google
  ([web.dev/articles/rail](https://web.dev/articles/rail), texto verificado en su repositorio
  fuente en GitHub).
- «Las microinteracciones deben durar entre 100 y 300 ms»: es una regla muy repetida pero **no
  encontré una fuente primaria verificable**; la uso como **hipótesis mía**, coherente con los
  tokens de Material (short 50–200 ms, medium 250–400 ms).

---

## 4. Microinteracciones, una por una

Convención de las tablas: **RM** = qué pasa con «Reducir movimiento». **Háptica** = vibración
(solo Android, sección 6).

### 4.1 Presionar botones (todas las variantes de `.btn`)

Principio: respuesta **en el mismo cuadro** del toque, sin esperar al `click`. La presión es
«física»: se hunde un poco y se oscurece; al soltar vuelve en 100 ms.

```css
.btn, .barra button, .segmento button, .avatar, .puntos, .cerrar-aviso {
  touch-action: manipulation;              /* sin espera de doble toque para zoom */
  -webkit-tap-highlight-color: transparent;/* quitamos el gris de Safari: ponemos el nuestro */
  position: relative; isolation: isolate;
  transition: transform var(--dur-micro) var(--ease-estandar);
}
.btn::after {                              /* capa de presión: se anima solo su opacidad */
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: currentColor; opacity: 0; pointer-events: none;
  transition: opacity var(--dur-micro) var(--ease-estandar);
}
.btn:active:not(:disabled), .btn.presionado { transform: scale(var(--mov-escala)); transition-duration: 0ms; }
.btn:active:not(:disabled)::after, .btn.presionado::after { opacity: .10; transition-duration: 0ms; }
```

| Tipo | Al presionar | Al soltar | Notas |
|---|---|---|---|
| Primario amarillo `.btn` | escala .97 + velo 10 % del color del texto | 100 ms estándar | El amarillo no cambia de tono (identidad) |
| `.btn.sec` | igual; el velo se ve gris suave | 100 ms | — |
| `.btn.exito` «Subió» / `.btn.peligro` | igual | 100 ms | La confirmación real viene después (4.4) |
| `.btn.texto` («Volver», «cambiar») | sin escala; velo en forma de píldora | 100 ms | Escalar texto suelto se ve tembloroso (**hipótesis mía**) |
| `.btn.chico` ↑ ↓ ✕ | escala .92 (más notoria: el blanco es chico) | 100 ms | Agrandar el blanco a 44×44 px (defecto 8) |
| `.btn.grande` «Iniciar recorrido» | escala .98 (es grande: menos escala) | 100 ms + háptica 20 ms | — |
| `:disabled` | nada | — | Tocar un deshabilitado: toast que explica por qué («Ya hay un recorrido en curso») — **hipótesis mía**, mejora de diseño |

**RM**: sin escala (`--mov-escala: 1`); queda solo el velo de opacidad.

**Detalle iPhone**: Safari en iOS históricamente no aplica `:active` al tocar si no hay un
`touchstart` registrado. **No lo pude verificar en documentación actual**; para no depender de eso,
agregar la clase `.presionado` en `pointerdown` y quitarla en `pointerup`/`pointercancel`
(Pointer Events: Safari iOS 13+, Chrome Android 55+, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent)).
Como `pintar()` reemplaza el botón al hacer clic, la clase desaparece sola con el nodo viejo.

Blancos táctiles: WCAG 2.5.8 (AA) pide mínimo 24×24 px
([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); el inventario ya
propone 44 px para las ✕, lo apoyo.

### 4.2 Interruptores «Hoy no viaja» y «Que las familias me encuentren» (F-73, F-90)

Hoy el `::after` del checkbox no puede animarse porque el checkbox se recrea. Propuesta:

```html
<label class="interruptor" data-k="sw:sofia:ida" data-v="on">
  <input type="checkbox" role="switch" data-novahoy="sofia:ida" checked aria-label="Sofía: no viaja a la ida">
  <span class="pista"></span><span class="perilla" data-k="perilla:sofia:ida"></span>
</label>
```

- La **perilla** es un elemento real con clave → FLIP la desliza sola de su posición vieja a la nueva
  (220 ms, estándar).
- La **pista** cambia de color con un fundido de opacidad de una capa roja/verde encima de la gris
  (150 ms) — la animación «cambio» por `data-v`.
- La perilla se estira un poco al presionar (ancho 22 → 26 px vía `scaleX(1.15)`), como los
  interruptores nativos (**hipótesis mía**: da sensación de «agarre»).
- Háptica: 10 ms al cambiar.
- **RM**: la perilla cambia de lado con fundido (sin deslizar).
- Experimento opcional: Safari 17.4+ tiene `<input type="checkbox" switch>` (no estándar, marcado
  experimental en [MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/html/elements/input.json));
  según un reporte de WebKit, en iOS 18 da un toque háptico nativo al tocarlo
  ([WebKit bug 285120](https://bugs.webkit.org/show_bug.cgi?id=285120)). **No verificado por mí**
  y cambia el aspecto: no lo incluiría sin probar en un iPhone real. No usar los trucos que lo
  disparan por código.

### 4.3 Segmentos (Automático/Claro/Oscuro, Ida/Vuelta)

La píldora amarilla es un `<span data-k="pildora-tema">` dentro del botón elegido: con FLIP **se
desliza** al nuevo botón (220 ms, estándar). El texto cambia de color con 100 ms. Al cambiar de
tema, todos los colores cambian a la vez: hacerlo **sin animación** (un fundido de toda la pantalla
cansa y no aporta; **hipótesis mía**). RM: la píldora aparece en su lugar con fundido.

### 4.4 Marcar «Subió / En su hogar» y «Ausente» (F-20) — la acción más importante de la tía

Secuencia (todo dentro de `conMovimiento`):

1. 0 ms — presión del botón (4.1) + háptica: «Subió» `15` ms; «Ausente» `[12, 60, 12]`
   (dos toques: se distingue sin mirar; **hipótesis mía**).
2. 0 ms — `S.recorrido.estados[id] = …; pintar()` (la verdad cambia al instante, como hoy).
3. 0–150 ms — la tarjeta vieja sale como **fantasma**: «Subió» se desliza 24 px a la derecha y se
   desvanece; «Ausente» se desvanece sin moverse (salir hacia un lado «premia» la acción positiva;
   **hipótesis mía**).
4. 80–300 ms — las tarjetas de abajo **suben** con FLIP (220 ms estándar, con 80 ms de retraso para
   que no se encimen con el fantasma).
5. Su fila aparece en «Atendidos» con fundido + 8 px desde arriba (220 ms, entrada) y el ✓ se
   «dibuja» (trazo del SVG, 300 ms). El trazo usa `stroke-dashoffset`, que no es
   transform/opacidad, pero es un ícono de 20 px: costo despreciable (**hipótesis mía**).
6. En el mapa, la casa pasa a verde (4.10).
7. Toast: «Sofía: subió · **Deshacer**» durante 5 s (ver 4.8). Recomiendo agregar «Deshacer»:
   marcar «Ausente» por error significa que nadie espera a ese niño (**propuesta de diseño**; es un
   cambio de lógica mínimo: volver el estado a `pendiente`).

**Riesgo detectado — toque fantasma**: cuando la tarjeta sale y las de abajo suben, la siguiente
tarjeta queda **debajo del dedo**; un doble toque marcaría al niño siguiente. Mitigación: ignorar
clics en `[data-marcar]` durante 450 ms después de marcar (duración de la secuencia + margen).

RM: fantasma solo con fundido; las tarjetas de abajo se reubican sin deslizarse (fundido de 150 ms
de la lista); el ✓ aparece sin dibujarse.

### 4.5 Reordenar la ruta ↑ ↓ (F-40)

- Las dos filas intercambiadas se deslizan con FLIP (220 ms, estándar). La que tocaste queda por
  encima (`z-index`) y con sombra durante la animación para que el ojo la siga.
- **Foco**: hoy, al tocar ↑ el botón desaparece y el foco se pierde. Después de `pintar()`, enfocar
  el mismo botón de la misma alumna (`data-k="mover:manana:sofia:-1"`); si quedó deshabilitado
  (llegó arriba), enfocar su ↓. Así se puede tocar ↑ varias veces seguidas, también con lector de
  pantalla.
- Anuncio en la región viva del toast (sin mostrar toast): «Sofía, parada 1 de 4».
- Los números de parada cambian con un fundido de 100 ms.
- Arrastrar para reordenar: **descartado en v1**. WCAG 2.5.7 exige alternativa sin arrastre
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)) — que ya son ↑↓ —,
  y arrastrar dentro de una lista que se desplaza choca con el scroll en celular.
- RM: las filas cambian de lugar con fundido.

### 4.6 Cambio de pestaña y navegación (barra inferior, «Volver»)

- **Barra**: el ícono de la pestaña nueva hace un «pop» (escala .85 → 1, 240 ms, rebote) y aparece
  una píldora amarilla suave detrás del ícono (opacidad + `scaleX` .6 → 1, 200 ms, entrada). La
  píldora es un indicador más visible que solo negrita (**hipótesis mía**; patrón de la barra de
  navegación de Material 3).
- **Contenido** de una pestaña hermana: fundido + 8 px hacia arriba (150 ms, entrada). No deslizar de
  lado: sugiere que se puede deslizar entre pestañas, y ese gesto choca con «atrás» del navegador en
  iPhone (**hipótesis mía**).
- **Pantallas «hijas»** (Mi perfil, Cobros, Mi licencia, Furgón en vivo): entran 24 px desde la
  derecha + fundido (220 ms, entrada); «Volver» las hace salir hacia la derecha. La dirección dice
  «entraste a algo» / «volviste».
- **Foco**: al cambiar de pantalla, mover el foco al `<h1>` (con `tabindex="-1"`) para que el lector
  de pantalla diga dónde quedó la persona.
- **Iniciar recorrido**: transición a pantalla hija + háptica 20 ms + el furgón aparece en la
  partida con escala .6 → 1 (220 ms, rebote).
- **Barra que se oculta** en recorrido / en vivo: baja 100 % de su alto (150 ms, salida); vuelve
  con 220 ms, entrada. Como la barra se regenera, la animación se dispara solo cuando cambia
  `sinBarra` (comparar con el valor anterior).
- RM: solo fundidos de 150 ms; el «pop» desaparece.

```js
function entrarPantalla(dir /* "hermana" | "hija" | "volver" */) {
  const el = document.getElementById("pantalla");
  const dx = RM.matches ? 0 : dir === "hija" ? 24 : dir === "volver" ? -24 : 0;
  const dy = RM.matches || dir !== "hermana" ? 0 : 8;
  el.animate([{ opacity: 0, transform: `translate(${dx}px,${dy}px)` }, { opacity: 1, transform: "none" }],
             { duration: dir === "hermana" ? T.corta : T.media, easing: E.entrada });
  el.querySelector("h1")?.focus({ preventScroll: true });
}
```

View Transitions para esto (opcional, más adelante): `document.startViewTransition(() => pintar())`
con fundido cruzado de 150 ms, solo si existe la función y solo en toques (nunca en ticks).
Soporte en la tabla de la sección 9.

### 4.7 Hoja del menú ⋮ (F-60) y diálogo «¿Eliminar la ruta?» (F-40)

**Decisión: usar `<dialog>` nativo con `showModal()`, fuera de `#pantalla`.**

- Por qué: da tecla Esc (evento `cancel`), deja el resto de la página inerte (el foco no se escapa) y
  dibuja encima de todo — arregla el defecto 7 sin código propio. Soporte: Safari iOS 15.4+, Chrome
  Android 37+ ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)).
- Tienen que vivir **fuera** de `#pantalla` (`<dialog id="hoja-menu">` y `<dialog id="dlg-confirmar">`
  fijos en el HTML), porque si no `pintar()` los destruiría en cada cambio. `pintar()` solo llena su
  contenido y sincroniza abierto/cerrado con `S.menu` / `S.confirmar`.
- «Tocar fuera para cerrar»: `closedby="any"` lo haría solo, pero **Safari aún no lo tiene** (solo
  vista previa; Chrome 134+). Se hace a mano: clic cuyo `target` es el propio `<dialog>`.
- Animación de salida: CSS puro con `@starting-style` + `transition-behavior: allow-discrete`
  necesita también la propiedad `overlay`, que **Safari no soporta**
  ([MDN BCD overlay](https://developer.mozilla.org/en-US/docs/Web/CSS/overlay)). Por eso: animar con
  Web Animations y **recién al terminar** llamar a `close()`.
- Alternativa descartada: seguir con `.capa` propia + `inert` en `#pantalla` + Esc a mano + trampa de
  foco. Funciona dentro del marco del teléfono en escritorio (el `<dialog>` modal cubre toda la
  ventana, también el selector de rol), pero es más código y más riesgo. Celular primero → gana
  `<dialog>`.

**Hoja del menú: hoja inferior** (hoy aparece arriba; abajo queda al alcance del pulgar).

| Momento | Hoja | Fondo oscuro (`::backdrop`) | Duración / curva |
|---|---|---|---|
| Abrir | sube desde `translateY(100%)` | opacidad 0 → 1 | 320 ms, entrada |
| Cerrar (botón, fuera, Esc) | baja a `translateY(100%)` | 1 → 0 | 200 ms, salida |
| Arrastre (4.7.1) | sigue al dedo 1:1 | opacidad = 1 − avance | sin curva (es el dedo) |
| RM | fundido 150 ms sin desplazamiento | igual | 150 ms |

```js
async function cerrarHoja(dlg) {
  const hoja = dlg.querySelector(".hoja");
  const a = hoja.animate([{ transform: "none", opacity: 1 },
      { transform: RM.matches ? "none" : "translateY(100%)", opacity: RM.matches ? 0 : 1 }],
      { duration: RM.matches ? 150 : 200, easing: E.salida, fill: "forwards" });
  dlg.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 200, pseudoElement: "::backdrop", fill: "forwards" }); // Safari 14+, Chrome 84+
  await a.finished;
  dlg.close(); a.cancel();
  devolverFoco("menu");   // al botón ⋮ (por su data-k), que pintar() pudo haber recreado
}
```

**Diálogo de confirmación** (destructivo): aparece al centro con escala .96 → 1 + fundido (220 ms,
entrada); sale con fundido 150 ms. El foco inicial va a **«Cancelar»** (la opción segura); el botón
rojo nunca es el predeterminado. Sin sacudidas ni rebotes: es un momento serio (tono cálido no es
tono juguetón). Al confirmar: háptica 20 ms, la tarjeta de la ruta sale como fantasma y las de
abajo suben con FLIP.

#### 4.7.1 Gesto: deslizar hacia abajo para cerrar la hoja

- Se arrastra **solo desde la agarradera** (barrita gris de 36×4 px arriba, con zona táctil de 44 px
  de alto) **o** desde cualquier parte si el contenido de la hoja está arriba del todo
  (`scrollTop === 0`). Así no pelea con el scroll de la hoja.
- `touch-action: none` solo en la agarradera; el resto mantiene el scroll nativo.
- Cierra si se arrastró más de 30 % del alto **o** se soltó a más de 0,5 px/ms hacia abajo; si no,
  vuelve a su lugar. Hacia arriba, resistencia: desplazamiento mostrado = 0,2 × desplazamiento del dedo.
  Umbrales: **hipótesis mía** (valores habituales; ajustar probando).
- La duración del cierre se adapta a la velocidad para que no «frene» al soltar:
  `dur = clamp(120 ms, distancia_restante / velocidad, 240 ms)`.
- **Riesgos**: no es descubrible (por eso la agarradera, que todos conocen de las apps), y en iPhone
  el gesto de bajar desde arriba de la pantalla abre el centro de notificaciones (por eso la hoja es
  inferior y el gesto empieza en la agarradera, lejos del borde). **Siempre** hay botón «Cerrar»,
  tocar fuera y Esc: WCAG 2.5.1 exige alternativa sin gesto de trayectoria
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)).

```js
agarradera.addEventListener("pointerdown", (e) => {
  agarradera.setPointerCapture(e.pointerId);
  const y0 = e.clientY, t0 = e.timeStamp, H = hoja.offsetHeight; let dy = 0, v = 0, tPrev = t0, yPrev = y0;
  const mover = (ev) => {
    dy = ev.clientY - y0; const vis = dy < 0 ? dy * 0.2 : dy;
    v = (ev.clientY - yPrev) / Math.max(1, ev.timeStamp - tPrev); yPrev = ev.clientY; tPrev = ev.timeStamp;
    hoja.style.transform = `translateY(${vis}px)`;
  };
  const soltar = () => {
    agarradera.removeEventListener("pointermove", mover); hoja.style.transform = "";
    if (dy > 0.3 * H || v > 0.5) cerrarHoja(dlg /* con duración según velocidad */);
    else hoja.animate([{ transform: `translateY(${Math.max(0, dy)}px)` }, { transform: "none" }],
                      { duration: 220, easing: E.estandar });
  };
  agarradera.addEventListener("pointermove", mover);
  agarradera.addEventListener("pointerup", soltar, { once: true });
  agarradera.addEventListener("pointercancel", soltar, { once: true });
});
```

### 4.8 Toast (F-91)

- Un solo `<div id="toast" role="status" aria-live="polite">` **fijo en el HTML**, fuera de
  `#pantalla` (MDN: las regiones vivas más confiables son las que están en el marcado inicial;
  [MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)).
  `avisar()` cambia su texto y lo muestra; **ya no necesita llamar a `pintar()`** (una cosa menos que
  destruye el interruptor).
- Entrada: desde 16 px abajo + fundido (200 ms, entrada). Salida: fundido + 8 px abajo (150 ms,
  salida).
- Si llega un toast nuevo con uno visible: no sale y entra; se cambia el texto y hace un pulso
  mínimo (escala 1 → 1,02 → 1, 150 ms). Se reinicia el reloj.
- Duración: se mantiene **2,6 s como mínimo** (contrato F-91). Propongo
  `duración = max(2600, 1200 + 50 ms × caracteres)`, tope 6 s, y 5 s si trae «Deshacer»
  (**hipótesis mía**: un texto de 50 letras ≈ 3,7 s). Mientras el dedo está encima, se pausa.
- Sobre la barra inferior; si la barra está oculta (recorrido), baja a 16 px del borde.
- RM: solo fundido.

### 4.9 Alarma de la familia (F-71) — ¿es buena idea el latido infinito?

**Respuesta corta: no.** El latido actual (`scale` 1 → 1,015, ida y vuelta cada 1 s, infinito):

- **WCAG 2.2.2 Pausar, detener, ocultar (nivel A)**: todo lo que se mueve, empieza solo, dura más de
  5 s y está junto a otro contenido necesita forma de pausarlo, salvo que el movimiento sea esencial
  ([texto normativo](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)). La alarma
  aparece sola (la dispara el furgón, no la familia), dura hasta que tocan «Recibido» y está junto a
  las tarjetas de los hijos. El latido no agrega información (el texto, el color y la campana ya la
  dan), así que **no es esencial** → hoy **no cumple** (la única salida es «Recibido», que además
  borra la alarma).
- **WCAG 2.3.3 Animación por interacción (AAA)**: se refiere a animación disparada por la persona;
  la de la alarma la cubre 2.2.2. Aplica a nuestras microinteracciones (sección 7)
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).
- **WCAG 2.3.1** (destellos, A): no hay problema; 1 ciclo por segundo y sin cambio fuerte de brillo
  está lejos de «más de 3 destellos por segundo». No usar parpadeo de color amarillo/blanco.
- Además, mover **todo el bloque con el texto** dificulta leerlo justo cuando importa (W3C menciona a
  quienes tienen dificultad para leer texto en movimiento, misma fuente de 2.2.2).

**Propuesta**:

| Momento | Qué se ve | Duración / curva | Háptica | RM |
|---|---|---|---|---|
| Aparece | baja 12 px + fundido + escala .98 → 1 | 320 ms, entrada | `[200, 120, 200]` | fundido 150 ms |
| Llamar la atención | **solo la campana** se mueve: rotación 0 → −14° → 12° → −8° → 6° → 0° (700 ms), 3 veces con 600 ms de pausa | ≈ 3,9 s en total, **menos de 5 s** → fuera de 2.2.2 | — | sin movimiento: la campana queda fija |
| Después | quieta, amarilla, borde de 2 px más oscuro; texto grande | — | — | igual |
| Faltan ≤ 2 min | un solo «recordatorio»: 1 ciclo de campana | 700 ms | `[200]` | sin movimiento |
| «Recibido, estoy atento/a» | presión del botón, la alarma se pliega como fantasma (fundido + escala .98, 200 ms, salida), las tarjetas suben (FLIP) | 200 ms | 15 ms | fundido |

- El recordatorio de 2 min es un **cambio de estado**, no un bucle: se dispara una vez por la firma.
- Anuncio: el contenedor de la alarma va en una región `role="alert"` fija (MDN: `alert` se anuncia
  de forma más consistente incluso si se inserta con su contenido). Se anuncia una vez; los minutos
  que cambian dentro **no** se re-anuncian (van por parche y fuera de la región).
- Por qué no hacer latir el **fondo**: animar color repinta todo el bloque y se acerca a «parpadeo».
- Alternativa descartada: «latido infinito pero con botón Pausar». Cumple, pero agrega un botón en el
  momento de más apuro y el latido sigue sin informar nada.
- Límite honesto: en la web, si la pantalla está bloqueada o la pestaña oculta, **no hay vibración ni
  movimiento** (ver 6). En la app real el aviso de verdad son la notificación y la llamada.

### 4.10 Casa que pasa a verde en el mapa (F-07)

- La casa (`<g data-k="casa:60,52" data-v="listo">`) cambia de azul a verde con fundido de 150 ms (un
  círculo verde encima con opacidad 0 → 1).
- Una **onda** sale del círculo: un anillo verde que crece (escala 1 → 1,8) y se desvanece (opacidad
  .6 → 0) en 600 ms, entrada. Una sola vez. Se anima con `transform` + `transform-box: fill-box;
  transform-origin: center` para escalar desde el centro de la casa.
- Si fue automático (llegó a 0 min sin que la tía tocara): igual; la firma detecta el cambio y el
  redibujo completo pasa por el mismo detector de `data-v`.
- Privacidad (F-07): la familia solo ve su casa (⌂); la onda solo ocurre en las casas que ya se
  dibujan. No agregar nada que delate casas ajenas.
- RM: solo el cambio de color con fundido; sin onda.

### 4.11 Otros toques

| Elemento | Microinteracción | RM |
|---|---|---|
| Cerrar avisos ✕ (F-11, F-12) | el aviso sale como fantasma (fundido 150 ms) y lo de abajo sube (FLIP) | fundido |
| «Calcular la mejor ruta» (F-08) | el resultado entra con fundido + 8 px (220 ms); «Aplicar» reordena la lista con FLIP (se ve cómo cambian de lugar) | fundidos |
| «Aviso n min antes · cambiar» (F-74) | el número cambia con fundido corto (100 ms) | igual |
| Avisar que pagué (F-81) | chip «Por pagar» → «Pagado» con `data-v`: fundido + ✓ dibujado; el botón sale como fantasma | fundido |
| Enviar mensaje (F-82) | la tarjeta nueva entra arriba (fundido + 8 px), las de abajo bajan (FLIP); el campo se vacía | fundido |
| Chip «🔔 Apoderado avisado» (F-20) | al cambiar `data-v`, aparece con fundido y la campanita hace 1 ciclo de 700 ms | fundido |
| Chip «● En curso» | **punto fijo**, sin pulso infinito (misma razón que la alarma) | — |
| Guardar perfil | botón → toast; nada más | — |
| Foto nueva (F-90) | la imagen aparece con fundido 220 ms en el avatar | igual |

**Regla general: en esta app no hay ninguna animación infinita decorativa.** Lo único que se mueve
sin parar es el furgón, porque su posición *es* la información.

---

## 5. Orden de prioridades (para implementar por partes)

1. Firma + parche + furgón con rAF (arregla foco, saltos y costo). **Mayor impacto.**
2. Toast fijo con región viva; alarma sin latido infinito (accesibilidad A).
3. `<dialog>` para menú y confirmación con entrada/salida.
4. Presión de botones (`pointerdown` + `.presionado`).
5. `conMovimiento` (FLIP + fantasmas): marcar Subió/Ausente, ↑↓, cerrar avisos, interruptores.
6. Pestañas, navegación y foco al `<h1>`.
7. Vibración (Android).
8. Gesto de deslizar la hoja.

---

## 6. Vibración (`navigator.vibrate`)

Verificado en los datos de compatibilidad de MDN
([página](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate),
[datos](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)) y en la
especificación del W3C ([Vibration API](https://w3c.github.io/vibration/)):

| Navegador | Soporte | Notas |
|---|---|---|
| **Chrome Android** | Sí, desde 32 | Desde Chrome 60 **requiere gesto del usuario**, si no devuelve `false`; no funciona en iframes de otro origen (desde 55) |
| **Safari iOS** | **No** (ninguna versión) | Confirmado: `safari_ios: false` en los datos de MDN. Hay un reporte en GitHub que dice lo contrario (2023) sin confirmar; no cambia los datos |
| Firefox Android | Parcial | La función existe pero **no vibra** (devuelve `true`) |

Reglas de la especificación: requiere **activación persistente** («sticky activation»: que la
persona haya tocado la página alguna vez), la página debe estar **visible** y la vibración se corta
a 10 s máximo. MDN agrega que en modo silencio o No molestar puede no vibrar.

Consecuencia para la alarma: vibra solo si la familia ya tocó la página y la tiene a la vista.
Nunca puede ser el único aviso.

```js
const vibrar = (patron) => { try { navigator.vibrate?.(patron); } catch {} };
// Patrones (hipótesis mía: cortos y distinguibles; ajustar probando en un teléfono real)
const H = { toque: 10, subio: 15, ausente: [12, 60, 12], inicio: 20, alarma: [200, 120, 200] };
```

La vibración **no** se apaga con «reducir movimiento» (son ajustes distintos; Android tiene su propio
ajuste de vibración táctil). Opcional: un interruptor «Vibrar» en Apariencia.

---

## 7. «Reducir movimiento» (`prefers-reduced-motion`)

Soporte: Chrome Android 74+, Safari iOS 10.1+
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)).
Se activa en iOS: Ajustes → Accesibilidad → Movimiento; en Android 9+: Ajustes → Accesibilidad →
Quitar animaciones (misma fuente).

Criterio (WCAG 2.3.3, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)):
se elimina el movimiento **no esencial** (desplazamientos, escalas, rotaciones, rebotes, ondas,
paralaje); se reemplaza por **fundidos de opacidad cortos** (≤ 150 ms), que no provocan mareo
(MDN usa justamente el fundido como reemplazo en su ejemplo).

| Se elimina | Se reemplaza por |
|---|---|
| Escala al presionar | velo de opacidad (queda) |
| Deslizamientos FLIP (reordenar, tarjetas que suben) | fundido de la lista |
| Fantasma que se desliza | fundido en su lugar |
| Hoja que sube / baja | fundido 150 ms |
| Diálogo que crece | fundido 150 ms |
| Contenido de pestaña que entra desde el lado | fundido 150 ms |
| «Pop» del ícono, campana que se mueve, onda de casa | nada (cambio de color con fundido) |
| Entrada de la alarma | fundido 150 ms |
| ✓ que se dibuja | ✓ aparece |
| **Furgón en el mapa** | **se mantiene** suave: es información esencial (WCAG permite animación esencial). Un furgón que se desliza lento cansa menos que uno que salta 4 veces por segundo (**hipótesis mía**) |

Implementación: los tokens CSS de la sección 3 (distancias a 0) + `RM.matches` en JS para las
animaciones con Web Animations, escuchando cambios: `RM.addEventListener("change", …)`.

---

## 8. Rendimiento: reglas

1. Animar solo `transform` y `opacity` (excepciones chicas y anotadas: trazo del ✓).
2. No animar `height`, `top`, `margin`: para «colapsar» se usa fantasma + FLIP de los vecinos.
   (`interpolate-size`, que permitiría animar a `height: auto`, **no existe en Safari**:
   [MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/interpolate-size.json).)
3. Medir todo junto y escribir todo junto (evita «layout thrash»).
4. Nada de `will-change` permanente; si hace falta, ponerlo solo mientras dura la animación.
5. Un solo bucle `requestAnimationFrame` (el furgón), que se detiene si no hay mapa en pantalla o no
   hay recorrido.
6. Durante el recorrido, el redibujo completo pasa de 4 por segundo a **solo cuando cambia la firma**
   (con 4 alumnos: unas 8–10 veces en todo el recorrido; **estimación mía**: un aviso y una llegada
   por casa).
7. Presupuesto: cada cuadro en ≈ 10 ms (RAIL); medir en un Android de gama media con
   Chrome DevTools → Performance → CPU 4× más lenta.

---

## 9. Tabla de soporte de las API propuestas

Fuente única para todas: **datos de compatibilidad de MDN** (`mdn/browser-compat-data`, rama
`main`, leídos el 14-10-2026). Aviso honesto: desde este entorno **no pude abrir** caniuse.com ni
developer.mozilla.org directamente; leí los mismos datos que muestran esas páginas en su repositorio
de GitHub. En iPhone la versión de Safari = versión de iOS.

| API | Safari iOS | Chrome Android | Uso aquí | Enlace |
|---|---|---|---|---|
| `navigator.vibrate` | **No** | 32+ (gesto desde 60) | háptica | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) |
| View Transitions `document.startViewTransition` | 18+ | 111+ | descartada en v1 | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) |
| ↳ `view-transition-class`, `types` | 18.2+ | 125+ | — | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-class) |
| ↳ transiciones con raíz en un elemento (`transitionRoot`) | No | 147+ | — | [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/ViewTransition.json) |
| Web Animations `Element.animate()` | 13.1+ | 36+ | **base de todo** | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) |
| ↳ `Animation` y `.finished` | 13.1+ | 75+ (`finished` 84+) | salidas antes de `close()` | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Animation) |
| ↳ opción `pseudoElement` (animar `::backdrop`) | 14+ | 84+ | fondo del diálogo | [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json) |
| `requestAnimationFrame` | 7+ | 24+ | furgón | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) |
| `prefers-reduced-motion` | 10.1+ | 74+ | sección 7 | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) |
| `<dialog>` + `showModal()` | 15.4+ | 37+ | menú y confirmación | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) |
| ↳ `closedby` (cerrar tocando fuera) | **No** (solo vista previa) | 134+ | se hace a mano | [BCD](https://github.com/mdn/browser-compat-data/blob/main/html/elements/dialog.json) |
| ↳ `requestClose()` | 18.4+ | 134+ | no necesario | ídem |
| atributo `inert` | 15.5+ | 102+ | fantasmas; alternativa a `<dialog>` | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) |
| `popover` | 17+ | 114+ | no lo uso (el toast va como región viva fija) | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover) |
| `:has()` | 15.4+ | 105+ | opcional: estilos del interruptor según `input:checked` | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) |
| `color-mix()` | 16.2+ | 111+ | ya se usa en chips; capas de color de presión | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) |
| `@starting-style` | 17.5+ | 117+ | entradas CSS simples (opcional) | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) |
| `transition-behavior: allow-discrete` | 17.4+ | 117+ | — | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior) |
| propiedad `overlay` | **No** | 117+ | por esto la salida del diálogo va en JS | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overlay) |
| función de curva `linear()` | 17.2+ | 113+ | no necesaria (resortes); opcional | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear) |
| `interpolate-size` | **No** | 129+ | no usar | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size) |
| Pointer Events | 13+ | 55+ | presión, gesto | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent) |
| `touch-action` | 9.3+ | 36+ | sin demora de doble toque; agarradera | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) |
| `<input type=checkbox switch>` | 17.4+ (experimental, no estándar) | No | experimento opcional | [BCD](https://github.com/mdn/browser-compat-data/blob/main/html/elements/input.json) |

Conclusión del soporte: todo lo **imprescindible** (Web Animations, rAF, `<dialog>`, reduced-motion,
Pointer Events) funciona desde **iOS 15.4** y en cualquier Chrome Android actual. Lo que no está en
iPhone (vibración, `closedby`, `overlay`) tiene reemplazo o simplemente no ocurre.

---

## 10. Decisiones y alternativas descartadas (resumen)

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Firma + parche durante el recorrido | Seguir redibujando 4/s | Pierde foco, reinicia animaciones, gasta batería |
| FLIP + fantasmas con Web Animations | View Transitions | Bloquea toques al animar, se cancela con ticks, iOS 18+ |
| FLIP propio | Diff del DOM (tipo morphdom) | Demasiado código y riesgo para un solo archivo |
| Interpolar el **avance** del furgón | Interpolar x/y | Cortaría las esquinas en diagonal |
| Interpolar con 1 tick de atraso | Extrapolar con velocidad | Se pasaría de largo en las paradas |
| Alarma: entrada + 3 ciclos de campana (< 5 s) | Latido infinito (hoy) | No cumple WCAG 2.2.2 y mueve el texto |
| `<dialog>` nativo | `.capa` + `inert` a mano | Más código; Esc y foco gratis con `<dialog>` |
| Salida de diálogo con Web Animations | CSS `@starting-style` + `overlay` | `overlay` no existe en Safari |
| Hoja inferior | Hoja arriba (hoy) | Alcance del pulgar en celular |
| Deslizar para cerrar, con botón | Sin gesto / solo gesto | El gesto es cómodo pero no descubrible: siempre alternativa |
| Botones ↑↓ animados | Arrastrar para reordenar | WCAG 2.5.7, choque con scroll |
| Botones «Subió»/«Ausente» | Deslizar la tarjeta para marcar | Error fácil al desplazar; poco descubrible; la tía puede estar en el volante |
| Contenido de pestaña con fundido vertical | Deslizar de lado | Sugiere un gesto que no existe y choca con «atrás» en iPhone |
| Toast fijo en el HTML | Toast creado en cada `pintar()` | Las regiones vivas nuevas pueden no anunciarse |
| Tema cambia sin animación | Fundido de toda la pantalla | Pesado y sin propósito |
| Vibración solo Android y nunca sola | Vibración como aviso principal | iPhone no la soporta |

---

## 11. Cómo verificar (etapa 6)

- Con un teléfono Android y un iPhone reales: tocar cada tipo de botón y ver respuesta inmediata.
- Iniciar un recorrido y mirar el furgón: debe deslizarse sin saltos; abrir DevTools → Rendering →
  «Frame rendering stats» en Chrome Android (depuración remota).
- Durante el recorrido, enfocar un botón con teclado o VoiceOver: el foco **no** debe perderse.
- Activar «Reducir movimiento» y repetir: solo fundidos; el furgón sigue moviéndose.
- Alarma: contar que la campana se mueve 3 veces y para (< 5 s).
- Marcar «Subió» y tocar dos veces rápido: no debe marcarse el niño siguiente.
- Abrir el menú: Esc, tocar fuera, «Cerrar» y deslizar la agarradera lo cierran; el foco vuelve a ⋮.
- Revisar que todos los F-xx del inventario sigan funcionando igual.

---

## 12. Glosario

- **Animación esencial**: la que lleva información que se perdería sin ella (aquí: el furgón
  moviéndose). WCAG permite mantenerla.
- **Activación persistente («sticky activation»)**: el navegador recuerda que la persona ya tocó la
  página; algunas funciones (vibrar) solo funcionan después de eso.
- **Clave (`data-k`)**: nombre único de un elemento en pantalla, para reconocerlo después de
  redibujar.
- **Composición / GPU**: etapa final del dibujo; cambiar `transform` y `opacity` puede hacerse ahí
  sin recalcular la página, por eso son baratas.
- **cubic-bezier**: fórmula de la curva de velocidad de una animación (sección 3.1).
- **Curva de entrada / salida**: entrada desacelera (algo llega y se acomoda); salida acelera (algo
  se va).
- **Fantasma**: copia visual de un elemento que ya se borró, usada solo para animar su salida.
- **FLIP**: First, Last, Invert, Play. Medir antes, medir después y animar la diferencia.
- **Firma**: texto que resume la parte del estado que obliga a redibujar todo.
- **Foco**: qué elemento recibe el teclado o el lector de pantalla.
- **fps / Hz**: cuadros por segundo; la pantalla del teléfono se actualiza 60 o 120 veces por
  segundo.
- **Háptica**: vibración corta como respuesta a un toque.
- **Hit testing**: cómo el navegador decide qué elemento recibe un toque.
- **Hoja inferior («bottom sheet»)**: panel que sube desde abajo de la pantalla.
- **`inert`**: atributo que hace que una parte de la página no se pueda tocar ni enfocar.
- **Interpolar**: calcular valores intermedios entre dos conocidos (aquí, posiciones del furgón entre
  dos ticks).
- **Layout / reflow** y **layout thrash**: recalcular dónde va cada cosa; «thrash» es hacerlo muchas
  veces seguidas por alternar medir y cambiar.
- **Parche**: actualizar solo un número o un atributo, sin redibujar la pantalla.
- **`prefers-reduced-motion`**: ajuste del sistema que pide menos movimiento.
- **Región viva (`aria-live`, `role="status"`, `role="alert"`)**: zona cuyo texto nuevo el lector de
  pantalla lee en voz alta.
- **`requestAnimationFrame` (rAF)**: pedirle al navegador «avísame justo antes de dibujar el próximo
  cuadro».
- **Tick**: cada paso del temporizador del recorrido (cada 250 ms).
- **Toast**: mensaje breve que aparece y se va solo.
- **Token**: variable con nombre (`--dur-media`) que guarda una decisión de diseño para usarla igual
  en todas partes.
- **View Transitions API**: función del navegador que anima entre dos «fotos» de la página.
- **Web Animations API (WAAPI)**: `elemento.animate(...)`: animaciones desde JavaScript con las mismas
  capacidades que las de CSS, y una promesa `finished` para saber cuándo terminan.
- **WCAG**: pautas internacionales de accesibilidad web del W3C (niveles A, AA, AAA).

---

### Fuentes consultadas

- Datos de compatibilidad de MDN: <https://github.com/mdn/browser-compat-data> (archivos citados en la
  sección 9).
- MDN (contenido): `Navigator.vibrate`, `requestAnimationFrame`, `prefers-reduced-motion`, View
  Transitions «Using», Live regions — repositorio <https://github.com/mdn/content>.
- W3C WCAG 2.2, criterios 2.2.2, 2.3.1, 2.3.3, 2.5.1, 2.5.7, 2.5.8 — repositorio
  <https://github.com/w3c/wcag> (textos normativos y «Understanding»).
- W3C Vibration API: <https://w3c.github.io/vibration/>.
- CSS View Transitions 1 (CSSWG): <https://drafts.csswg.org/css-view-transitions-1/>.
- Material Design 3, tokens de movimiento:
  <https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md>.
- RAIL (web.dev): <https://web.dev/articles/rail>.
- Nielsen, tiempos de respuesta: <https://www.nngroup.com/videos/3-response-time-limits-interaction-design/>.
- WebKit bug 285120 (háptica del `switch`): <https://bugs.webkit.org/show_bug.cgi?id=285120>.
