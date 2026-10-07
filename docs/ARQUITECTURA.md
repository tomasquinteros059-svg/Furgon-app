# Arquitectura y decisiones

## Decisiones tomadas en el prototipo

| Tema | Decisión |
|---|---|
| Dónde se calcula el ETA | En el **servidor** (Edge Function `posiciones`). El teléfono solo envía posiciones. |
| Proveedor de ETA | Google **Routes API** (`computeRoutes`, `TRAFFIC_AWARE`), intercambiable por Mapbox (`ETA_PROVEEDOR`). |
| Respaldo | Geocerca equivalente: distancia × 1,3 (factor de calles) a 20 km/h. Con 5 min equivale a un radio de ≈ 1,4 km. |
| Deduplicación | `UNIQUE (recorrido_id, alumno_id)` en `avisos` + `INSERT … ON CONFLICT DO NOTHING RETURNING`. |
| "Contestó la llamada" | Solo si **presiona 1**. Un buzón de voz no corta la escalera. |
| Escalera de llamadas | Principal → reintento al principal a los 30 s → secundario. |
| Mapa del apoderado | Tipo Uber. Durante el recorrido: **zona aproximada** (lat/lng redondeadas a 0,01° ≈ 1 km), paradas que faltan y ETA (`seguimiento_furgon`). **Desde su aviso hasta la entrega**: posición exacta y solo las posiciones registradas desde el aviso (RLS `puede_ver_posicion`). |
| Registro | Por **código de invitación**, que fija rol y empresa. |
| País | Chile: teléfonos +56, zona `America/Santiago`, voz en español. |
| Alarma en iOS | `time-sensitive`. Las *Critical Alerts* requieren un permiso especial que se pide a Apple. |
| Login | Correo y contraseña en el prototipo. El OTP por SMS queda pendiente. |
| Ruta recomendada | `core/recomendar-ruta.ts`: camino abierto (la ida termina en el colegio, la vuelta parte de él). Hasta 8 casas, búsqueda exhaustiva con poda (óptimo); con más, vecino más cercano + 2-opt + reubicación de tramos. No cambia el orden por menos de 50 m. La función `recomendar-ruta` lo afina con Routes API (`optimizeWaypointOrder`) cuando hay clave de Google. Solo propone: se guarda con `aplicar_orden_ruta`. |
| Hoy no va | `marcar_no_viaja` acepta al apoderado, a quien administra y a la tía que lleva al alumno. Si el recorrido de hoy ya partió, la parada pasa a `no_viaja` y se cancelan sus llamadas; el trazado y los avisos solo usan paradas pendientes. |
| Precios | `fijar_mensualidad` (precio del alumno + cobros pendientes desde un mes) y `cambiar_monto_cobro` (un cobro pendiente). Los pagados no se tocan. |
| Ya subió | `recorrido_alumnos.a_bordo_desde` / `a_bordo_por`. La familia lo marca con `confirmar_subida`: en la vuelta basta con que el recorrido esté en curso; en la ida el furgón debe estar a menos de 300 m de la casa (así nadie ve la posición exacta mientras recoge a otros niños). En la ida, «Subió» de la tía también lo marca. Mientras va a bordo (`va_a_bordo`), `seguimiento_furgon` entrega la posición exacta y RLS deja leer las posiciones desde que subió. |
| Apps | Administrador: solo app web (`apps/admin`). Tía/tío y familias: app móvil (`apps/movil`); la ruta `admin` de la app móvil solo muestra el enlace al panel web. |
| Furgones y licencias | El administrador ve furgones (`resumen_furgones`, `guardar_furgon`), no alumnos. La tía sube su licencia (`subir_licencia`; fotos en el bucket privado `licencias/<su id>/`); el administrador la revisa (`revisar_licencia`, con motivo al rechazar; nadie aprueba la propia). `estado_licencias` da vigente / por vencer (≤ 30 días) / vencida / por verificar / rechazada / sin licencia. La función `avisos-licencias` (pg_cron, diaria) envía push a los 60, 30, 15, 7, 1 y 0 días, una vez por umbral (`avisos_licencia`). Un trigger impide crear recorridos con la licencia vencida. |
| Íconos | Set propio en `diseno/iconos.ts` (51 íconos, SVG 24×24, `currentColor` + un acento). Mapa emoji → ícono: la app móvil reemplaza los emojis al dibujar (`Text` propio), las maquetas al construir el HTML (`iconizar`), el panel web con `<Icono>`. Sin emojis en push, alertas nativas ni mensajes para compartir. |
| Navegación | Botones «Google Maps» y «Waze» hacia la próxima casa (`waze.com/ul?ll=…&navigate=yes`). |
| Conexión → ruta | Al aceptar (o al invitar) la tía elige rutas (`conexiones.rutas`, solo rutas propias: `rutas_validas`). Los hijos que la familia registra entran solos a esas rutas con `agregar_a_ruta_en_mejor_lugar` (inserción más barata, con el colegio como fin de la ida e inicio de la vuelta); los que ya tenía sin ruta entran al aceptar. `nuevos_en_mis_rutas` alimenta la tarjeta «Se sumaron a tus rutas» del panel principal. |
| Familia compartida | `apoderado_alumno` admite varios apoderados por alumno (`invitado_por`). La mamá crea un código de un solo uso con `compartir_familia` (tabla `invitaciones_familia`, vence en 7 días); el otro lo usa al registrarse o con `unirse_familia`. Push y llamadas ya llegan a todos los apoderados del alumno; al unirse, su teléfono entra a `contactos` si hay cupo (prioridad 2 o 3). `dejar_de_compartir`: cada uno puede salirse y quien invitó puede quitar a quien invitó; un hijo nunca queda sin apoderado. |
| Entrar con código | Sesión anónima de Supabase Auth (`signInAnonymously` con el código en los metadatos). El trigger solo crea perfil con un código de familia o una invitación de rol apoderado; nunca conductoras ni «familia sin código». La app pide proteger la cuenta (`updateUser` con correo y contraseña) y advierte antes de cerrar sesión. Requiere `enable_anonymous_sign_ins` (lo activa `npm run desplegar`). |
| Conexiones | Tabla `conexiones` (familia ↔ tía/tío, pendiente/aceptada/rechazada/cancelada). La familia busca con `buscar_tias` (solo tías con `visible_en_busqueda`); la tía busca con `buscar_familia` solo por correo o teléfono exactos, para que nadie pueda listar familias. Al aceptar (`responder_conexion`), la familia sin furgón queda en el de la tía; con varias tías, `registrar_alumno` recibe `conductor_id` y `crear_solicitud` va al furgón del hijo. Tras un rechazo hay que esperar 7 días para volver a pedir. |

## Flujo del disparo

```
Teléfono del conductor                       Edge Function `posiciones`
──────────────────────                       ──────────────────────────
GPS (cada ~10 s, en 2º plano)
  └─▶ cola SQLite ──lote──▶  1. Valida JWT, que sea su recorrido y que esté activo (si no: 409 → apaga GPS)
       (sin señal: espera)   2. registrar_posiciones (ignora client_id repetidos)
                             3. Toma SOLO la posición más reciente; si tiene > 60 s, no dispara
                             4. paradas_pendientes (en orden de ruta)
                             5. decidirConsultaEta:
                                  - "no_necesario" si ni a 90 km/h en línea recta alguna parada entra en su ventana
                                  - "reusar_cache" si el ETA tiene < 60 s y el furgón se movió < 300 m
                                  - "consultar" en otro caso
                             6. ETA acumulado por la ruta: origen → p1 → p2 … (+60 s por parada)
                                  si la API falla o tarda > 2,5 s → geocerca de respaldo
                             7. evaluarDisparos: eta ≤ minutos_aviso·60 + 30 s, o a < 300 m (proximidad)
                             8. registrar_aviso (atómico) → solo quien inserta notifica:
                                  push con alarma (Expo → FCM/APNs) + 1ª llamada (Twilio)
```

**Por qué el ETA es acumulado por la ruta y no directo a cada casa:** en la ida, el furgón puede
pasar a 800 m de la casa del alumno 3 mientras va a buscar a los alumnos 1 y 2 al otro lado. Un
ETA directo avisaría al apoderado del alumno 3 con mucha anticipación. Con una sola consulta a
`computeRoutes` con las paradas como `intermediates` se obtiene la duración de cada tramo, y el ETA
de cada alumno es la suma de los tramos anteriores. Hay un test que cubre exactamente este caso.

**Control de costo:** la cota inferior (distancia acumulada en línea recta a 90 km/h) descarta
consultas cuando ninguna parada puede estar en su ventana. Además, el ETA se reutiliza durante
60 s o hasta que el furgón se mueve 300 m. Así hay como máximo ~1 consulta por minuto y solo
cuando el furgón está cerca de alguna casa.

## Escalera de llamadas

Cada intento elige su **canal**:

1. **App (sin costo).** Si el contacto tiene la app, el servidor envía una push de alta
   prioridad. La app la muestra como llamada y lee el mensaje con la voz del teléfono
   (`expo-speech`). La función `llamada-app` registra el acuse, la confirmación o el rechazo.
2. **Sin internet → teléfono (con costo).** Si el teléfono no acusa recibo en 15 s, se llama al
   mismo contacto por Twilio de inmediato, sin gastar el reintento. El resto de la escalera de
   ese contacto sigue por teléfono, porque ya sabemos que no tiene internet.
3. **Con internet pero sin respuesta** (30 s de timbre o colgó): cuenta como no contestada y la
   escalera sigue (reintento a los 30 s, luego el secundario).

La lógica está en `core/llamadas.ts` (`siguienteLlamada`, `vencimientoLlamadaApp`), con tests.

```
aviso ──▶ llamada 1 (principal) ──StatusCallback──▶ ¿presionó 1?
                                                    ├─ sí → fin, aviso confirmado
                                                    └─ no (no contestó / ocupado / buzón)
           llamada 2 (principal, +30 s) ◀───────────┘
           llamada 3 (secundario, inmediata)
           fin (agotado)
```

La escalera se detiene si:

- el apoderado presiona 1;
- el apoderado toca la notificación o el botón "Recibido" en la app;
- el conductor marca entregado o ausente;
- el recorrido termina.

Un número inválido (`failed`) no se reintenta. Cada intento es una fila en `llamadas`, con
`UNIQUE (aviso_id, intento)`. Las llamadas programadas se reclaman con
`UPDATE … FOR UPDATE SKIP LOCKED` para que se despachen una sola vez, aunque las despachen a la vez:

- el webhook de Twilio;
- un lote de posiciones;
- el cron.

## Modelo de datos

```
empresas ─┬─ perfiles (rol: admin | conductor | apoderado) ── dispositivos (tokens push)
          ├─ invitaciones (código → rol + empresa)
          ├─ furgones
          ├─ alumnos (minutos_aviso) ─┬─ apoderado_alumno ── perfiles
          │                           ├─ domicilios (lat/lng exactos del pin)
          │                           ├─ contactos (E.164, prioridad 1/2)
          │                           └─ inasistencias ("hoy no viaja": fecha + ida/vuelta/ambos)
          └─ rutas (ida | vuelta, conductor, furgón) ── ruta_paradas (orden, domicilio)

recorridos (una ejecución de una ruta) ─┬─ recorrido_alumnos (estado, eta_seg, marcado_en)
                                        ├─ posiciones (client_id único → idempotencia)
                                        └─ avisos (UNIQUE recorrido+alumno) ─┬─ envios_push
                                                                             └─ llamadas (escalera)
```

**Administración:**

```
empresas (mensualidad_defecto, dia_vencimiento) ─┬─ cobros (alumno, periodo, monto, estado, medio)
                                                 ├─ solicitudes (tipo, estado, resolución) ── solicitud_mensajes
                                                 └─ preguntas_frecuentes
invitaciones.alumno_id → el apoderado que se registra con ese código queda ligado al alumno
```

Las operaciones del administrador son RPC que exigen `requiere_admin()`. Las puede ejecutar el
`rol = admin` o una **conductora con `puede_administrar`** (la tía dueña del furgón). Ese permiso
solo lo cambia un administrador principal con `permitir_administrar`; la columna no es editable
desde la app. Las RPC son:

- `admin_crear_alumno`, `codigo_familia`, `mover_parada`;
- `generar_cobros`, `registrar_pago`, `anular_cobro`;
- `dar_de_baja`, `resolver_cancelacion`, `resumen_admin`.

El historial que pide el requerimiento sale directamente de estas tablas:

- hora del aviso: `avisos.disparado_en`;
- confirmación: `avisos.confirmado_en`;
- hora de entrega: `recorrido_alumnos.marcado_en`.

## Seguridad (RLS)

Las funciones `security definer` (`es_apoderado_de`, `es_conductor_de_recorrido`,
`puede_ver_ubicacion`, …) implementan las reglas y las políticas las usan. Las tablas de
operación (`recorridos`, `recorrido_alumnos`, `posiciones`, `avisos`, `llamadas`) no admiten
escrituras directas desde la app: se modifican solo con RPC que validan `auth.uid()` o con las
Edge Functions (service role). Todo esto está probado en `tests/sql/base-datos.test.ts`.
