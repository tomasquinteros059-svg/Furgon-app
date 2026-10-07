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

Las operaciones del administrador son RPC que exigen `rol = admin` (`requiere_admin()`):

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
