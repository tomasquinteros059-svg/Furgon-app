# Etapa 7 — Entrega del rediseño

**Archivo final:** `docs/rediseno/Furgon_Escolar.html` (un solo archivo, 120 KB, CSS y JS adentro).

- Ábrelo tal cual → versión **App** (con el selector «Demo: Tía / Familia»).
- Ábrelo con `#familias` al final de la dirección (`Furgon_Escolar.html#familias`) → versión
  **Familias** (sin selector, con el botón «Simular que la tía inicia la ruta»).
- Los originales siguen intactos en `docs/rediseno/original/`.

---

## 1. Cambios antes → después

| Tema | Antes | Después |
|---|---|---|
| Archivos | Dos HTML casi iguales que ya se habían desincronizado | Uno solo; `#familias` activa el modo Familias |
| Toques durante el recorrido | Un toque de más de ¼ s se perdía siempre (0 de 12 a 200 ms) | Funciona: probado con toques de 300 ms. La pantalla solo se redibuja cuando cambia algo importante, y nunca con un dedo apoyado |
| Furgón en el mapa | Saltaba ~2,6 px 4 veces por segundo | Se desliza suave; mira hacia donde avanza |
| Foco del teclado | Se perdía 4 veces por segundo y en cada toque | Vuelve al mismo botón después de cada cambio; probado 3 s en pleno recorrido |
| Inicio de la tía | «Iniciar recorrido» a 968 px, fuera de la vista | Arriba: la próxima ruta con su botón grande (a 516 px, visible sin desplazar) |
| Recorrido | Lista de tarjetas iguales, sin «siguiente» | Una parada a la vez, «Subieron los 2» para hermanos, «Después: …», atendidos corregibles |
| Errores | «Ausente» y «Terminar» sin vuelta atrás | «Deshacer» de 8 s en cada marca; «Terminar» pide confirmación si quedan niños |
| «Subió» automático | La familia leía «Subió al furgón» sin que nadie lo confirmara | «El furgón llegó a tu casa» hasta que la tía lo confirma (tu decisión) |
| Navegación | Tía: 4 pestañas + menú ⋮ escondido. Familia: 5 pestañas | Tía: Hoy · Rutas · Alumnos · Mensajes · Más. Familia: Hoy · Mensajes · Pagos · Más |
| Alarma | Latía sin parar (no cumple WCAG 2.2.2) | Entra con movimiento, la campana se mueve 3 veces (3,9 s) y queda quieta. Trae «Ver dónde viene», que también cuenta como «Recibido» |
| «Hoy no va» | Interruptor rojo = «no viaja» (doble negación) | «Va en la mañana: Sí va / No va», en positivo; bloqueado con «Ya subió» |
| Minutos de aviso | Rotaban 3→5→7→10→15 (hasta 4 toques) | Hoja con las 5 opciones a la vista y «Usar lo mismo para mis 2 hijos» |
| Pagos | «Avisar que pagué» lo dejaba en «Pagado» y la tía no se enteraba | «Avisaste el pago · Me equivoqué»; la tía lo ve en Cobros y lo confirma |
| Privacidad | La familia veía el furgón todo el trayecto | El furgón se oculta cerca de la casa de otro niño, como en la app real |
| Errores de formulario | Avisos que desaparecían en 2,6 s | Mensaje bajo el campo, en rojo, con el foco en el campo |
| Diálogos | Sin Esc, foco suelto | `<dialog>` nativo: Esc, foco dentro, fondo inerte, vuelta al botón de origen |
| Color | 19 de 40 pares fallaban el contraste | 960 textos medidos en la página real, claro y oscuro: todos pasan WCAG AA |
| Identidad | Inter, tarjetas grises genéricas, emojis mezclados | «Trazo y relleno»: borde de 2 px, sombra de sello, Fredoka + Atkinson Hyperlegible Next, solo íconos propios |
| Defectos del inventario §7 | 9 | Los 9 corregidos (foto, «TD», Google Maps, minutos de Sofía, «no va» en curso, diálogos, ✕ de 28 px, emojis) |

Textos que cambiaron respecto del contrato (los anoto para que no sorprendan):

- «Recorrido terminado. ¡Buen trabajo!» → «Recorrido cerrado. ¡Gracias por cuidarlos, tía!»
- «Recibido, estoy atento/a» → «Recibido, te espero»
- «Ausente» → botón «No estaba»; en la lista sigue diciendo «Ausente»
- Cobros: la Familia Demo ahora muestra $65.000 (lo mismo que ve la familia en Pagos). Antes
  mostraba $120.000 y no cuadraba. El total por cobrar sigue en $130.000.

---

## 2. Decisiones (resumen; detalle en `04-propuesta-final.md`)

1. Mantener `S` + `pintar()` (no usar un framework). *Descartado:* React u otra librería, porque
   rompe «un solo archivo».
2. «Firma + parche» para el recorrido. *Descartado:* View Transitions, porque bloquea los toques
   mientras anima.
3. Una parada a la vez con botones de 56 px. *Descartado:* 76 px, porque esa medida es para tocar
   la pantalla mientras se maneja, y la Ley 21.377 lo prohíbe.
4. Deshacer en vez de «¿Seguro?» para marcar niños. Confirmar solo para terminar con niños sin
   marcar y para eliminar una ruta.
5. Ninguna animación infinita, salvo el furgón (es información).
6. Fuera de esta versión: arrastrar hojas para cerrarlas, «fantasmas» de salida y pantallas de
   carga y error (están diseñadas en `04c-ux.md` §4).

---

## 3. Cómo funciona el código (las piezas importantes)

El archivo tiene tres partes: `<style>` (aspecto), el HTML mínimo (el marco) y `<script>` (todo lo
demás). El orden y los comentarios siguen las secciones de abajo.

### 3.1 Tokens (líneas iniciales del `<style>`)

Un **token** es una variable CSS con nombre, como `--amarillo: #F5B700`. Todos los colores,
tamaños, radios, sombras y duraciones salen de ahí. El modo oscuro es un solo bloque,
`:root[data-theme="dark"]`, que redefine los mismos nombres. La función `aplicarTema()` pone
`data-theme="dark"` o `"light"` según «Apariencia» (Automático/Claro/Oscuro) y el sistema. Como
el script del `<head>` lo hace antes de dibujar, no hay destello claro al abrir en modo oscuro.

### 3.2 El estado `S` y `pintar()`

`S` es un objeto con todos los datos: alumnos, rutas, recorrido, mensajes, pagos, perfil y qué
pantalla está abierta. **Es la única verdad.** `pintar()` lee `S` y vuelve a escribir el HTML de
`#pantalla` y de la barra. Ninguna acción toca la pantalla directamente: cambia `S` y llama a
`pintar()`.

Lo nuevo de `pintar()`:

- **Recuerda el foco:** antes de redibujar guarda una «clave» del botón enfocado (sus atributos
  `data-*`), y después enfoca el botón nuevo con la misma clave (`claveDe`, `restaurarFoco`).
- **Conserva lo escrito:** guarda los valores de los campos y los devuelve.
- **Conserva el desplazamiento** si es la misma pantalla; si es otra, parte arriba, anima la entrada
  y pone el foco en el título `<h1>`, para que el lector de pantalla diga dónde quedó la persona.

### 3.3 Motor del recorrido (sin cambios en lo esencial)

`puntosRuta`, `largo`, `puntoEn` y `etaMin` son **idénticos al original**. `iniciar()` agrega tres
registros al recorrido:

- `manual[id]`: lo marcó la tía. El motor ya no lo vuelve a marcar solo; sin esto, «Deshacer»
  no funcionaría.
- `recordado[id]`: ya se dio el aviso de los 2 minutos.
- `anunciado`: lo que ya se leyó en voz alta.

`tick()` corre cada 250 ms: avanza 0,4 %, avisa a quien le faltan sus minutos y, a los 0 minutos,
marca «entregado» solo si la tía no lo marcó a mano.

### 3.4 «Firma + parche» (por qué ya no se pierden los toques)

`firma()` es un texto que resume solo lo importante: rol, pantalla, estados, avisos,
confirmaciones e «hoy no va». En cada tick:

```
si firma() ≠ la de la última vez y no hay dedo apoyado → redibujar todo
si no → parcheVivo(): cambiar solo los números de minutos ([data-eta]) y mover el furgón
```

En un recorrido de ~62 s eso son unos 8–10 redibujos, en vez de 250. Si hay un dedo apoyado, el
redibujo espera a que se levante (`dedo.abajo`): justo ese caso era el que perdía toques.

### 3.5 El furgón suave (interpolación)

El tick fija un **objetivo** (`hasta`). Otro bucle, sincronizado con la pantalla
(`requestAnimationFrame`), dibuja la posición intermedia en cada cuadro:

- u = min(1, (ahora − t_tick) / 250 ms)
- f = f_desde + (f_hasta − f_desde) · u
- posición = `puntoEn(puntosRuta(r), f)`

Se interpola el **avance** f, no las coordenadas x/y. Así el furgón dobla por las calles en vez de
cortar en diagonal. Si la ruta cambia de golpe (alguien «no va») y el punto salta más de 20
unidades, el furgón aparece en el lugar nuevo con un fundido, en vez de cruzar manzanas. En la
vista familia, si queda a menos de 18 unidades de la casa de otro niño, se oculta y aparece la nota
de privacidad.

### 3.6 Movimiento al tocar (FLIP)

`conMovimiento(fn)` envuelve cada acción:

1. Mide dónde está cada elemento con `data-k` (rectángulos).
2. Ejecuta la acción y `pintar()`.
3. A cada elemento con la misma clave que cambió de lugar lo anima desde (Δx, Δy) hasta 0, solo
   con `transform`.

Lo nuevo entra con un fundido de 8 px, y lo que cambió de estado (`data-v`) da un pulso; en el mapa,
la casa atendida suelta una onda. Con «reducir movimiento» todo eso pasa a fundidos de 150 ms.
Así se ven deslizarse los niños al usar ↑ ↓, la perilla del interruptor y la lista de atendidos.

### 3.7 Avisos, anunciadores y diálogos

- **Toast:** existe desde la carga (`#toast`), fuera de `#pantalla`, así que `pintar()` no lo
  destruye. Dura 4 s, u 8 s si trae «Deshacer», y se pausa con el dedo, el puntero o el foco
  encima. Mientras se ve, la pantalla deja 104 px abajo para que nada quede tapado.
- **Anunciador de la alarma** (`#anuncio`, `role="alert"`): se escribe **una vez** por alarma y
  una vez en el recordatorio de 2 min. Los minutos que cambian no se anuncian, para no hablar sin
  parar.
- **Diálogos:** un solo `<dialog>`; su contenido sale de `DIALOGOS[tipo]` según `S.dlg`. Esc,
  «Cancelar» o tocar fuera limpian `S.dlg`, para que `pintar()` no lo vuelva a abrir. Al cerrar, el
  foco vuelve al botón que lo abrió.

### 3.8 Acciones

Un solo manejador de clics lee los atributos `data-*` (`data-marcar="sofia,tomas:entregado"`,
`data-mover="manana:isidora:-1"`, etc.) y llama a `accion()`. Esa función cambia `S`; si devuelve
`false` (por ejemplo, un error de formulario), no se redibuja. Los interruptores van por el evento
`change`. «Marcar» ignora un segundo toque durante 450 ms, porque la tarjeta siguiente sube justo
debajo del dedo.

---

## 4. Lo que verifiqué (y cómo)

- **Funciones:** guion `pruebas/funciones.mjs` (Playwright + Chromium, 390 × 844). Son **83
  comprobaciones del inventario y de las mejoras**, todas en verde y sin errores en la consola. Por
  ejemplo: crear, validar y eliminar ruta; ↑ ↓ con el foco quieto; quitar y deshacer; responder;
  hoja «Comenzar»; toque de 300 ms; deshacer y corregir; llegada sin confirmar; alarma; «Ver dónde
  viene»; privacidad del mapa; interruptores; minutos; pagos conectados; modo Familias con
  respuesta simulada sin borrar lo escrito.
- **Contraste:** guion `pruebas/contraste.mjs`. Mide los colores **reales de la página** en 19
  pantallas, el toast y un diálogo, en claro y oscuro: **960 textos, todos ≥ 4,5:1** (o ≥ 3:1 si
  son grandes).
- **Ancho:** sin desplazamiento horizontal a 320, 360, 390 y 430 px.
- **Escritorio:** 1280 × 800. **Celular acostado:** 844 × 390, con la barra visible.
- **Zonas táctiles:** todos los botones visibles miden ≥ 44 px en Hoy y en el detalle de ruta.
- **Capturas:** `pruebas/*.png`.
- Los guiones usan rutas de esta sesión (Chromium en `/opt/pw-browsers`); para correrlos en otro equipo hay que ajustar la ruta del archivo y del navegador al inicio.

## 5. Lo que NO pude verificar o queda como hipótesis

- **iPhone real (Safari):** no tengo uno. Probé solo en Chromium. Puntos a mirar: el `<dialog>`, la
  clase `.presionado` al tocar y `100dvh`.
- **Lector de pantalla real** (VoiceOver o TalkBack): revisé el marcado (roles, nombres, regiones
  vivas), pero no lo escuché.
- **Vibración:** solo funciona en Chrome Android; en iPhone no existe. No la probé en un teléfono.
- **Al sol:** el contraste está calculado, no medido en exterior.
- **Que sea «más fácil» y «más cálido»** es hipótesis hasta probarlo con personas reales: 3 tías y
  2 apoderados, con las tareas «iniciar y marcar», «confirmar alarma» y «cambiar minutos».
- **Ley 21.377:** la prohibición de manipular el celular al conducir está confirmada (fuentes en
  `04e-auditoria.md`). Si tocar «Subió» detenido con el motor encendido es infracción, lo debe ver
  un abogado.
- **Fuentes de las afirmaciones:** el proxy de esta sesión bloqueó varias páginas originales (w3.org,
  nngroup.com, material.io), así que se confirmaron por buscador. Está marcado en cada documento.
- **Hora de la «próxima ruta»:** se calcula con la hora de tu celular, no con la de Chile. En la app
  real debe salir de `hoy_empresa()`.

---

## 6. Lista de aceptación (para probar a mano, sin leer código)

Abre el archivo en el celular. Marca cada punto.

**Tía**
1. [ ] Al abrir, ves «Hola, Tía» y, sin desplazar, el botón amarillo «Iniciar …».
2. [ ] «Calcular la mejor ruta» → aparece la propuesta → «Aplicar» → «Volver al orden anterior».
3. [ ] Cierra el consejo del GPS y «Se sumaron…» con la ✕. En Más → «Volver a mostrar los avisos».
4. [ ] Toca «Iniciar Mañana» → se abre la hoja «¿Lista para la Mañana?» → «Comenzar recorrido».
5. [ ] El furgón se desliza suave por el mapa (no salta).
6. [ ] Mantén el dedo apretado un momento en «Subieron los 2» → se marcan los dos.
7. [ ] Aparece «Sofía y Tomás: subieron. Deshacer» → toca «Deshacer» → vuelven a estar pendientes.
8. [ ] Marca a Benjamín «No estaba» y luego corrígelo a «Subió» en «Atendidos».
9. [ ] Toca «Terminar recorrido» con alguien pendiente → pregunta «Queda 1 sin marcar» → «Seguir el recorrido».
10. [ ] Espera a que el furgón pase por la casa de Isidora sin marcarla → dice «Pasó el furgón · sin confirmar».
11. [ ] Rutas → «Nueva ruta» → Crear sin nombre → error bajo el campo. Hora «7.30» → error «Escribe la hora así: 07:30».
12. [ ] En una ruta: ↑ y ↓ mueven al niño (se ve deslizarse); la ✕ lo quita con «Deshacer».
13. [ ] «Eliminar ruta» → «Cancelar» está elegido de entrada; la tecla Esc o tocar fuera cierran.
14. [ ] Mensajes: «Recibido, gracias» llena la respuesta → «Enviar respuesta».
15. [ ] Más → Cobros, Licencia, Familias por conectar (Aceptar / Rechazar con Deshacer), Apariencia, Salir.
16. [ ] Más → Mi perfil: cambia la foto desde la galería (aparece al tiro, con Deshacer) y guarda el nombre.

**Familia**
17. [ ] Con un recorrido en curso, aparece la alarma amarilla: la campana se mueve 3 veces y se queda quieta.
18. [ ] «Ver dónde viene» abre el mapa: solo tu casa, el colegio y el furgón; la alarma no vuelve.
19. [ ] El furgón desaparece un momento al pasar cerca de la casa de otro niño, con la nota de privacidad.
20. [ ] Apaga «Va en la tarde» de Tomás → dice «No va» y en la tía aparece como «Hoy no va (avisó la familia)».
21. [ ] «Aviso: 5 min antes» → elige 10 → los dos hijos quedan con 10.
22. [ ] Pagos → «Avisar que pagué» → «Me equivoqué» lo revierte. Avisa de nuevo → en la tía, Cobros → «Confirmar pago» → en la familia sale «Pagado».
23. [ ] Mensajes → enviar vacío muestra el error; con texto aparece en la conversación.
24. [ ] Más → Mi furgón muestra las iniciales reales de la tía; Compartir muestra FAM-7K2Q.

**Las dos**
25. [ ] Más → Apariencia → Oscuro y Claro cambian toda la app; Automático sigue al celular.
26. [ ] Abre `…html#familias`: no hay selector de rol; «Simular que la tía inicia la ruta» funciona; el mensaje recibe «(respuesta simulada)» a los 4 s sin borrar lo que estés escribiendo.
27. [ ] Con «Reducir movimiento» activado en el celular, solo hay fundidos cortos (el furgón sigue moviéndose).
28. [ ] Gira el celular: la barra inferior sigue visible.

---

## 7. Sugerencias (no aplicadas; esperan tu aprobación)

1. **Llevar esto a la app real** (`apps/movil`): la paleta y la regla de «firma + parche» son las más
   valiosas. Requiere copiar los colores a `diseno/colores.ts` y los 3 íconos nuevos (`vuelta`,
   `sumar`, `en_vivo`) a `diseno/iconos.ts`, y traducir los textos nuevos en `idiomas/en/`.
2. **Bienvenida de 3 pantallas** para familias nuevas: qué es la alarma, «Hoy no va» y el permiso
   de notificaciones.
3. **Pantallas de carga y error** (ya diseñadas en `04c-ux.md` §4) para cuando haya red real.
4. **Arrastrar la hoja hacia abajo para cerrarla** y animación de salida de las tarjetas: se
   dejaron fuera por costo y beneficio.
5. **Ilustraciones más grandes** en los estados vacíos (furgón estacionado, todos listos), hechas
   con piezas de los íconos.
6. **Prueba con 5 personas reales** antes de pasar a la app: es la única forma de confirmar las
   hipótesis.
7. **Interruptor «Vibrar»** en Apariencia, para quien no quiera vibración.
