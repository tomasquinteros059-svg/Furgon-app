# Ficha para Google Play y App Store

Todo listo para copiar y pegar. Es **una sola app** («Furgón Escolar») para la tía o el tío del
furgón y para las familias; el administrador usa el panel web.

Enlaces que piden las tiendas (funcionan cuando el panel web esté publicado en Vercel):

- Política de privacidad: `https://TU-PANEL/privacidad.html`
- Términos y condiciones: `https://TU-PANEL/terminos.html`
- Eliminar cuenta: `https://TU-PANEL/eliminar-cuenta.html`
- Correo de soporte: `tomasquinteros059@gmail.com`

---

## 1. Textos de la ficha

**Nombre** (máx. 30): `Furgón Escolar`

**Subtítulo — solo App Store** (máx. 30): `Aviso y mapa del furgón`

**Descripción corta — solo Google Play** (máx. 80):

```
Te avisa cuando el furgón escolar está por llegar y lo sigues en vivo.
```

**Texto promocional — solo App Store** (máx. 170):

```
Nunca más esperar en la puerta: te avisamos minutos antes de que llegue el furgón y puedes seguirlo en el mapa mientras tu hijo va a bordo.
```

**Palabras clave — solo App Store** (máx. 100, separadas por comas, sin espacios):

```
furgon,transporte escolar,tia del furgon,colegio,apoderados,aviso,bus escolar,gps,ruta,niños
```

**Descripción completa** (las dos tiendas, máx. 4000):

```
Furgón Escolar conecta a la tía o el tío del furgón con las familias, para que cada niño viaje seguro y nadie espere de más.

PARA LAS FAMILIAS
• Aviso antes de que llegue: una alarma te avisa los minutos que elijas antes de que el furgón llegue a tu casa, en la mañana y en la tarde.
• Llamada automática: si no ves la alarma, la app te llama. Y si tu teléfono no tiene internet, te llamamos por teléfono.
• Síguelo en vivo: toca «Ya subió» y sigue el furgón en el mapa mientras tu hijo o hija va a bordo.
• «Hoy no va»: avisa con un toque que tu hijo no viaja hoy, y el furgón no pasa por tu casa.
• Perfil compartido: la mamá y el papá (o un abuelo) reciben los mismos avisos, cada uno con su cuenta.
• Entra con un código: la tía te da un código y entras directo, sin formularios largos.
• Pagos claros: revisa tus mensualidades y lo que está pagado.

PARA LA TÍA O EL TÍO DEL FURGÓN
• Los avisos salen solos: inicia el recorrido y la app avisa a cada familia a tiempo. No necesitas tocar el teléfono mientras manejas.
• Ruta recomendada: la app ordena las casas para hacer el camino más corto, por calles y con tráfico.
• Navega con Google Maps o Waze hasta cada casa.
• Marca quién subió y quién llegó: al colegio o a su hogar.
• Conecta con familias: te encuentran por nombre, furgón o comuna, y al aceptarlas el niño queda en tu ruta.
• Cobros: fija el precio de cada alumno, registra pagos en efectivo o transferencia y mira lo que falta por cobrar.
• Licencia al día: sube tu licencia y te avisamos antes de que venza.

PRIVACIDAD
La ubicación del furgón se comparte solo durante el recorrido y solo con las familias de ese recorrido. No vendemos datos ni mostramos publicidad. Puedes eliminar tu cuenta desde la app cuando quieras.

Modo claro y oscuro. Hecha en Chile.
```

**Novedades de esta versión:**

```
Primera versión de Furgón Escolar.
```

---

## 2. Categoría y clasificación

| | Google Play | App Store |
|---|---|---|
| Categoría | **Crianza** | **Educación** (secundaria: Navegación) |
| Público objetivo | **Solo 18 años o más** (la usan adultos; así la app no entra al programa de apps para niños) | Clasificación **4+** |
| Anuncios | No contiene anuncios | — |
| Compras dentro de la app | No | No |

**Cuestionario de clasificación de contenido (Play, IARC) / Clasificación por edad (Apple):**

- Violencia, sexo, lenguaje, drogas, apuestas, terror: **No** a todo.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí** (mensajes y solicitudes entre familias y la tía).
- ¿Comparte la ubicación del usuario con otros usuarios? **Sí** (la del furgón, durante el recorrido).
- ¿Navegador web sin restricciones? **No**.

---

## 3. Google Play: «Seguridad de los datos»

**Preguntas generales**

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recopila o comparte datos del usuario? | **Sí** |
| ¿Los datos se encriptan en tránsito? | **Sí** |
| ¿Ofreces una forma de pedir que se borren los datos? | **Sí** — app y `https://TU-PANEL/eliminar-cuenta.html` |
| ¿Cumple la política de Familias? | No aplica (público 18+) |

**Datos recopilados** (en todos: *Recopilados* = Sí, *Compartidos* = **No**\*, *Se procesan de forma efímera* = No).

| Tipo de dato | Obligatorio u opcional | Para qué |
|---|---|---|
| Ubicación → **Ubicación precisa** | Opcional (obligatorio solo para conductores) | Funcionalidad de la app |
| Ubicación → **Ubicación aproximada** | Opcional | Funcionalidad de la app |
| Información personal → **Nombre** | Obligatorio | Funcionalidad de la app, Administración de la cuenta |
| Información personal → **Dirección de correo** | Obligatorio | Administración de la cuenta |
| Información personal → **Números de teléfono** | Obligatorio | Funcionalidad de la app (avisos y llamadas) |
| Información personal → **Dirección** | Obligatorio (familias) | Funcionalidad de la app (ruta) |
| Información personal → **ID de usuario** | Obligatorio | Administración de la cuenta |
| Información financiera → **Otra información financiera** (registro de mensualidades y pagos) | Opcional | Funcionalidad de la app |
| Fotos y videos → **Fotos** (licencia de conducir) | Opcional (solo conductores) | Funcionalidad de la app, Prevención de fraude y seguridad |
| Mensajes → **Otros mensajes en la app** | Opcional | Funcionalidad de la app |
| ID del dispositivo u otros IDs (para notificaciones) | Obligatorio | Funcionalidad de la app |

\* Google no cuenta como «compartir» lo que se envía a proveedores que trabajan para la app
(Supabase, Google Maps, Twilio, Expo) ni lo que el usuario decide mostrar a otros usuarios
(la ubicación del furgón a sus familias).

**No se recopilan:** salud, contactos de la agenda, audio, calendario, archivos, historial web,
apps instaladas, registros de fallos ni datos de publicidad.

---

## 4. App Store: «Privacidad de la app» (etiquetas)

- ¿Recopilas datos? **Sí.**
- **Seguimiento (tracking):** **No** se usa ningún dato para rastrear a la persona entre apps o sitios.
- Todos los datos son **vinculados a la identidad** y su único propósito es **Funcionalidad de la app** (más *Administración de la cuenta* en correo).

| Categoría | Dato |
|---|---|
| Información de contacto | Nombre, Correo electrónico, Número de teléfono, Dirección física |
| Ubicación | Ubicación precisa |
| Contenido del usuario | Fotos o videos (licencia), Otro contenido del usuario (mensajes) |
| Identificadores | ID de usuario, ID del dispositivo |
| Información financiera | Otra información financiera (mensualidades y pagos) |

---

## 5. Permisos que hay que justificar

### Ubicación en segundo plano (Google Play → Contenido de la app → Permisos de ubicación)

**Descripción de la función:**

```
La app la usa la tía o el tío del furgón escolar. Al tocar «Iniciar recorrido», el teléfono comparte la ubicación del furgón con las familias de los niños de ese recorrido, para avisarles minutos antes de que el furgón llegue a su casa y para que puedan seguirlo en el mapa. El conductor maneja con el teléfono en su soporte y la pantalla apagada, por eso necesitamos la ubicación en segundo plano. La ubicación se comparte solo entre «Iniciar recorrido» y «Finalizar recorrido», con una notificación permanente que lo indica. Las familias no comparten su ubicación.
```

**Video:** ver la sección 7. Súbelo a YouTube como **«No listado»** y pega el enlace.

### Servicio en primer plano de ubicación (Android 14)

Tipo: **Ubicación**. Misma descripción y el mismo video.

### App Store: notas para el revisor

```
Furgón Escolar avisa a las familias cuando el furgón escolar está por llegar.

Ubicación en segundo plano: la usa solo la cuenta de conductor, entre «Iniciar recorrido» y «Finalizar recorrido», para avisar a las familias aunque la pantalla esté apagada. Las cuentas de familia no comparten su ubicación.

Notificaciones urgentes (Time Sensitive): el aviso de llegada del furgón debe sonar aunque el teléfono esté en modo Concentración, porque el niño tiene que salir a tiempo.

Cuentas de prueba (con datos de demostración; las crea `npm run cuentas-revision`):
• Conductor: [CORREO DEMO TÍA] / [CONTRASEÑA DEMO]
• Familia: [CORREO DEMO FAMILIA] / [CONTRASEÑA DEMO]

Para probar: entra como conductor, toca «Iniciar recorrido» en la ruta «Mañana», y en otro teléfono entra como familia para ver el aviso y el furgón en el mapa.

Eliminar cuenta: Inicio → al final de la pantalla → «Eliminar mi cuenta».
```

---

## 6. Imágenes (listas en `docs/tiendas/`)

| Qué | Google Play | App Store |
|---|---|---|
| Ícono | `icono-512.png` (512 × 512) | Lo toma de la app (1024 × 1024) |
| Imagen destacada | `destacada-1024x500.png` | — |
| Capturas de teléfono, en este orden | `android-1-aviso.png` … `android-6-tia-administrar.png` (1080 × 1920) | `iphone-1-aviso.png` … `iphone-6-tia-administrar.png` (1290 × 2796, pantalla de 6,9") |

Salen de las maquetas, sin los controles de la demostración. Cuando la app esté instalada
conviene cambiarlas por capturas reales del teléfono.

## 7. Guion del video de ubicación (30–45 s, grabado con el teléfono)

Graba la pantalla del teléfono Android (deslizar desde arriba → **Grabar pantalla**) con la app de
prueba y una cuenta de conductor:

1. **(0–5 s)** Abre la app con la cuenta de conductor. Se ve la pantalla de inicio con la ruta.
2. **(5–12 s)** Toca **«Iniciar recorrido»**. Aparece el pedido de permiso de ubicación: elige
   **«Permitir todo el tiempo»** (o «Permitir mientras se usa» y luego «todo el tiempo»).
3. **(12–20 s)** Se ve el mapa con el furgón y la lista de casas. Baja la cortina de
   notificaciones: se ve la notificación **«Recorrido en curso»**.
4. **(20–28 s)** Apaga la pantalla o vuelve al inicio del teléfono (la ubicación sigue).
5. **(28–38 s)** En otro teléfono, con una cuenta de familia, se ve el **aviso de llegada** y el
   furgón moviéndose en el mapa. (Si no tienes otro teléfono, basta con mostrar la notificación.)
6. **(38–45 s)** Vuelve a la app del conductor y toca **«Finalizar recorrido»**: la notificación
   desaparece.
