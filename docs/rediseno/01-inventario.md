# Rediseño de la app web de prueba — Etapa 1: inventario (el contrato)

Archivos originales (respaldo intacto, mismo hash que los subidos):

- `original/Furgon_Escolar_App.html` — app con selector «Ver como tía / Ver como familia».
- `original/Furgon_Escolar_Familias.html` — la misma app fija en el rol familia.

Todo lo de esta lista tiene que seguir funcionando después del rediseño. Cada punto tiene un código
(F-xx) para poder marcarlo en la verificación (etapa 6).

## 0. Diferencias entre los dos archivos

Comparten el 98 % del código. El de Familias cambia solo esto:

| | App | Familias |
|---|---|---|
| Título | «Furgón Escolar App» | «Furgón Escolar Familias» |
| Selector de rol | visible | oculto (`class="rol oculto"`), arranca como familia |
| Nota bajo el selector | «Versión web de prueba… lo ve la familia» | «App para mamás y papás · versión de prueba» |
| En celular | el teléfono mide `100vh − 53px` (deja lugar al selector) | `100vh` |
| Inicio de familia sin recorrido | — | aviso + botón «▶ Simular que la tía inicia la ruta de la mañana» (`data-iniciar-demo`) |
| Al iniciar | siempre lleva a la tía a «recorrido» | solo si el rol es tía |
| Mensaje de la familia | queda sin respuesta (la responde la tía a mano) | la «tía» responde sola a los 4 s: «¡Recibido! Gracias por avisar 😊» |

## 1. Estructura y técnica

- Un solo HTML: CSS en `<style>` y JS en `<script>`. Lo único externo es Google Fonts (Inter y
  JetBrains Mono); si no carga, usa las fuentes del sistema.
- Patrón: un objeto de estado `S` y una función `pintar()` que vuelve a generar el HTML de la
  pantalla (`#pantalla`) y de la barra inferior (`#barra`) a partir de `S`. Todos los clics pasan
  por **un solo** manejador (delegación de eventos) que lee atributos `data-*`.
- Íconos: 26 SVG propios en `ICONOS` (con relleno amarillo de acento), dibujados con `ico(nombre)`.
- `esc()` escapa el texto que escribe el usuario antes de insertarlo (evita inyectar HTML).
- Tokens de color en `:root` con modo claro y oscuro (automático, o forzado con `data-theme`).

## 2. Datos de ejemplo (el estado `S`)

- 4 alumnos: Sofía y Tomás Demo (misma casa, familia «familia»), Isidora Rojas y Benjamín Muñoz
  (otras familias). Cada uno con curso, colegio, dirección y coordenadas en el mapa.
- Colegio Demo en (250, 150).
- 2 rutas: «Mañana» (ida, 07:00) y «Tarde» (vuelta, 16:30), cada una con su orden de alumnos.
- `noVa`: qué alumno no viaja hoy, por tramo (ida/vuelta).
- `minutosAviso`: minutos de anticipación de la alarma por hijo (5 por defecto).
- `recorrido`: el recorrido en curso (ruta, avance 0→1, estado de cada alumno, a quién se avisó y
  quién confirmó).
- 1 mensaje de la Familia Rojas sin responder; 3 meses de pagos ($65.000, octubre por pagar).
- Perfiles de tía y familia (nombre, teléfono, correo, foto; la tía además tiene comunas,
  presentación y «visible en la búsqueda»).
- Tema: sistema / claro / oscuro.

## 3. Motor del recorrido (lógica que no se puede romper)

- **F-01 `puntosRuta`**: arma los puntos del trayecto. En la ida: partida (20,180) → casas en el
  orden de la ruta → colegio. En la vuelta: colegio → casas. Salta a quien «no va» y junta a los
  hermanos que viven en la misma casa en una sola parada.
- **F-02 `largo` / `puntoEn`**: largo total de la línea quebrada y la posición del furgón en la
  fracción `f` del recorrido (interpolación lineal por tramos).
- **F-03 `etaMin`**: minutos que faltan para una casa = (distancia acumulada hasta esa casa / largo
  total − avance) × 25 min, redondeado y nunca menor que 0.
- **F-04 `iniciar`**: no deja iniciar una ruta sin alumnos. Marca «no_viaja» o «pendiente» a cada
  uno. Cada 250 ms avanza 0,4 % (el recorrido completo dura ~62 s). Cuando a un pendiente le faltan
  `minutosAviso` o menos, lo marca «avisado». Al llegar (0 min) lo marca «entregado».
- **F-05 `terminar`**: detiene el temporizador, borra el recorrido y vuelve al inicio con el
  mensaje «Recorrido terminado. ¡Buen trabajo!».
- **F-06 Redibujo en vivo**: mientras el furgón avanza solo se redibujan las pantallas que lo
  muestran (tía: inicio y recorrido; familia: inicio y seguir), y no se redibuja si el cursor está
  en un campo de texto (para no borrar lo que se escribe). Se mantiene el desplazamiento si es la
  misma pantalla y se vuelve arriba si es una pantalla nueva.
- **F-07 Mapa SVG** (300×200): calles en cuadrícula, línea punteada del trayecto (solo la tía), casas
  numeradas (verdes cuando ya se atendieron), colegio «C» amarillo y furgón dibujado.
  **Privacidad:** la familia no ve la línea ni las casas de otros niños, solo la suya (⌂).
- **F-08 `recomendar` («Calcular la mejor ruta»)**: ordena por vecino más cercano partiendo de la
  partida (ida) o del colegio (vuelta). Calcula los km (unidades del mapa ÷ 40) del orden nuevo y
  del actual. Muestra «ya es el más corto» o la propuesta con el ahorro, y los botones Aplicar /
  Descartar.

## 4. Rol tía

**Barra inferior:** Inicio · Alumnos · Rutas · Mensajes. Mensajes lleva un punto rojo si hay
mensajes sin responder. La barra se oculta durante el recorrido.

- **F-10 Inicio**: saludo «Hola, Tía», avatar (va a Mi perfil) y menú ⋮.
  - F-11 Aviso de consejos (iniciar antes de partir; el celular es el GPS), con botón para cerrarlo.
  - F-12 Tarjeta «🆕 Se sumaron a tus rutas» (Isidora en ida parada 4 y vuelta parada 1), con botón
    para cerrarla.
  - F-13 Mensaje de éxito después de aplicar una ruta recomendada.
  - F-14 Una tarjeta por ruta: tipo y hora, «A buscar/A dejar hoy (n)», lista numerada (tachada si
    no viaja), enlace «Ver la ruta en Google Maps», «Calcular la mejor ruta» (si tiene 2 o más
    alumnos y no está en curso). Botón «Iniciar recorrido», desactivado si ya hay otro en curso, o
    «Continuar recorrido en curso» si es la ruta activa.
- **F-20 Recorrido en curso**: título con la ruta, chip «● En curso», mapa en vivo, nota de minutos.
  Una tarjeta por pendiente: dirección, chip «🔔 Apoderado avisado / Aún sin aviso», chip «~n min»,
  botones «Subió / En su hogar» y «Ausente». Lista de «Atendidos» con su estado (Subió ✅, En su
  hogar ✅, Ausente, Hoy no viaja). Botones «Terminar recorrido» y «Volver al inicio (el recorrido
  sigue)».
- **F-30 Alumnos**: contador, una tarjeta por alumno (curso, colegio, dirección, chip «Familia con
  / sin la app», chip «Hoy no viaja»), «+ Registrar alumno» (mensaje explicativo).
- **F-40 Rutas**: explicación, «+ Nueva ruta» abre un formulario con nombre, tipo Ida/Vuelta
  (botones de segmento) y hora opcional validada `HH:MM`. Valida: nombre obligatorio y hora con el
  formato «07:30». Por cada ruta: Iniciar, Calcular la mejor ruta, y para cada alumno ↑ / ↓ (los
  extremos desactivados), ✕ quitar y «Hoy no va» (alterna). «+ nombre» para agregar a los que no
  están. «Eliminar ruta» pide confirmación en un diálogo («Los alumnos siguen registrados…»).
- **F-50 Mensajes**: una tarjeta por mensaje (amarilla si falta responder), campo «Responder» y
  «Enviar respuesta» (no deja enviar vacío). Ya respondido: «Tu respuesta: …».
- **F-60 Menú ⋮** (hoja sobre la pantalla; se cierra al tocar fuera): Mi perfil · Cobros · Familias
  por conectar (1) · Mi licencia · «Volver a mostrar los avisos» (si cerró alguno) · Apariencia
  (Automático/Claro/Oscuro) · Salir (mensaje) · Cerrar.
- **F-61 Cobros**: $130.000 por cobrar, 1 vencido; 3 familias con monto y estado Por pagar /
  Pagado / Vencido.
- **F-62 Mi licencia**: Clase A3, vigente hasta 12-10-2028, «Subir foto nueva» (mensaje).
- **F-63 Familias por conectar**: Familia Pérez, botones Aceptar / Rechazar (mensaje).

## 5. Rol familia

**Barra inferior:** Inicio · Pagos · Mensajes · Familia · Mi furgón. Se oculta en «Furgón en vivo».

- **F-70 Inicio**: saludo, avatar y «Salir».
  - F-71 **Alarma** amarilla que late: «🔔 El furgón llega en ~n min a buscar a X», con el botón
    «Recibido, estoy atento/a» (la marca como confirmada y desaparece).
  - F-72 Una tarjeta por hijo: colegio. Si hay recorrido: estado (Subió ✅ / En su hogar ✅ / Hoy no
    viaja / Marcado ausente / 🔔 Llega en ~n min / «Te avisaremos…») y «Seguir el furgón en vivo».
  - F-73 Interruptores «Hoy no viaja» para Ida (mañana) y Vuelta (tarde), con mensaje de
    confirmación.
  - F-74 «Aviso n min antes · cambiar»: va rotando entre 3 → 5 → 7 → 10 → 15.
  - F-75 Selector de apariencia al final.
  - F-76 *(solo Familias)* «▶ Simular que la tía inicia la ruta de la mañana».
- **F-80 Furgón en vivo**: mapa privado y «Llega en ~n min», o «Tus hijos ya subieron ✅».
- **F-81 Pagos**: 3 meses, «Avisar que pagué» en los pendientes (pasa a Pagado).
- **F-82 Mensajes**: «Escríbele a la tía» + Enviar (no deja enviar vacío); historial con
  «Esperando respuesta…» o la respuesta. *(Familias: respuesta automática a los 4 s.)*
- **F-83 Familia**: código para compartir FAM-7K2Q.
- **F-84 Mi furgón**: foto/iniciales, nombre, comunas y presentación de la tía, chip «Conectada».

## 6. Compartido

- **F-90 Mi perfil** (tía y familia): avatar grande, «Tomar foto» (cámara) y «Galería» (lee la imagen
  con `FileReader`), «Quitar foto», nombre (mínimo 2 letras), teléfono, correo (solo lectura).
  La tía además tiene el interruptor «Que las familias me encuentren», comunas y presentación
  (máx. 300). Guardar.
- **F-91 Mensajes emergentes** (*toast*: aviso breve que aparece y se va solo) de 2,6 s para
  confirmar cada acción.
- **F-92 Tema**: Automático (sigue al sistema), Claro, Oscuro.
- **F-93 Cambio de rol** (solo App): los botones de arriba cambian de tía a familia sin perder el
  estado; lo que hace la tía lo ve la familia (recorrido, «no va», mensajes).
- **F-94 Responsivo**: en pantallas de 480 px o menos el «teléfono» ocupa toda la pantalla.

## 7. Defectos que ya vi al leer (no los arreglo aún; van al diagnóstico de la etapa 3)

Los anoto para que no se confundan con funciones que hay que conservar:

1. Durante el recorrido la pantalla se redibuja 4 veces por segundo: **se pierde el foco del
   teclado** y un lector de pantalla se reinicia. Grave para accesibilidad.
2. Al elegir una foto dice «Toca Guardar para dejarla», pero ya quedó puesta sin guardar.
3. «Mi furgón» muestra siempre «TD» en vez de las iniciales reales de la tía.
4. «Ver la ruta en Google Maps» siempre abre «Ñuñoa, Santiago», no la ruta real.
5. La nota del recorrido usa los minutos de aviso de Sofía para todas las familias.
6. Si la familia marca «Hoy no viaja» con el recorrido ya en curso, el furgón se salta esa casa,
   pero en la lista de la tía el niño sigue «pendiente» para siempre (nunca pasa a «no viaja»).
7. Los diálogos no se cierran con Esc y el foco no queda dentro de ellos; la barra usa
   `role="tablist"` sin paneles asociados.
8. Las ✕ para cerrar avisos miden 28 px (el mínimo cómodo es 44 px).
9. Se mezclan emojis (🌅 🏠 🔔 ✅ 🆕 ✨ 👍) con los íconos propios: dos estilos visuales a la vez.
