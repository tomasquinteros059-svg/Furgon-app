# Etapa 4 — Propuesta final (resumen de los 5 especialistas)

Detalle y fuentes en: `04a-color.md` · `04b-identidad.md` · `04c-ux.md` · `04d-movimiento.md` ·
`04e-auditoria.md` (revisión adversarial; sus soluciones H1–H41 y X1–X17 mandan cuando hay
contradicción).

## 1. Color (04a)

- **Amarillo `#F5B700` se queda** (marca e íconos). Sobre blanco mide 1,80:1, así que **nunca es
  texto ni la única señal**; para eso hay `--amarilloTexto` / `--amarilloBorde` `#7A5800` (6,51:1).
- Neutros cálidos (fondo `#FBFAF7`, texto `#1C1A16`); oscuro casi negro cálido `#121110`.
- Verde azulado `#0A6C4C` y rojo `#C0261D` (texto blanco ≥ 5,9:1); en oscuro el texto sobre ellos
  es oscuro. Nuevo naranjo tostado `--alerta` para advertencias.
- Foco del teclado **marino** en claro, amarillo en oscuro (hoy el amarillo en claro mide 1,80:1).
- Mapa: **el furgón es lo único amarillo**; el colegio pasa a cuadrado color tinta; casa lista = ✓.
- Hoy fallan 19 de 40 pares medidos; con la paleta nueva pasan todos los exigidos por WCAG AA.
- Daltonismo: verde/rojo/alerta se confunden en simulación → **todo estado lleva ícono + palabra**.
- *Descartado:* oscurecer el amarillo hasta 3:1 (queda café mostaza y se pierde la marca).

## 2. Identidad (04b) — recomendada la dirección A «Trazo y relleno»

- La interfaz se dibuja como tus íconos: borde de 2 px, relleno amarillo, esquinas redondas
  (tarjetas 22 px, alarma y hojas 28 px, botones píldora), **sombra de sello** sólida y corta.
- Letras: **Fredoka 600** (títulos, botones, números grandes) + **Atkinson Hyperlegible Next**
  400/700 (todo lo que se lee). ≈ 50 KB, verificadas en Google Fonts con todos los caracteres del
  español.
- Cero emojis en la interfaz: se cambian por íconos propios (7 ya existen en `diseno/iconos.ts` y
  se copian; 3 nuevos: `vuelta`, `sumar`, `en_vivo`).
- Textos en tono de la tía: «Recibido, te espero», «4 min · La tía llega por Sofía».
- *Descartada:* dirección B «Señalética de camino» (letrero vial: se siente urgente y fría —
  hipótesis— y su fuente pesa 77 KB).

## 3. Flujos (04c)

- **Barras:** tía «Hoy · Rutas · Alumnos · Mensajes · Más»; familia «Hoy · Mensajes · Pagos · Más».
  El menú ⋮ escondido pasa a la pestaña visible «Más».
- **Hoy (tía):** arriba siempre la próxima ruta con su botón «Iniciar». Antes de partir, una hoja
  corta «Comenzar» (quiénes van, celular con batería y GPS).
- **Recorrido:** una parada a la vez, botones de 56 px «Subió» / «No estaba», hermanos con
  «Subieron los 2», **Deshacer** y lista de atendidos corregible. «Terminar» pide confirmación si
  quedan niños sin marcar.
- **Rutas:** lista → una ruta por pantalla (↑ ↓, quitar con Deshacer, eliminar con confirmación).
- **Familia:** alarma con «Ver dónde viene» y «Recibido, te espero»; «Va en la mañana / tarde» en
  positivo (sin doble negación); minutos de aviso en una hoja con las 5 opciones; «Avisaste el
  pago · Me equivoqué».
- Estados vacíos con guía en cada pantalla. Errores de formulario bajo el campo, no en un toast.
- *Descartado:* botones de 76 px (esa medida de Google es para tocar manejando, lo que la Ley
  21.377 prohíbe); pantalla «¿Quién eres?» al entrar.

## 4. Movimiento (04d)

- **Arreglo de fondo:** durante el recorrido ya no se redibuja todo 4 veces por segundo; solo se
  actualizan los minutos y el furgón («firma + parche»). Arregla los toques perdidos y el foco.
- **El furgón se desliza suave** (interpolación con `requestAnimationFrame`) en vez de saltar.
- La alarma entra con movimiento, la campana se mueve 3 veces (< 5 s) y queda quieta. **Ninguna
  animación infinita decorativa** (WCAG 2.2.2).
- Botón al tocar: se hunde como tecla. Interruptores y reordenar se deslizan. Toast fijo con región
  viva, 4 s (8 s con Deshacer).
- `<dialog>` nativo para confirmaciones y hojas (Esc, foco dentro, fondo inerte).
- Vibración solo en Android (iPhone no la soporta), nunca como único aviso.
- Con «reducir movimiento»: solo fundidos cortos; el furgón sigue moviéndose (es información).
- *Descartado:* View Transitions (bloquea toques mientras anima y cada tick la cancelaría).

## 5. Auditoría (04e) — lo que se corrige antes de implementar

- **Deshacer** necesita recordar qué marcó la tía a mano; si no, el motor vuelve a marcar «Subió»
  solo (y un «Ausente» deshecho terminaría diciendo «Subió»).
- La alarma se anuncia **una vez** por un anunciador fijo fuera de la pantalla.
- El foco vuelve al mismo control después de **cada** toque, no solo en el recorrido.
- `lang="es-CL"`, celular acostado, barra de 5 pestañas en 320 px, foco visible dentro del toast y
  de la alarma.
- **Alcance:** fuera de la primera versión el gesto de arrastrar hojas, los «fantasmas» completos y
  las pantallas de carga/error (se dejan diseñadas, no implementadas).
