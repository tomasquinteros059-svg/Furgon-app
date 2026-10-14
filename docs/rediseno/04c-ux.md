# Rediseño — Etapa 4c: experiencia de uso (UX) y usabilidad

Autor: experto/a en UX del equipo de rediseño · 14-10-2026
Base: `original/Furgon_Escolar_App.html` (y su diferencia con `Furgon_Escolar_Familias.html`),
`01-inventario.md` (contrato F-xx) y `CLAUDE.md`.
Decisiones del dueño que respeto: **un solo archivo** (Familias es un modo), **celular primero**,
**tono cálido**.

> **Cómo leer este documento.** Cada afirmación lleva una de tres marcas:
> **[Fuente X]** (ver lista de fuentes al final), **[Medición propia]** (lo medí abriendo la maqueta
> en un navegador de 390 × 844 px, el tamaño de un iPhone 14) o **[Hipótesis mía]** (opinión
> profesional que no comprobé con usuarios reales). Donde no sé, lo digo.
>
> Capturas de la recorrida: `/tmp/claude-0/-home-user-Furgon-app/765692c3-8806-5aa3-8913-dc6933ff6dd8/scratchpad/ux/`
> (01 a 15; son temporales, no forman parte del repositorio).

---

## 0. Resumen en 10 puntos

1. **Hallazgo más grave [Medición propia]:** durante el recorrido la pantalla se redibuja cada
   250 ms y **los toques se pierden**. Si el dedo se queda apoyado más de ~¼ de segundo, el botón
   «Subió» o «Recibido, estoy atento/a» no responde. Medí cuántas veces funcionó un toque según su
   duración: 50 ms → 9 de 12; 100 ms → 6 de 12; 150 ms → 3 de 12; 200 ms → 0 de 12; 300 ms → 0 de 12.
   Esto agrava el defecto 1 del inventario (no es solo un problema de teclado: afecta a todos).
2. **«Terminar recorrido» borra todo con un solo toque**, sin confirmar ni deshacer, y está pegado
   a la lista de niños (botón rojo de 46 px). **«Ausente» tampoco se puede corregir**.
3. La tía tiene que **desplazar la pantalla para llegar a «Iniciar recorrido»** (está a 968 px de
   la parte de arriba; la pantalla visible mide 727 px) porque arriba hay dos avisos [Medición propia].
4. En el recorrido, **cuando un niño cambia de estado la lista sube** y el botón que estaba bajo el
   dedo pasa a ser el del niño siguiente: riesgo de marcar «Ausente» al niño equivocado [Medición
   propia de posiciones; el riesgo de error es Hipótesis mía].
5. La demo marca sola «Subió ✅» cuando el furgón llega a la casa (F-04). La familia lee «Subió al
   furgón ✅» **aunque nadie lo confirmó**. En una app de niños eso es una mala idea; propongo
   separar «El furgón llegó» de «Subió» (decisión del dueño, ver §5.1).
6. Ley chilena: la Ley 21.377 («Ley No Chat») prohíbe manipular el celular al conducir, incluso
   detenido en un semáforo [Fuente NoChat]. **El diseño no puede suponer que la tía toca la pantalla
   manejando.** Propongo que el recorrido funcione casi sin tocar (§5).
7. Familia: lo primero que ve con recorrido es la alarma (bien). Pero «Seguir el furgón en vivo»
   está dentro de la tarjeta de cada hijo, a veces bajo el borde. Propongo poner «Ver dónde viene»
   **dentro de la misma alarma** (2 toques → 1).
8. Barra de la familia con 5 pestañas, dos de muy poco uso («Familia» = un código, «Mi furgón» =
   ficha fija). Propongo 4: **Hoy · Mensajes · Pagos · Más**. Tía: **Hoy · Rutas · Alumnos ·
   Mensajes · Más** (el menú ⋮ escondido pasa a una pestaña visible con nombre) [Fuente NNg-hamb].
9. «Aviso 5 min antes · cambiar» va rotando 3→5→7→10→15: para pasar de 5 a 3 hay que tocar 4 veces
   y no se ven las opciones. Propongo una hoja con las 5 opciones (siempre 2 toques).
10. Todo lo del inventario (F-01 a F-94) tiene lugar en el diseño nuevo: tabla en §8.

---

## 1. Lo que medí al recorrer la maqueta [Medición propia]

Navegador Chromium sin la fuente Inter (para ver el peor caso), ventana 390 × 844, modo «App».

| Medición | Valor | Comentario |
|---|---|---|
| Alto visible de la pantalla de la app (con el selector de rol arriba y la barra abajo) | 727 px | En el recorrido, sin barra: 791 px |
| Alto total de «Inicio» de la tía | 1 575 px | Más de 2 pantallas |
| Posición del primer «Iniciar recorrido» | 968 px desde arriba | Queda fuera de la vista: hay que desplazar |
| Alto total de «Recorrido en curso» (4 niños) | 1 160 px | «Terminar recorrido» a 1 088 px, fuera de la vista |
| Botones «Subió / Ausente» | 160 × 46 px cada uno, separados 8 px | Pasan el mínimo de 44 px, pero lejos de los 76 px que Google pide para pantallas de auto [Fuente Cars] |
| Botón ✕ para cerrar avisos | 28 × 28 px | Bajo los 44 px recomendados [Fuente WCAG-258] (defecto 8 del inventario) |
| Botón ⋮ del menú de la tía | 42 × 26 px, sin texto | Difícil de ver y de tocar |
| Interruptores «Hoy no viaja» | 46 × 28 px | Pasan el mínimo AA de 24 px; el alto queda bajo 44 px |
| «Aviso 5 min antes · cambiar» | 36 px de alto | Botón de texto |
| Toques que funcionan en el recorrido según duración del toque | 50 ms: 9/12 · 100 ms: 6/12 · 150 ms: 3/12 · 200 ms: 0/12 | Ver §0.1. Control: el mismo toque de 200 ms en una pantalla quieta (Rutas) funcionó 15 de 15 |
| Foco del teclado tras 0,6 s en el recorrido | Se pierde (vuelve al documento) | Confirma el defecto 1 |
| Mensaje emergente (toast) | Tapa los botones de abajo (captura 12: tapa el ↑ ↓ ✕ de Isidora) | Dura 2,6 s |

No sé cuánto dura un toque típico de una persona; no encontré una cifra confiable. Lo que sí
muestra la medición es que **cualquier toque que dure más de 250 ms falla siempre**, y uno de
100 ms falla la mitad de las veces. Un toque firme o con el vehículo vibrando dura más
[Hipótesis mía].

---

## 2. Mapa de flujos actuales con conteo de toques

Cuento **toques** (tocar algo) y **desplazamientos** (arrastrar la pantalla para ver más). No cuento
escribir texto. Datos de ejemplo: ruta «Mañana» con Sofía y Tomás (misma casa), Benjamín e Isidora.

### 2.1 Tía

```
Inicio ──(desplazar)── Tarjeta «Mañana» ── [Iniciar recorrido] ──► Recorrido en curso
  │                                                                   │  tarjeta por niño: [Subió] [Ausente]
  ├─ ⋮ ─► hoja: Mi perfil · Cobros · Familias por conectar · Licencia │  (desplazar) Atendidos
  │        · Volver a mostrar avisos · Apariencia · Salir · Cerrar    │  (desplazar) [Terminar recorrido] ─► Inicio
  ├─ avatar ─► Mi perfil                                              └─ [Volver al inicio (el recorrido sigue)]
  ├─ [Calcular la mejor ruta] ─► propuesta ─► [Aplicar]/[Descartar]
Barra: Inicio · Alumnos · Rutas · Mensajes (la barra se oculta durante el recorrido)
```

| Tarea | Pasos actuales | Toques | Desplaz. |
|---|---|---|---|
| **T1. Iniciar recorrido y marcar a cada niño** (4 niños, 3 casas) | Desplazar hasta «Iniciar» → Iniciar → Subió ×4 (uno por niño, aunque Sofía y Tomás vivan juntos) → desplazar → Terminar | **6** | **≥2** |
| **T2. Reordenar ruta a mano** (subir a Isidora del 4.º al 1.º) | Rutas → desplazar → ↑ ×3 | **4** | 1 |
| T2b. Reordenar con «Calcular la mejor ruta» | (Inicio) Calcular → Aplicar | **2** | 1 |
| **T3. Responder un mensaje** | Mensajes → tocar el campo → escribir → Enviar respuesta | **3** + texto | 0 |
| T4. Terminar un recorrido por error | Terminar recorrido | **1** (sin vuelta atrás) | — |

### 2.2 Familia

```
Inicio: [alarma amarilla: Recibido, estoy atento/a]
        tarjeta por hijo: estado · [Seguir el furgón en vivo] · interruptores Ida/Vuelta · [Aviso n min · cambiar]
        selector de apariencia al final
   └─ [Seguir el furgón en vivo] ─► Furgón en vivo (sin barra) ─► [Volver]
Barra: Inicio · Pagos · Mensajes · Familia · Mi furgón ; avatar ─► Mi perfil ; [Salir] arriba a la derecha
```

| Tarea | Pasos actuales | Toques | Desplaz. |
|---|---|---|---|
| **F1. Marcar «Hoy no va»** (un hijo, un tramo) | Interruptor | **1** | 0–1 (el 2.º hijo está más abajo) |
| F1b. Los dos hijos, ida y vuelta | 4 interruptores | **4** | 1 |
| **F2. Confirmar alarma y ver el furgón** | Recibido → Seguir el furgón en vivo | **2** | 0–1 |
| **F3. Avisar un pago** | Pagos → Avisar que pagué | **2** (sin deshacer) | 0 |
| **F4. Cambiar minutos de aviso** | Tocar «cambiar» hasta llegar: 5→10 = 2 toques; 5→3 = **4 toques**; por cada hijo | **1–4** | 0–1 |
| **F5. Editar perfil / foto** | Avatar → Galería → (selector del sistema) → desplazar → Guardar | **3** + sistema | 1 |
| F5b. Lo mismo para la tía | Avatar (o ⋮ → Mi perfil) → Galería → (sistema) → desplazar → Guardar | **3–4** + sistema | 1–2 |

---

## 3. Fricciones concretas y propuesta

Formato: **qué pasa** (texto o elemento real) → **por qué molesta** → **propuesta**.

### 3.1 Tía — Inicio

| # | Qué pasa | Por qué | Propuesta |
|---|---|---|---|
| T-a | El aviso «Inicia el recorrido antes de partir… Tu celular es el GPS del furgón…» y la tarjeta «🆕 Se sumaron a tus rutas» van **antes** de las rutas y empujan «Iniciar recorrido» fuera de la vista | La acción principal del día queda escondida bajo información secundaria [Medición propia] | Arriba, siempre: **la próxima ruta del día** con su botón grande «Iniciar la Mañana · 07:00». Debajo, las novedades. El consejo del GPS pasa a la hoja previa al inicio (§5.2) |
| T-b | Se muestran **las dos rutas completas** con todos los alumnos y direcciones | A las 6:50 la tía necesita una ruta, no dos [Hipótesis mía] | La ruta que toca según la hora va abierta; la otra, cerrada en una línea («Tarde · 16:30 · 4 niños ›») |
| T-c | «Iniciar recorrido» de la otra ruta aparece **desactivado sin explicación** cuando hay uno en curso | Botón gris sin razón: no se sabe qué hacer | Texto debajo: «Termina la Mañana para iniciar esta» |
| T-d | «Ver la ruta en Google Maps» siempre abre «Ñuñoa, Santiago» (defecto 4) | Promete algo que no hace | Que abra la ruta real con paradas; si no se puede, que diga «Abrir Ñuñoa en Google Maps» (no prometer más) |
| T-e | «Calcular la mejor ruta» vive en Inicio, en la tarjeta de cada ruta | Es planificación, no tarea del día; agranda la tarjeta | Se calcula solo; si hay ahorro, aparece una **sugerencia** en Hoy: «Puedes ahorrar 1,2 km en la Mañana · Ver». El botón completo queda en el detalle de la ruta |
| T-f | El menú ⋮ (42 × 26 px, sin texto) esconde Cobros, Licencia, Familias por conectar (1) | La navegación escondida se descubre casi la mitad de las veces que la visible [Fuente NNg-hamb] | Pestaña «Más» con nombre y punto rojo si hay una familia por conectar |
| T-g | Emojis mezclados con íconos (🆕, 🌅, 🏠, ✨, 👍) (defecto 9) | Dos estilos | Solo los íconos propios |
| T-h | ✕ de 28 px (defecto 8) | Bajo 44 px [Fuente WCAG-258] | Área de toque de 44 × 44 px (el dibujo puede seguir chico) |

### 3.2 Tía — Recorrido en curso (el momento crítico)

| # | Qué pasa | Por qué | Propuesta |
|---|---|---|---|
| R-a | Redibujo cada 250 ms: **los toques se pierden** y el foco se va | §0.1 [Medición propia] | Requisito técnico n.º 1: actualizar solo los números y el furgón del mapa, **sin reemplazar los botones**. No es opcional |
| R-b | Una tarjeta por niño, todas iguales, en una lista de 1 160 px | Para saber a quién le toca hay que leer nombres y minutos | **«Próxima parada»** en grande: dirección, nombre(s), minutos y estado del aviso. El resto, en una lista corta debajo («Después: Benjamín · Isidora») |
| R-c | Sofía y Tomás (misma casa) son dos tarjetas y dos toques | El motor ya los junta en una parada (F-01); la pantalla no | Una parada = una tarjeta: botón «**Subieron los 2**» y, debajo, cada niño por separado por si uno no está |
| R-d | Cuando un niño cambia de estado (a mano o solo) **la lista sube** y bajo el dedo queda el botón del niño siguiente | Toque en el niño equivocado [Hipótesis mía; posiciones medidas] | La parada atendida no desaparece de golpe: queda 1 s en verde con «✓ Subió · Deshacer» y los botones nuevos aparecen desactivados medio segundo [Hipótesis mía] |
| R-e | «Ausente» se marca con un toque y **no se puede corregir** (la tarjeta pasa a «Atendidos», sin botones) | Error común, sin salida. El heurístico «control y libertad del usuario» pide una salida clara de un estado no deseado [Fuente NNg-10, NNg-h3] | Mensaje «Isidora: no estaba · **Deshacer**» durante 8 s, y en «Atendidos» cada niño se puede tocar para cambiar su estado. **No** pondría confirmación («¿Seguro?») en cada niño: es una acción repetida y NN/g recomienda deshacer en vez de confirmar en esos casos [Fuente NNg-conf] |
| R-f | «Terminar recorrido» (rojo) **sin confirmación**, bajo la lista | Destruye el recorrido de todos con un toque [Fuente NNg-conf: confirmar antes de acciones serias e irreversibles] | Si quedan niños sin marcar: confirmación específica «Quedan 2 niños sin marcar (Benjamín, Isidora). ¿Terminar igual?» con botones «Terminar igual» / «Seguir el recorrido». Si no queda nadie: el botón grande verde «Terminar recorrido» aparece solo, sin confirmación |
| R-g | La nota «Las familias reciben la alarma 5 minutos antes» usa los minutos de Sofía para todos (defecto 5) y además dice «El furgón avanza solo en esta demo» | Dato falso; texto para leer manejando | Quitar del recorrido. El estado de cada familia va en su parada: «Avisada» / «Se le avisa 7 min antes» |
| R-h | Si la familia marca «Hoy no viaja» con el recorrido en curso, el niño queda «pendiente» para siempre en la lista de la tía (defecto 6) | La tía espera a un niño que no viene | Pasa a «Hoy no viaja (avisó la familia)» y la tía lo ve con un aviso breve |
| R-i | Mapa de 300 × 200 arriba; empuja los botones hacia abajo | En el soporte, la tía mira la parada, no el mapa de la demo [Hipótesis mía] | Mapa más bajo (o plegable «Ver mapa»); los botones de marcar van en la mitad de abajo, donde llega el pulgar [Fuente Hoober: 49 % usa el celular con una mano] |
| R-j | Botones de 46 px | Para pantallas usadas manejando Google exige 76 × 76 dp y 23 dp de separación [Fuente Cars] | Botones «Subió / No estaba» de al menos 76 px de alto y 24 px de separación |

### 3.3 Tía — Rutas, Alumnos, Mensajes, Más

| # | Qué pasa | Por qué | Propuesta |
|---|---|---|---|
| Ru-a | Rutas muestra **todas las rutas con todos los controles** (1 517 px): por niño ↑ ↓ ✕ y «Hoy no va» | Mucho para mirar; ✕ está a 8 px de ↓ | Lista de rutas (una línea cada una) → tocar abre **una ruta por pantalla**. Aquí sí ayuda «una cosa por pantalla» |
| Ru-b | ✕ «Quitar» saca a un niño de la ruta **sin confirmar ni deshacer** | Se pierde su lugar en el orden | Mensaje «Isidora salió de la Mañana · Deshacer». El ✕ se aleja de ↑ ↓ (al final de la fila) |
| Ru-c | «Hoy no va» en Rutas duplica el interruptor de la familia | Bien tenerlo (la familia avisa por WhatsApp), pero no se entiende quién lo marcó | Se queda, con la etiqueta «Hoy no va (marcado por ti)» o «(avisó la familia)» |
| Ru-d | Formulario «Nueva ruta» (nombre, Ida/Vuelta, hora) | Son 3 datos cortos | **No lo dividiría** en 3 pantallas: dividir un formulario tan corto agrega toques sin ganar claridad. GOV.UK recomienda partir con «una cosa por página» y juntar donde la investigación lo muestre [Fuente GOVUK]; aquí la juntura es obvia [Hipótesis mía]. Lo saco de la lista y lo pongo en una hoja aparte |
| Ru-e | Error «La hora va como 07:30» sale como toast que se va en 2,6 s | El error desaparece antes de leerlo | Error bajo el campo, en rojo, hasta que se corrija |
| Ru-f | «Eliminar ruta» con diálogo «Los alumnos siguen registrados…» | Bien hecho (acción seria y poco frecuente) | Se mantiene. El botón dice «Eliminar ruta», no «OK» [Fuente NNg-conf] |
| A-a | Alumnos: «+ Registrar alumno» solo muestra un mensaje | Es una demo | Se mantiene; texto: «En la app real lo registras con nombre y dirección exacta» |
| M-a | Mensajes: la tía responde escribiendo siempre | La mayoría de las respuestas son cortas [Hipótesis mía] | Respuestas rápidas: «Recibido 👍», «Sí, sin problema», «Te llamo» (se pueden editar antes de enviar). Sin respuesta pendiente: estado vacío amable |
| M-b | No se ve de qué niño es cada mensaje | «Familia Rojas» no dice si es por Isidora | Mostrar «Familia Rojas · Isidora» |
| Mas-a | Cobros muestra $120.000 «Por pagar» para la Familia Demo, pero la familia ve $65.000 por mes, y su «Avisar que pagué» no cambia Cobros | Los datos no conversan entre roles | En el modo App, que el aviso de pago de la familia aparezca en Cobros («Avisó que pagó · Confirmar») [cambio de demo; decisión del dueño] |

### 3.4 Familia

| # | Qué pasa | Por qué | Propuesta |
|---|---|---|---|
| Fa-a | Alarma «🔔 El furgón llega en ~3 min a buscar a Tomás» con «Recibido, estoy atento/a» | Bien: es lo primero que se ve. Pero para ver dónde viene hay que buscar «Seguir el furgón en vivo» en la tarjeta del hijo | Dentro de la alarma, dos botones: «**Ver dónde viene**» y «Recibido». «Ver dónde viene» también cuenta como recibido (decisión del dueño, §7) |
| Fa-b | La alarma nombra a un solo hijo aunque vayan dos | Si Sofía está ausente y Tomás no, dice «Tomás» (bien); si van los dos, debería decir «Sofía y Tomás» | Juntar nombres de la misma parada |
| Fa-c | Sin recorrido, Inicio muestra tarjetas sin estado y los interruptores | No se sabe qué esperar | Estado vacío: «Hoy: Mañana a las 07:00. Te avisamos 5 min antes de que llegue el furgón.» |
| Fa-d | Interruptores «Hoy no viaja · Ida (mañana) / Vuelta (tarde)»: rojo = no viaja | Doble negación («no viaja» encendido); se pueden mover aunque el niño ya subió | Texto afirmativo en cada fila: «Mañana: **va** / **no va**». Tras subir, la fila de ese tramo queda bloqueada con «Ya subió» |
| Fa-e | «Aviso 5 min antes · cambiar» rota entre valores | 4 toques para bajar de 5 a 3; no se ven las opciones; hay que repetir por hijo | Fila «Aviso: 5 min antes ›» → hoja con 3 · 5 · 7 · 10 · 15 y «Usar para mis 2 hijos» |
| Fa-f | «Salir» arriba, al lado del avatar, en la pantalla principal | Cerrar sesión a un toque desde la pantalla más usada | A «Más» |
| Fa-g | Selector de apariencia al final de Inicio | No es del día a día | A «Más» |
| Fa-h | «Furgón en vivo»: mapa chico, «Llega en ~3 min» en letra normal, «Volver» arriba a la derecha | Lo que importa (minutos) es pequeño; mucho espacio vacío (captura 06) | Minutos en grande arriba («3 min»), mapa más alto, «Volver» abajo o con gesto atrás. Si ya subieron: «Sofía y Tomás ya van en el furgón» |
| Fa-i | «Avisar que pagué» cambia el chip a «**Pagado**» | La familia no puede declarar «Pagado»: lo confirma la tía; y no hay vuelta atrás | Estado «Avisaste el pago · la tía lo confirma» + «Me equivoqué» (deshacer) |
| Fa-j | Mensajes: «Esperando respuesta…» | Bien | Se mantiene; vista tipo conversación (lo último abajo, el campo abajo) |
| Fa-k | «Mi furgón» muestra «TD» siempre (defecto 3) | Dato falso | Iniciales reales |
| Fa-l | Pestañas «Familia» (solo el código FAM-7K2Q) y «Mi furgón» (ficha fija) | Se usan una vez [Hipótesis mía] | A «Más». La tía aparece también en Hoy, en una línea: «Tu furgón: Tía Demo ›» |

### 3.5 Compartido

| # | Qué pasa | Por qué | Propuesta |
|---|---|---|---|
| C-a | Al elegir foto dice «Foto lista. Toca «Guardar» para dejarla» pero ya quedó puesta (defecto 2) | El mensaje miente | La foto se guarda al elegirla: «Foto cambiada · Deshacer». Guardar queda solo para los textos |
| C-b | Toasts de 2,6 s, que tapan botones | Corto para leer; hay discusión sobre si viola WCAG 2.2.1 cuando es la única forma de enterarse [Fuente WCAG-221] | 4 s para avisos, 8 s si tienen «Deshacer», no se van mientras se tocan, y nunca son la única señal (la pantalla también cambia). Se ubican sobre la barra sin tapar la acción principal |
| C-c | Diálogos sin Esc, foco suelto; barra con `role="tablist"` (defecto 7) | Accesibilidad | Ver etapa de accesibilidad; la barra se anuncia como navegación |
| C-d | La alarma «late» sin parar | Bien que respete «reducir movimiento». | Se mantiene |

---

## 4. Estados de cada pantalla (vacío, cargando, error)

La maqueta no tiene red, así que «cargando» y «error» casi no ocurren en ella. Los diseño igual
para que el paso a la app real no los olvide. Los textos vacíos explican por qué está vacío y qué
hacer [Fuente NNg-vacío].

| Pantalla | Vacío | Cargando | Error |
|---|---|---|---|
| Tía · Hoy, sin rutas | «Todavía no tienes rutas. Crea la primera y agrégale tus alumnos.» [Crear ruta] | Tarjetas grises de relleno | «No pudimos cargar tus rutas. Revisa tu conexión.» [Reintentar] |
| Tía · ruta sin alumnos | «Esta ruta aún no tiene alumnos.» [Agregar alumnos] — «Iniciar» desactivado con esa razón (F-04) | — | — |
| Tía · sin recorrido hoy (fin de semana) | «Hoy no tienes recorridos. ¡Buen descanso!» | — | — |
| Tía · Alumnos vacío | «Aún no tienes alumnos. Regístralos con nombre y dirección exacta.» | Relleno | Reintentar |
| Tía · Mensajes vacío | «No tienes mensajes. Aquí te escriben las familias.» | Relleno | Si falla «Enviar»: el texto **no se borra**, «No se envió. [Reintentar]» |
| Tía · Recorrido, sin pendientes | «Ya pasaste por todos. [Terminar recorrido]» (F-20: «No quedan alumnos pendientes») | «Buscando tu ubicación…» al iniciar | Sin GPS: franja roja fija «Tu ubicación está apagada: las familias no ven el furgón» (no un toast) |
| Familia · Hoy, sin recorrido | «Hoy: Mañana a las 07:00. Te avisamos 5 min antes.» En modo Familias: botón demo F-76 | Relleno | «No pudimos saber dónde viene el furgón. Última posición hace 2 min.» |
| Familia · Furgón en vivo, ya subieron | «Sofía y Tomás ya van en el furgón» (F-80) | «Ubicando el furgón…» | Igual que arriba, con la hora de la última posición |
| Familia · Pagos vacío | «No tienes pagos pendientes.» | Relleno | Reintentar |
| Familia · Mensajes vacío | «Escríbele a la tía cuando necesites avisarle algo.» | Relleno | Texto se conserva + Reintentar |
| Perfil | — | — | Nombre de menos de 2 letras: error bajo el campo «Escribe tu nombre» (hoy es toast) |

---

## 5. Conducir y tocar: cuánto puede pedirle la app a la tía

### 5.1 Lo que dicen las fuentes y lo que no sé

- En Chile, la Ley 21.377 («Ley No Chat», modifica la Ley de Tránsito 18.290) prohíbe usar el
  celular de cualquier forma que impida tener ambas manos en el volante; según CONASET, también
  detenido en un semáforo; lo permitido es manos libres o detener el vehículo y apagar el motor.
  Es infracción gravísima, con multa de 1,5 a 3 UTM y suspensión de licencia [Fuente NoChat].
  **No sé** si tocar «Subió» con el furgón detenido frente a la casa, motor encendido, cuenta como
  infracción: eso lo debe ver un abogado.
- La guía de NHTSA (EE. UU., para pantallas del auto) pide que ninguna mirada fuera del camino dure
  2 s o más y que una tarea completa no pase de 12 s de miradas [Fuente NHTSA]. Es una guía de otro
  país y pensada para pantallas de fábrica; la uso solo como referencia de tamaño del problema.
- Google pide en Android Auto toques de mínimo 76 × 76 dp, por la distancia y para «toques rápidos
  mientras se maneja» [Fuente Cars].

### 5.2 Propuesta: recorrido «casi sin tocar»

1. **Antes de partir (furgón detenido):** al tocar «Iniciar la Mañana» se abre una hoja corta:
   «Hoy van 4 niños (Isidora no va). Celular con batería, ubicación activada y en el soporte.»
   [Comenzar recorrido]. Reemplaza el aviso F-11 y le da un momento para revisar. Es un toque más,
   pero evita iniciar la ruta equivocada (hoy, «Tarde» se inicia con un toque a cualquier hora).
   **Alternativa:** «Deshacer» 10 s después de iniciar, sin hoja. La descarto porque la tía ya
   estaría manejando.
2. **Durante el viaje:** los avisos a las familias salen solos (ya es así, F-04). La pantalla no
   pide nada; muestra la próxima parada en letra grande y nada para leer en movimiento.
3. **En cada parada (detenida):** un toque grande «Subió» / «No estaba». Si son hermanos, «Subieron
   los 2».
4. **Si no marca nada:** el sistema anota «El furgón pasó por la casa» (no «Subió»). La familia ve
   «El furgón llegó a tu casa» hasta que la tía confirme. Así la app nunca afirma que un niño subió
   sin que alguien lo confirme. **Decisión del dueño:** hoy F-04 marca «entregado» solo y la familia
   lee «Subió al furgón ✅». Propongo conservar el motor (F-04 sigue marcando la llegada) y cambiar
   solo **lo que se muestra** cuando nadie confirmó.
5. **Al llegar al colegio (detenida):** «Revisar el recorrido»: lista de todos con su estado; se
   puede corregir cualquiera y terminar. Así la tía puede dejar todo para el final si no quiere
   tocar en cada casa.
6. **Mensajes:** la barra sigue oculta en el recorrido (bien hecho hoy). Un mensaje nuevo no
   interrumpe; se ve un número en «Revisar el recorrido» al terminar.

Conteo: lo mínimo posible es **3 toques en todo el recorrido** (Iniciar + Comenzar + Terminar al
llegar al colegio) si la tía no marca nada en las paradas; ninguno de ellos con el furgón en
movimiento. Con marca en cada parada: ver T1 en §6.4.

---

## 6. Arquitectura propuesta

### 6.1 Modos del archivo único

- **Modo App** (por defecto): selector «Ver como tía / Ver como familia» arriba, más bajo y con
  la etiqueta «Demo», sin perder el estado al cambiar (F-93).
- **Modo Familias** (`…html#familias`): sin selector, arranca como familia, botón «Simular que la
  tía inicia la ruta de la mañana» (F-76) en el estado vacío de Hoy, respuesta automática de la tía
  a los 4 s, título «Furgón Escolar Familias», teléfono a pantalla completa. Un enlace distinto para
  compartir con apoderados, mismo archivo.
  *Descartado:* una pantalla de inicio «¿Quién eres?». Agrega un toque a cada visita y en el modo
  Familias no tiene sentido.

### 6.2 Tía

**Barra inferior (5): Hoy · Rutas · Alumnos · Mensajes · Más.** Punto rojo en Mensajes (sin
responder) y en Más (familias por conectar). Se oculta en el recorrido. Material/Android recomienda
3 a 5 destinos en la barra [Fuente Android-nav].

| Pantalla | Qué es lo primero que se ve | Contenido |
|---|---|---|
| **Hoy** | La próxima ruta y su botón «Iniciar la Mañana · 07:00» | Lista de los niños de esa ruta (tachado si no va), otra ruta en una línea, sugerencia de ahorro de ruta (F-08/F-13), «Se sumaron a tus rutas» (F-12), «Ver en Google Maps». Si hay recorrido: franja verde «Recorrido en curso · Volver» |
| **Recorrido** (pantalla completa) | La próxima parada con «Subió / No estaba» abajo | Mapa (F-07), minutos, estado del aviso, lista corta «Después…», «Atendidos» corregibles, «Terminar recorrido», «Salir al inicio (el recorrido sigue)» |
| **Rutas** | Lista de rutas (nombre, hora, n niños) + «Nueva ruta» | Toca una → **Detalle de ruta**: Iniciar, Calcular la mejor ruta, orden con ↑ ↓, quitar (con deshacer), «Hoy no va», agregar alumnos, eliminar ruta (con confirmación) |
| **Alumnos** | Contador y lista | Igual que F-30 |
| **Mensajes** | Los sin responder primero | Respuesta escrita o rápida |
| **Más** | Perfil (foto y nombre) | Mi perfil · Cobros · Familias por conectar (1) · Mi licencia · Volver a mostrar los avisos · Apariencia · Salir |

### 6.3 Familia

**Barra inferior (4): Hoy · Mensajes · Pagos · Más.** Se oculta en «Furgón en vivo».

| Pantalla | Qué es lo primero que se ve | Contenido |
|---|---|---|
| **Hoy** | Con aviso: la alarma con «Ver dónde viene» y «Recibido». Sin aviso: el estado del día («Mañana a las 07:00…») | Una tarjeta por hijo: estado, «Mañana: va/no va», «Tarde: va/no va», «Aviso: 5 min antes ›». Línea «Tu furgón: Tía Demo ›». Botón demo (solo modo Familias) |
| **Furgón en vivo** | Minutos en grande | Mapa privado (F-07), «ya subieron», Volver |
| **Mensajes** | Conversación con la tía | Campo abajo, «Esperando respuesta…» |
| **Pagos** | El mes pendiente arriba | «Avisar que pagué», «Me equivoqué» |
| **Más** | Perfil | Mi perfil · Mi furgón (ficha de la tía) · Compartir con papá o mamá (FAM-7K2Q) · Apariencia · Salir |

### 6.4 Flujos: toques antes y después

| Tarea | Antes (toques / desplaz.) | Después (toques / desplaz.) | Comentario |
|---|---|---|---|
| T1. Iniciar y marcar a 4 niños (3 casas) y terminar | 6 / ≥2, con toques que se pierden | **6 / 0**: Iniciar → Comenzar → «Subieron los 2» → Subió → Subió → Terminar | Mismo número, pero sin desplazar, botones grandes y sin toques perdidos. La hoja «Comenzar» suma 1 y «los 2» resta 1. Mínimo posible sin marcar: 3 (§5.2) |
| T2. Reordenar a mano (Isidora 4.º → 1.º) | 4 / 1 | **5 / 0**: Rutas → Mañana → ↑ ×3 | **Empeora en 1 toque.** Lo acepto porque quita una pantalla de 1 517 px y aleja el ✕ peligroso. Si molesta, agrego «Mover al primer lugar» en el menú de cada niño (4 toques) |
| T2b. Mejor ruta | 2 / 1 (desde Inicio) | **2 / 0** (sugerencia en Hoy: Ver → Aplicar) | Además se puede deshacer: «Volver al orden anterior» |
| T3. Responder mensaje | 3 + texto | **2** con respuesta rápida; 3 + texto si escribe | |
| T4. Terminar por error | 1, irreversible | **2** si quedan pendientes (confirmación); 1 si ya terminó | |
| F1. «Hoy no va» | 1 | **1** + «Deshacer» en el aviso | Igual |
| F2. Confirmar alarma y ver furgón | 2 / 0–1 | **1 / 0** («Ver dónde viene» también confirma) | |
| F3. Avisar pago | 2, sin deshacer | **2**, con «Me equivoqué» | |
| F4. Minutos de aviso | 1–4 por hijo | **2** siempre, y para todos los hijos de una vez | |
| F5. Foto de perfil | 3 + sistema + Guardar | **3** + sistema (avatar → Cambiar foto → Galería), sin Guardar | Más corto y sin el mensaje falso |

### 6.5 Confirmar o deshacer: regla para todo el diseño

Regla: **confirmar** solo lo serio, poco frecuente o que no se puede revertir; **deshacer** para lo
frecuente [Fuente NNg-conf]. Como NN/g advierte que un deshacer que dura pocos segundos es débil,
además de los avisos con «Deshacer» dejo **siempre un lugar fijo donde corregir** (Atendidos,
Revisar el recorrido, la fila del pago) [Fuente NNg-conf].

| Acción | Antes | Después |
|---|---|---|
| Subió / En su hogar / No estaba (Ausente) | Inmediato, sin corrección | Inmediato + Deshacer 8 s + corregible en Atendidos |
| Terminar recorrido | Inmediato | Confirmación si quedan pendientes |
| Iniciar recorrido | Inmediato | Hoja corta «Comenzar» (§5.2) |
| Quitar alumno de la ruta (✕) | Inmediato | Inmediato + Deshacer |
| Eliminar ruta | Confirmación | Confirmación (igual) |
| Aplicar ruta recomendada | Inmediato | Inmediato + «Volver al orden anterior» |
| Hoy no va (familia o tía) | Interruptor reversible | Igual + Deshacer en el aviso |
| Avisar que pagué | Inmediato, queda «Pagado» | «Avisaste el pago» + «Me equivoqué» |
| Aceptar / Rechazar familia | Inmediato | Aceptar inmediato; Rechazar con Deshacer |
| Quitar foto / cambiar foto | Inmediato / mensaje falso | Inmediato + Deshacer |
| Salir | Mensaje | Igual (en la app real cerrar sesión es fácil de revertir: volver a entrar) |

---

## 7. Decisiones importantes y alternativa descartada

| Decisión | Alternativa descartada y por qué |
|---|---|
| Recorrido centrado en **una parada a la vez** | *Lista de todos los niños (como hoy):* obliga a leer y desplazar; se mueve bajo el dedo. Mantengo la lista, pero chica y debajo |
| **Deshacer** en vez de confirmar al marcar niños | *Confirmar cada marca:* duplica toques en la tarea más repetida y la gente acepta sin leer [Fuente NNg-conf] |
| Mostrar «El furgón llegó» en vez de «Subió» si nadie confirmó | *Dejarlo como hoy:* la familia recibe una confirmación que nadie hizo. *Exigir toque en cada casa:* choca con la Ley No Chat. Decide el dueño |
| Hoja «Comenzar» antes de iniciar | *Iniciar directo + deshacer:* el deshacer llegaría con la tía ya manejando |
| «Ver dónde viene» dentro de la alarma y que cuente como «Recibido» | *Dos botones separados que no se relacionan:* un toque más en el momento de apuro. Riesgo: la familia mira y no sale; lo acepto porque «Recibido» hoy tampoco garantiza nada [Hipótesis mía] |
| Pestaña **«Más»** visible en vez del ⋮ | *Mantener ⋮:* la navegación escondida se descubre mucho menos [Fuente NNg-hamb]. *Poner Cobros en la barra:* sería la 6.ª pestaña (máximo recomendado 5 [Fuente Android-nav]) |
| Familia con 4 pestañas | *Mantener 5:* «Familia» y «Mi furgón» se usan una vez [Hipótesis mía] y quitan espacio a lo diario |
| **Una ruta por pantalla** en Rutas | *Todo en una pantalla (como hoy):* 1 517 px y ✕ junto a ↓. Cuesta 1 toque más (T2), lo digo en §6.4 |
| «Nueva ruta» en **una sola hoja**, no paso a paso | *Un dato por pantalla:* 3 datos cortos; dividir agrega toques sin ganar claridad [Hipótesis mía, apoyada en Fuente GOVUK que pide juntar cuando corresponde] |
| Minutos de aviso en una hoja con las 5 opciones | *Control segmentado en la tarjeta:* 5 botones chicos (≈ 60 px de ancho) en una tarjeta ya cargada. *Rotar como hoy:* hasta 4 toques y opciones invisibles |
| Errores de formulario bajo el campo | *Toast (como hoy):* se va en 2,6 s y tapa la pantalla |
| Modo Familias por enlace (`#familias`) | *Pantalla «¿Quién eres?»:* un toque más en cada visita |

---

## 8. Trazabilidad: cada F-xx del inventario → dónde queda

Nada se pierde. Donde una función cambia de lugar o de forma, lo indico.

| Código | Qué es | Dónde queda en el diseño nuevo |
|---|---|---|
| §0 | Diferencias App / Familias | Modo App y modo `#familias` del mismo archivo (§6.1): título, selector oculto, nota, alto 100vh, botón demo, «al iniciar» solo lleva a la tía si el rol es tía, respuesta automática a los 4 s |
| §1 | Un HTML, estado `S` + `pintar()`, delegación, 26 íconos, `esc()`, tokens claro/oscuro | Se mantiene. Cambio: la actualización en vivo no reemplaza botones (R-a). Emojis → íconos (T-g) |
| §2 | Datos de ejemplo | Se mantienen todos |
| F-01 | `puntosRuta` (salta «no va», junta hermanos) | Motor intacto. La pantalla ahora también junta hermanos (R-c) |
| F-02 | `largo` / `puntoEn` | Intacto (mapa en Recorrido y Furgón en vivo) |
| F-03 | `etaMin` | Intacto: minutos en la parada (tía) y en grande (familia) |
| F-04 | `iniciar`: no deja sin alumnos, estados, avance, «avisado», «entregado» a 0 min | Intacto. Agrego hoja «Comenzar» antes (§5.2). Lo que ve la familia si nadie confirmó: decisión del dueño (§5.2 punto 4) |
| F-05 | `terminar` + «Recorrido terminado. ¡Buen trabajo!» | Se mantiene; confirmación si quedan pendientes (R-f) |
| F-06 | Redibujo en vivo selectivo, respeta campo con foco, conserva desplazamiento | Se mantiene la intención; se implementa actualizando solo lo que cambia (R-a) |
| F-07 | Mapa SVG; privacidad familia | Recorrido (más bajo o plegable) y Furgón en vivo (más alto). Privacidad intacta |
| F-08 | «Calcular la mejor ruta» (vecino más cercano, km, Aplicar/Descartar, «ya es el más corto») | Detalle de ruta (botón) + sugerencia en Hoy (T-e). Se suma «Volver al orden anterior» |
| F-10 | Inicio tía: saludo, avatar → perfil, ⋮ | **Hoy**: saludo y avatar (→ Mi perfil). El ⋮ pasa a pestaña **Más** |
| F-11 | Aviso de consejos con cerrar | Hoja «Comenzar» (§5.2) y, la primera vez, tarjeta en Hoy con cerrar de 44 px |
| F-12 | «Se sumaron a tus rutas» con cerrar | Hoy, debajo de la próxima ruta |
| F-13 | Mensaje de éxito al aplicar ruta recomendada | Aviso con «Volver al orden anterior» |
| F-14 | Tarjeta por ruta: tipo/hora, «A buscar/A dejar hoy (n)», lista tachada, Google Maps, Calcular, Iniciar / Continuar / desactivado | Hoy: próxima ruta abierta, otra en una línea; «Continuar» = franja «Recorrido en curso · Volver»; desactivado con razón (T-c); Google Maps (T-d); Calcular → sugerencia + detalle |
| F-20 | Recorrido: título, «● En curso», mapa, nota, tarjetas con aviso y ~min, Subió/En su hogar, Ausente, Atendidos, Terminar, Volver al inicio | Pantalla **Recorrido**: próxima parada, estado del aviso, minutos, «Subió/En su hogar» y «No estaba» (= Ausente), Atendidos corregibles, «No quedan alumnos pendientes», Terminar, «Salir al inicio (el recorrido sigue)». La nota de minutos pasa a cada parada (R-g) |
| F-30 | Alumnos: contador, tarjetas, chips, «+ Registrar alumno» | Pestaña **Alumnos**, igual |
| F-40 | Rutas: explicación, Nueva ruta (validaciones), Iniciar, Calcular, ↑ ↓ ✕, Hoy no va, «+ nombre», Eliminar con confirmación | **Rutas** (lista + «Nueva ruta» en hoja con errores bajo el campo) → **Detalle de ruta** con todo lo demás; ✕ con Deshacer |
| F-50 | Mensajes tía: amarilla si falta responder, Responder, no envía vacío, «Tu respuesta: …» | Pestaña **Mensajes** + respuestas rápidas; no envía vacío (error bajo el campo) |
| F-60 | Menú ⋮: Perfil, Cobros, Familias por conectar (1), Licencia, Volver a mostrar avisos, Apariencia, Salir, Cerrar | Pestaña **Más** con los mismos elementos («Cerrar» ya no hace falta: es una pantalla) |
| F-61 | Cobros | Más → Cobros |
| F-62 | Mi licencia | Más → Mi licencia |
| F-63 | Familias por conectar: Aceptar / Rechazar | Más → Familias por conectar (punto rojo en Más); Rechazar con Deshacer |
| F-70 | Inicio familia: saludo, avatar, Salir | **Hoy**: saludo y avatar. «Salir» → Más (Fa-f) |
| F-71 | Alarma que late con «Recibido, estoy atento/a» | Hoy, arriba: alarma con «Ver dónde viene» y «Recibido» |
| F-72 | Tarjeta por hijo con estado y «Seguir el furgón en vivo» | Hoy: tarjeta por hijo con estado; «Seguir» también en la tarjeta mientras esté pendiente |
| F-73 | Interruptores «Hoy no viaja» Ida/Vuelta con mensaje | Hoy: «Mañana: va/no va», «Tarde: va/no va» + aviso con Deshacer |
| F-74 | «Aviso n min antes · cambiar» (3/5/7/10/15) | Hoy: «Aviso: n min antes ›» → hoja con las mismas 5 opciones |
| F-75 | Selector de apariencia al final | Más → Apariencia |
| F-76 | (Familias) «▶ Simular que la tía inicia la ruta de la mañana» | Estado vacío de Hoy en modo Familias |
| F-80 | Furgón en vivo: mapa privado, «Llega en ~n min» / «Tus hijos ya subieron ✅» | Pantalla **Furgón en vivo**, minutos en grande; texto con nombres |
| F-81 | Pagos: 3 meses, «Avisar que pagué» | Pestaña **Pagos**; estado «Avisaste el pago» + «Me equivoqué» |
| F-82 | Mensajes familia: escribir, no envía vacío, historial, respuesta automática (Familias) | Pestaña **Mensajes** tipo conversación; respuesta automática solo en modo Familias |
| F-83 | Código FAM-7K2Q | Más → Compartir con papá o mamá |
| F-84 | Mi furgón: foto/iniciales, nombre, comunas, presentación, «Conectada» | Más → Mi furgón (iniciales reales) + línea «Tu furgón: Tía Demo ›» en Hoy |
| F-90 | Mi perfil: foto (cámara/galería/quitar), nombre ≥2, teléfono, correo, interruptor visible, comunas, presentación ≤300, Guardar | Más → Mi perfil (y avatar). Foto se guarda al elegir con Deshacer (C-a); el resto con Guardar |
| F-91 | Toasts de 2,6 s | Avisos de 4 s / 8 s con Deshacer, sin tapar la acción principal (C-b) |
| F-92 | Tema Automático / Claro / Oscuro | Más → Apariencia (ambos roles) |
| F-93 | Cambio de rol sin perder estado | Selector «Demo: ver como…» en modo App |
| F-94 | Responsivo ≤480 px | Se mantiene; diseño pensado primero para 360–430 px |

Defectos del inventario (§7) → arreglo: 1 → R-a · 2 → C-a · 3 → Fa-k · 4 → T-d · 5 → R-g ·
6 → R-h · 7 → C-c · 8 → T-h · 9 → T-g.

---

## 9. Lo que no sé o no pude comprobar

- No probé con tías ni familias reales. Los conteos de toques son exactos; que el diseño nuevo sea
  «más fácil» es una hipótesis hasta probarlo con 5 personas (sugerencia: 3 tías, 2 apoderados,
  tareas T1, F2, F4).
- No sé cómo interpreta la ley tocar la pantalla con el furgón detenido y el motor encendido.
- No sé si las familias prefieren «Ver dónde viene» como confirmación (§7).
- Las guías de Apple sobre 44 pt solo las vi citadas por terceros; no pude abrir la página de Apple.
- El acceso directo a nngroup.com, w3.org y material.io estaba bloqueado desde este equipo; verifiqué
  las fuentes con el buscador web (títulos, direcciones y extractos). Donde no confirmé autor o año,
  lo marco.

---

## 10. Fuentes (verificadas por búsqueda web el 14-10-2026)

- **[NNg-conf]** Nielsen, J. «Confirmation Dialogs Can Prevent User Errors (If Not Overused)».
  Nielsen Norman Group (año no verificado). https://www.nngroup.com/articles/confirmation-dialog/ —
  Confirmar antes de acciones serias o irreversibles; no en acciones rutinarias; si es repetitivo,
  ofrecer deshacer fácil; botones con el nombre de la acción, no «OK»; un deshacer en aviso pasajero
  es débil porque dura pocos segundos.
- **[NNg-10]** Nielsen, J. «10 Usability Heuristics for User Interface Design» (1994, actualizado).
  https://www.nngroup.com/articles/ten-usability-heuristics/ — Heurístico 3: control y libertad del
  usuario (salida clara, deshacer y rehacer).
- **[NNg-h3]** «User Control and Freedom (Usability Heuristic #3)». NN/g (autor y año no
  verificados). https://www.nngroup.com/articles/user-control-and-freedom/
- **[NNg-hamb]** Pernice, K. y Budiu, R. «Hamburger Menus and Hidden Navigation Hurt UX Metrics».
  NN/g, 2016 (autoras según mi memoria; año verificado). https://www.nngroup.com/articles/hamburger-menus/
  — Esconder la navegación principal reduce casi a la mitad su descubrimiento, alarga las tareas y
  las hace parecer más difíciles.
- **[NNg-vacío]** Kaplan, K. «Designing Empty States in Complex Applications: 3 Guidelines». NN/g
  (año no verificado). https://www.nngroup.com/articles/empty-state-interface-design/
- **[WCAG-258]** W3C. WCAG 2.2 (2023), criterio 2.5.8 «Target Size (Minimum)», nivel AA: 24 × 24 px
  CSS; criterio 2.5.5 (AAA): 44 × 44 px. https://www.w3.org/TR/WCAG22/ · resumen verificado en
  DAISY: https://kb.daisy.org/publishing/docs/wcag/target-size-minimum.html
- **[WCAG-221]** W3C. «Understanding SC 2.2.1: Timing Adjustable».
  https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html · Roselli, A. «Defining
  ‘Toast’ Messages», 2020. https://adrianroselli.com/2020/01/defining-toast-messages.html —
  No hay acuerdo sobre si un toast que se va solo incumple 2.2.1; es más grave si es la única forma
  de enterarse.
- **[Android-nav]** Android Developers. «Layout and navigation patterns».
  https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
  — La barra de navegación lleva de 3 a 5 destinos.
- **[Cars]** Google. Android for Cars, «Sizing».
  https://developers.google.com/cars/design/android-auto/design-system/sizing — mínimo 76 × 76 dp
  «por la distancia del conductor y para toques rápidos mientras se maneja»; y «Design principles»,
  https://docs.partner.android.com/drivingux/foundations/design-principles — 23 dp entre objetivos.
- **[NHTSA]** NHTSA, Visual-Manual Driver Distraction Guidelines (2013, pantallas del auto; Fase 2
  de 2016 para dispositivos portátiles, propuesta). Resumen en National Academies Press:
  https://nap.nationalacademies.org/read/26550/chapter/4 — miradas de menos de 2 s, 12 s en total
  por tarea.
- **[NoChat]** Ley 21.377 («Ley No Chat»), modifica la Ley 18.290. Cámara de Diputadas y Diputados,
  22-09-2021: https://www.camara.cl/cms/noticias/2021/09/22/a-ley-alza-en-la-sancion-por-conducir-manipulando-un-celular-u-otro-artefacto-electronico-o-digital/
  · T13, 21-03-2022: https://www.t13.cl/noticia/nacional/ley-no-chat-conducir-celular-normativa-cuales-son-sanciones-21-03-2022
  (el número exacto del artículo no lo confirmé; revisar en bcn.cl).
- **[GOVUK]** GOV.UK Service Manual, «Structuring forms».
  https://www.gov.uk/service-manual/design/form-structure · GDS, «One thing per page», 2015.
  https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/ — Partir con una cosa por página
  y juntar donde la investigación lo indique.
- **[Hoober]** Hoober, S. «How Do Users Really Hold Mobile Devices?». UXmatters, febrero 2013.
  https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php —
  49 % con una mano, 36 % sosteniendo con una y tocando con la otra, 15 % con las dos.

---

## 11. Glosario

- **Barra inferior / pestañas:** los botones fijos abajo (Inicio, Mensajes…) para cambiar de sección.
- **Confirmación (diálogo):** ventanita que pregunta antes de hacer algo serio («¿Terminar igual?»).
- **Deshacer:** botón que revierte lo último que hiciste, sin preguntarte antes.
- **Desplazar (scroll):** arrastrar la pantalla hacia arriba para ver lo que está más abajo.
- **Estado vacío:** lo que muestra una pantalla cuando no hay nada (sin mensajes, sin rutas).
- **Foco:** el elemento que está «seleccionado» para el teclado o el lector de pantalla.
- **Hoja:** panel que sube desde abajo sobre la pantalla, con opciones; se cierra al terminar.
- **Lector de pantalla:** programa que lee la pantalla en voz alta a personas ciegas.
- **Objetivo de toque:** el área que responde al dedo; puede ser más grande que el dibujo del botón.
- **px / dp / pt:** unidades de tamaño en pantalla; para este documento, equivalentes (≈ 1 px de
  diseño). 44 px ≈ la yema de un dedo.
- **Redibujar:** volver a generar la pantalla completa; si se hace mientras tocas, el botón que
  tocabas se reemplaza por uno nuevo y el toque se pierde.
- **Toast (mensaje emergente):** aviso breve que aparece abajo y se va solo.
- **WCAG:** reglas internacionales de accesibilidad web (W3C). AA es el nivel exigido normalmente.
- **Heurístico:** regla práctica de diseño (por ejemplo, los 10 de Nielsen).
