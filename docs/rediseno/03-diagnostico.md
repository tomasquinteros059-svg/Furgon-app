# Etapa 3 — Diagnóstico: qué funciona mal hoy

Base: lectura completa del código de `original/Furgon_Escolar_App.html` (y sus diferencias con
la versión Familias). Los números de contraste exactos los calcula la especialista en color en
`04a-color.md`; aquí solo se marcan los sospechosos.

## Lo que hoy funciona bien (y se conserva)

- **Lógica sólida y simple**: todo sale de un único estado y se redibuja; no hay datos duplicados
  que se desincronicen.
- **La privacidad está bien resuelta** en el mapa de la familia (no ve la ruta ni otras casas).
- **Textos en lenguaje de la gente**: «Hoy no va», «Ya subió», «Recibido, estoy atento/a».
- **Botones principales grandes** (46–56 px de alto) y modo oscuro con tokens: buena base.
- **Íconos propios coherentes** (mismo trazo, acento amarillo).

## Problemas, de más grave a menos grave

### A. Accesibilidad y robustez (bloqueantes)

1. **La pantalla se reconstruye completa 4 veces por segundo durante el recorrido.** Consecuencias:
   se pierde el foco del teclado, un lector de pantalla vuelve a leer desde arriba, un botón puede
   desaparecer justo cuando se toca (el toque cae en el elemento nuevo) y el furgón avanza a
   saltos en vez de moverse.
2. **Diálogos sin comportamiento de diálogo**: el menú y «¿Eliminar la ruta?» no se cierran con
   Esc, el foco no entra en ellos ni vuelve al botón que los abrió, y lo de atrás sigue siendo
   alcanzable con el teclado.
3. **La barra inferior se anuncia como pestañas (`tablist`) sin serlo**: un lector de pantalla
   promete un comportamiento (flechas, panel asociado) que no existe.
4. **Áreas táctiles chicas**: las ✕ de cerrar aviso (28 px), las flechas ↑ ↓ ✕ de la ruta
   (38 px, pegadas entre sí) y los textos de la barra (11 px).
5. **Contrastes sospechosos**: texto blanco sobre el verde `#1E8E3E` y sobre el rojo `#D93025`
   (botones «Subió» y «Terminar»), el texto gris de 12,5 px y el amarillo usado como color de foco
   sobre blanco (un contorno amarillo claro casi no se ve sobre blanco).
6. **La alarma late sin parar** (animación infinita). Puede distraer y no se puede detener.
7. **El toast** (aviso que aparece y se va) dura 2,6 s fijos: a quien lee lento se le escapa.

### B. Usabilidad

8. **El inicio de la tía es una lista larga**: consejos + «se sumaron» + dos rutas con todos sus
   alumnos + recomendación. Lo único que importa a las 6:55 de la mañana («Iniciar la ruta de la
   mañana») queda abajo, después de leer todo.
9. **Durante el recorrido hay demasiado que leer para alguien que maneja**: tarjetas con
   dirección, dos chips y dos botones por niño, más la lista de atendidos. No se sabe cuál es «el
   siguiente».
10. **No hay deshacer**: un «Ausente» o «Subió» tocado por error no se puede corregir; quitar a un
    niño de una ruta tampoco.
11. **La pantalla Rutas mezcla editar con operar**: iniciar recorrido, calcular, reordenar, quitar,
    «hoy no va», agregar y eliminar, todo en la misma tarjeta. «Eliminar ruta» queda a un toque de
    «+ Benjamín Muñoz».
12. **«Aviso 5 min antes · cambiar» va rotando 3→5→7→10→15**: para llegar de 5 a 3 hay que tocar 4
    veces y no se ven las opciones.
13. **Inconsistencias**: la familia tiene «Salir» en el inicio y la tía en el menú; la familia
    elige el tema al fondo del inicio y la tía en el menú; 5 pestañas en la familia contra 4 en la
    tía.
14. **No hay estados vacíos con guía**: «No hay mensajes.» o «Esta ruta aún no tiene alumnos.»
    no dicen qué hacer. Tampoco hay estados de carga ni de error (en la maqueta todo es
    instantáneo, pero la app real los necesitará).

### C. Errores de lógica pequeños (ver inventario §7)

15. La foto queda puesta antes de tocar «Guardar» aunque el texto diga lo contrario.
16. «Mi furgón» siempre muestra «TD».
17. «Ver la ruta en Google Maps» abre siempre «Ñuñoa, Santiago».
18. La nota del recorrido usa los minutos de aviso de Sofía para todas las familias.
19. «Hoy no viaja» marcado con el recorrido en curso deja al niño «pendiente» para siempre en la
    lista de la tía.

### D. Diseño visual

20. **Se ve genérico**: Inter + tarjetas blancas con borde gris + chips grises es la plantilla de
    miles de apps. El amarillo aparece solo en botones; no hay nada «de furgón escolar».
21. **Dos idiomas visuales**: emojis (🌅 🏠 🔔 ✅ 🆕 ✨ 👍 📅 👤) junto a íconos propios. Los emojis
    además se ven distintos en cada celular (Android, iPhone).
22. **Jerarquía plana**: casi todo es una tarjeta con el mismo peso; los estados (en curso,
    avisado, vencido) se distinguen por bordes de 2 px y chips pequeños.
23. **El mapa es correcto pero frío**: cuadrícula gris, el furgón salta, no hay sensación de
    «viene en camino».

## Pushback honesto sobre decisiones actuales

- **El cambio de rol arriba del teléfono** sirve para la demo, pero ocupa 53 px de pantalla en el
  celular. Propuesta: dejarlo como una pastilla pequeña flotante o dentro del menú en modo demo.
- **Los dos archivos separados** ya se desincronizaron (la versión Familias responde sola, la otra
  no). Un solo archivo con un modo resuelve eso, como ya decidiste.
- **Simular que la tía responde sola a los 4 s** (versión Familias) puede confundir: parece que
  la app real responde automáticamente. Propuesta: mantenerlo, pero con una etiqueta visible
  «(simulado)».
