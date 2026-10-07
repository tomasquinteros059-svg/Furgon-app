# 🚐 Furgón Escolar

App móvil que **avisa automáticamente al apoderado** cuando el furgón escolar está a ~5 minutos
de su casa, para que el conductor no tenga que llamar a nadie mientras maneja.

Cuando el ETA real con tráfico hasta la casa de un alumno entra en su ventana de aviso, el sistema:

1. envía una **notificación push con alarma** (canal de alarma en Android, *time-sensitive* en iOS), y
2. hace una **llamada automática** con voz en español:
   - **primero gratis, por internet, dentro de la app.** El mensaje de voz se genera en el
     propio teléfono de la mamá;
   - **si su teléfono no tiene internet** (no acusa recibo en 15 s), una **llamada telefónica
     normal** con Twilio, que tiene costo;
   - si nadie presiona 1, reintenta una vez y luego llama al contacto secundario. Un contacto
     sin la app recibe directamente la llamada telefónica.

El aviso es **único por alumno y recorrido**, sirve para la ida (que el alumno esté listo) y para la
vuelta (que alguien lo reciba).

> Estado: **prototipo**. La Fase 1 (MVP) y el backend de la Fase 2 (llamadas) están implementados.
> La Fase 3 (mapa en vivo para el apoderado, historial completo y panel de administración completo)
> está preparada en el modelo de datos y en la seguridad, pero sus pantallas aún no existen. Ver
> [Pendiente](#pendiente).

---

El sistema tiene dos aplicaciones:

- **App móvil** (Expo), con login por rol, para la tía del furgón (conductora) y para las familias.
- **App web de administración** (`apps/admin`), para el dueño del servicio:
  - alumnos, rutas y conductoras;
  - cobros de mensualidades;
  - solicitudes de las familias: preguntas, cancelaciones y cambios;
  - preguntas frecuentes;
  - costos de llamadas.

La tía solo instala la app y entra con su código: sus alumnos y el orden de su ruta los carga el
administrador. Si la tía es además la **dueña del furgón**, le das el permiso **"Administra"**
(*Conductoras*). Con él, desde su propia app:

- agrega alumnos (pin en el mapa y código para la familia);
- ordena sus rutas;
- registra pagos;
- responde las solicitudes, incluidas las cancelaciones.

También puede entrar al panel web con su cuenta. Esa sección **se bloquea mientras tiene un
recorrido en curso**, y el permiso solo lo da o lo quita el administrador principal. La ubicación del furgón es la del **celular de la tía**, así que no se necesita un
GPS aparte.

## Contenido

- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Configuración de claves (variables de entorno)](#configuración-de-claves-variables-de-entorno)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Simulador de recorrido](#simulador-de-recorrido)
- [App móvil](#app-móvil)
- [Tests](#tests)
- [Despliegue](#despliegue)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Pendiente](#pendiente)

El detalle del diseño (modelo de datos, flujo del disparo y decisiones) está en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Arquitectura

```
App (Expo, login por rol)                       Supabase
┌────────────────────────────┐   lotes de     ┌───────────────────────────────────────┐
│ Conductor: GPS 2º plano ───┼── posiciones ─▶│ Edge Function `posiciones`            │
│   cola SQLite (sin señal)  │   cada ~10 s   │   ETA con tráfico (Google/Mapbox)     │
│ Apoderado: alumnos, pin,   │                │   o geocerca de respaldo              │
│   "hoy no viaja", estado   │◀── push ───────│   → aviso único (UNIQUE en Postgres)  │
│ Admin: rutas, invitaciones │◀── Realtime ───│   → push (Expo) + llamada (Twilio)    │
└────────────────────────────┘                │ Postgres + RLS · Auth · pg_cron       │
                                              └───────────────────────────────────────┘
```

**Por qué el ETA se calcula en el servidor:**

- las claves de Google y Twilio nunca viajan en la app;
- la deduplicación es atómica en la base de datos;
- la regla se ajusta sin publicar una nueva versión de la app;
- queda un historial auditable de cada aviso.

Calcular en el teléfono no ahorraría nada: igual se necesita señal para avisar al apoderado.

## Estructura del repositorio

```
apps/admin/                      App web de administración (Vite + React + Supabase)
  src/datos/                     supabase.ts (real) y demo.ts (en memoria, para la demostración)
  src/paginas/                   Panel, Alumnos, Rutas, Conductoras, Cobros, Solicitudes, …
apps/movil/                      App Expo (SDK 57, expo-router)
  src/app/                       Pantallas: ingresar, registro, conductor/, apoderado/, admin/
  src/ubicacion/                 GPS en segundo plano, tarea, cola SQLite
  src/notificaciones.ts          Canal de alarma y token de push
supabase/
  migrations/                    Esquema, RLS, RPC, Realtime y retención (pg_cron)
  functions/
    _shared/core/                Lógica pura compartida (disparo, dedup, llamadas, cola…)
    _shared/                     Proveedores de ETA, push, Twilio, utilidades
    posiciones/                  Recibe posiciones y dispara avisos
    marcar-parada/               "Entregado"/"Ausente" + push de confirmación
    llamada-app/                 Acuse, confirmación o rechazo de la llamada gratis por la app
    trazado-ruta/                Ruta por calles (Google Routes) para el mapa de la conductora
    recomendar-ruta/             Orden recomendado de las paradas (distancia + Google Routes)
    twilio-webhook/              TwiML de la llamada, confirmación y estado
    procesar-llamadas/           Respaldo para despachar reintentos (cron)
tools/simulador/                 Demo de datos y recorrido con GPS falso
tests/                           Vitest: lógica crítica + SQL real sobre PGlite
docs/ARQUITECTURA.md             Diseño detallado
```

La lógica crítica (`supabase/functions/_shared/core`) es TypeScript sin dependencias. La misma
fuente la usan las Edge Functions (Deno), la app (Metro), el simulador (Node) y los tests.

## Configuración de claves (variables de entorno)

**Ninguna clave va en el código ni en el repositorio.** Cada componente lee las suyas desde
variables de entorno. Los archivos `.env` están en `.gitignore`. Cada componente tiene su
`.env.example` como plantilla.

| Variable | Dónde | Para qué |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Supabase las inyecta automáticamente. |
| `ETA_PROVEEDOR` | `supabase/functions/.env` | `google` \| `mapbox` \| `ninguno` (solo geocerca). |
| `GOOGLE_MAPS_API_KEY` | `supabase/functions/.env` | Clave **de servidor** con la *Routes API* habilitada. |
| `MAPBOX_ACCESS_TOKEN` | `supabase/functions/.env` | Si `ETA_PROVEEDOR=mapbox`. |
| `EXPO_ACCESS_TOKEN` | `supabase/functions/.env` | Opcional, solo si activas la seguridad reforzada de push en Expo. |
| `LLAMADAS_HABILITADAS` | `supabase/functions/.env` | `true` para activar las llamadas (Fase 2). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | `supabase/functions/.env` | Credenciales de Twilio. |
| `TWILIO_NUMERO_ORIGEN` | `supabase/functions/.env` | Número Twilio con voz, en formato E.164 (`+56…`). |
| `TWILIO_VOZ`, `TWILIO_IDIOMA` | `supabase/functions/.env` | Por defecto `Polly.Mia` / `es-MX`. |
| `FUNCTIONS_PUBLIC_URL` | `supabase/functions/.env` | URL pública de las funciones (Twilio la llama y la firma se valida contra ella). |
| `CRON_SECRET` | `supabase/functions/.env` | Protege `procesar-llamadas`. |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/movil/.env` | Valores **públicos**: quedan dentro de la app. |
| `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY` | `apps/movil/.env` | Maps SDK para el mapa del pin, restringidas al paquete y bundle de la app. |
| `EAS_PROJECT_ID` | `apps/movil/.env` | Necesario para el token de push de Expo. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `tools/simulador/.env` | La service role solo se usa para crear los datos de demo. |
| `DEMO_TELEFONO_PRINCIPAL`, `DEMO_TELEFONO_SECUNDARIO` | `tools/simulador/.env` | Tus teléfonos, para recibir las llamadas de prueba. |

### Cómo obtener cada clave

- **Supabase**: en *Project Settings → API* (en local, `supabase status`). La *service role key*
  salta el RLS: nunca la pongas en la app.
- **Google Maps Platform**: crea **dos claves**:
  1. una de **servidor** con *Routes API*, restringida por API, para `GOOGLE_MAPS_API_KEY`;
  2. una o dos de **app** con *Maps SDK for Android/iOS*, restringidas al paquete
     `cl.furgonapp.movil` y su huella SHA-1 o al bundle id.
- **Twilio**: el *Account SID* y el *Auth Token* están en la consola. Compra un número con
  capacidad de voz; para Chile puede requerir un *regulatory bundle*. En cuentas de prueba solo
  puedes llamar a números verificados.
- **Expo / EAS**: `npx eas-cli@latest init` dentro de `apps/movil` y copia el `projectId`.

En producción, los secretos de las funciones se cargan con:

```bash
supabase secrets set --env-file supabase/functions/.env
```

En EAS Build, define las variables de la app como *EAS environment variables* en lugar de subir el `.env`.

## Puesta en marcha local

Requisitos: Node 22+, Docker y la [CLI de Supabase](https://supabase.com/docs/guides/cli).

```bash
npm install

# 1) Backend local (Postgres, Auth, Realtime, Edge Functions)
supabase start
supabase db reset                       # aplica supabase/migrations
cp supabase/functions/.env.example supabase/functions/.env   # y complétalo
supabase functions serve --env-file supabase/functions/.env

# 2) Datos de demo (empresa, admin, conductor, 2 apoderados, 3 alumnos, rutas de ida y vuelta)
cp tools/simulador/.env.example tools/simulador/.env          # con los valores de `supabase status`
npm run demo:preparar
```

Para probar las llamadas en local, Twilio necesita llegar a tu máquina. Expón el puerto 54321 con
un túnel (`ngrok http 54321` o `cloudflared`) y define `FUNCTIONS_PUBLIC_URL=https://<tunel>/functions/v1`.

## Mapas (Google Maps)

- **App móvil:** usa Google Maps en Android y en iOS (`react-native-maps` con `PROVIDER_GOOGLE`;
  las claves `GOOGLE_MAPS_ANDROID_API_KEY` / `GOOGLE_MAPS_IOS_API_KEY` habilitan *Maps SDK for
  Android/iOS*). La conductora ve:
  - su furgón escolar amarillo en la posición del GPS de su celular;
  - las casas numeradas, que cambian de color al avisar y al entregar;
  - el tráfico en vivo;
  - la ruta por calles, calculada en el servidor por `trazado-ruta` con Routes API y la misma
    `GOOGLE_MAPS_API_KEY` del ETA.
  El botón **"Navegar con Google Maps"** abre la navegación paso a paso hacia la próxima casa.
- **Maqueta `docs/perfil-tia-del-furgon.html`:** la tía no ingresa ninguna clave: Google Maps lo
  conecta la empresa. Para probar la maqueta con Google se abre con `?gmaps=CLAVE` (necesita
  *Maps JavaScript API* y *Directions API*, restringida por sitio web); sin eso se muestra el
  mapa dibujado con el mismo furgón.

## App web de administración

```bash
cp apps/admin/.env.example apps/admin/.env   # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (públicas)
npm run admin                                # http://localhost:5173
npm run admin:demo                           # genera docs/app-administracion.html con datos de ejemplo
```

Sin las variables de entorno, la app arranca en **modo demostración** con datos en memoria.
Solo pueden entrar cuentas con rol `admin`. Para producción, `npm run build --workspace=apps/admin`
genera `apps/admin/dist`, un sitio estático que se puede publicar en Vercel, Netlify o Cloudflare Pages.

**Cómo se agrega un alumno de la tía:**

1. En *Alumnos → Agregar alumno* completas los datos, la casa (búsqueda de dirección y pin en el
   mapa), los teléfonos, la mensualidad y la ruta.
2. El alumno aparece de inmediato en la ruta de la tía, al final. El orden se ajusta en *Rutas*
   con ↑ y ↓.
3. Se genera un **código para la familia**, con el mensaje listo para copiar o enviar por
   WhatsApp. Al registrarse con ese código, el apoderado queda ligado al alumno sin cargar nada más.

| Sección | Qué hace |
|---|---|
| Panel | Pendientes del día (solicitudes, alumnos sin ruta, familias sin app, morosos), recorridos de hoy, cobranza y llamadas del mes. |
| Alumnos | Alta completa con pin en el mapa, ficha editable, código para la familia y baja. |
| Rutas | Conductora asignada, orden de paradas, agregar y quitar alumnos. **✨ Recomendar ruta** calcula el orden más corto con las direcciones de los alumnos (mapa, km ahorrados y "antes N°"); se aplica con un toque. **Hoy no va** saca a un alumno solo de la ruta de hoy. |
| Conductoras | Invitación con código; la tía solo instala la app. Permiso **Administra** para la tía dueña del furgón. |
| Cobros | La contabilidad de la tía. Genera las mensualidades del mes (idempotente), registra pagos (medio y nota), **cambia el monto** de un cobro pendiente, anula cobros y muestra los vencidos. En **Precios** se edita el precio mensual de cada alumno (también ajusta sus cobros pendientes). |
| Solicitudes | Bandeja de preguntas, reclamos, cambios y **cancelaciones**. Al aprobar una cancelación, el alumno se da de baja: sale de las rutas y se anulan sus cobros futuros. |
| Preguntas frecuentes | Las familias las ven en *Ayuda* de la app. |
| Llamadas y costos | Llamadas por la app (gratis) y telefónicas (con costo), con minutos y costo estimado. |
| Configuración | Nombre de la empresa, teléfono de contacto, mensualidad por defecto y día de vencimiento. |

En la app móvil, las familias tienen **Pagos** (sus mensualidades) y **Ayuda** (preguntas
frecuentes, consultas, solicitud de cancelación y la conversación con la administración).

## Simulador de recorrido

El simulador recorre una ruta falsa y envía posiciones como lo haría el teléfono del conductor:
usa la misma cola, los mismos lotes y reenvía tras perder señal. Al llegar a cada casa marca
"entregado".

```bash
npm run simular -- --seco                       # sin backend: misma lógica de disparo en memoria
npm run simular -- --tipo vuelta --acelerar 4   # contra Supabase, 4× más rápido
npm run simular -- --tipo ida --sin-senal 120-300
npm run simular -- --archivo mi-ruta.geojson    # LineString propia (p. ej. exportada de Google My Maps)
```

Opciones: `--velocidad <km/h>`, `--intervalo <s>`, `--detencion <s>`, `--no-entregar`. Ver
`tools/simulador/src/simular.ts`.

**Prueba completa con teléfonos:**

1. Ejecuta `npm run demo:preparar`.
2. Inicia sesión en la app como `apoderado1@demo.furgon.app` (contraseña `demo-furgon-2026`).
3. Ejecuta `npm run simular -- --tipo vuelta --acelerar 3`.

Cuando el furgón virtual esté a 5 minutos, ese teléfono recibe la alarma (y la llamada, si
configuraste Twilio y `DEMO_TELEFONO_*`). En paralelo puedes abrir la app como
`conductor@demo.furgon.app` y ver el recorrido en curso.

## App móvil

El GPS en segundo plano y las push remotas **no funcionan en Expo Go**: se necesita un
*development build*.

```bash
cd apps/movil
cp .env.example .env                    # URL y anon key de Supabase, claves de Maps, EAS_PROJECT_ID
npx expo run:android                    # o: npx eas-cli@latest build --profile development
npx expo start --dev-client
```

| Rol | Puede |
|---|---|
| **Conductor** | Inicia y finaliza recorridos y ve la lista ordenada. Marca "Subió" / "En su hogar" o "Ausente" con un toque (botones grandes) y ve cuando una familia confirmó que su hijo subió. Comparte el GPS solo mientras hay un recorrido activo. En **Conexiones** (`conductor/conexiones`) decide si aparece en la búsqueda de las familias, busca a una familia por correo o teléfono exactos para invitarla y acepta o rechaza solicitudes. |
| **Apoderado** | Se registra con un código de invitación **o sin código** ("Soy familia y no tengo código") y luego se conecta con su tía o tío desde la búsqueda (`apoderado/conectar`: nombre, furgón o comuna). **Perfil compartido (dúo):** en *Familia* (`apoderado/familia`) la mamá comparte a sus hijos con el papá (o un abuelo/a) con un código de un solo uso; cada uno entra con su cuenta y ambos reciben la alarma y las llamadas, siguen el furgón y marcan «Ya subió» u «hoy no viaja». Puede estar conectado con varias tías (hermanos en furgones distintos) y elige con quién va cada hijo al registrarlo. Recibe la alarma, toca **"Ya subió"** para seguir a su hijo en vivo mientras va a bordo, sigue al furgón en un **mapa en vivo** (`apoderado/seguir/[id]`), confirma "recibido", marca "hoy no viaja" y elige los minutos de aviso. |
| **Administrador** | Usa solo la **app web** (`apps/admin`). Si entra a la app móvil, ve un aviso con el enlace al panel (`EXPO_PUBLIC_PANEL_URL`). |

Los usuarios se registran con un **código de invitación** que entrega el administrador. El código
fija el rol y la empresa: nadie puede elegir ser conductor o admin por su cuenta.

## Tests

```bash
npm test          # Vitest
npm run typecheck
```

- `tests/disparo.test.ts`: cálculo del disparo. Cubre:
  - la ventana de aviso y los minutos por alumno;
  - el ETA acumulado por la ruta (en la ida, una casa cercana que viene después no se avisa antes);
  - el respaldo por geocerca y la proximidad;
  - las posiciones viejas;
  - el control de consultas a la API.
- `tests/flujo-aviso.test.ts`: el flujo completo con dobles. Comprueba:
  - un solo aviso aunque el furgón entre y salga del radio o lleguen lotes concurrentes;
  - la caída al respaldo cuando la API falla, tarda o responde basura.
- `tests/llamadas.test.ts`: la escalera de reintentos. Principal → reintento a los 30 s →
  secundario; un buzón de voz no cuenta como contestada; los números inválidos no se reintentan.
- `tests/utilidades.test.ts`: teléfonos E.164, firma de Twilio, TwiML, mensajes y la cola sin señal.
- `tests/recomendar-ruta.test.ts`: la ruta recomendada (ida termina en el colegio, vuelta parte
  de él, óptimo exacto hasta 8 casas comparado con fuerza bruta, heurística con 12 casas, no
  cambia el orden por menos de 50 m).
- `tests/sql/familia-compartida.test.ts`: perfil de familia compartido (el papá se registra o se
  une con el código de la mamá y ve a los mismos hijos, su teléfono entra a la llamada
  automática, código de un solo uso, solo se comparten hijos propios, dejar de compartir).
- `tests/sql/a-bordo-y-conexiones.test.ts`: «Ya subió» (en la vuelta, seguimiento exacto solo
  desde que subió y hasta su hogar; en la ida, solo con el furgón a menos de 300 m de la casa o
  marcado por la tía) y las conexiones (registro sin código, búsqueda solo de tías visibles,
  búsqueda de familias solo por correo o teléfono exactos, aceptar/rechazar, no insistir tras un
  rechazo, familias con dos furgones).
- `tests/sql/rutas-y-precios.test.ts`: aplicar el orden recomendado, «hoy no va» marcado por la
  tía (el recorrido en curso se lo salta), precios y montos editables.
- `tests/sql/administracion.test.ts`: cubre la administración:
  - alta de alumnos con código para la familia;
  - vínculo automático del apoderado;
  - reordenar paradas;
  - cobros idempotentes y pagos;
  - que la familia no pueda tocar la mensualidad;
  - la cancelación aprobada (baja, fuera de la ruta y cobros futuros anulados);
  - preguntas frecuentes publicadas y el resumen del panel.
- `tests/sql/base-datos.test.ts`: aplica **las migraciones reales en Postgres (PGlite)** y prueba:
  - el registro con invitación;
  - el RLS (cada apoderado ve solo a sus hijos y el conductor no ve teléfonos);
  - la deduplicación atómica de `registrar_aviso`;
  - que la ubicación sea visible solo dentro de la ventana permitida;
  - el despacho único de llamadas.

Para revisar los tipos de las Edge Functions: `cd supabase/functions && deno check */index.ts`.

## Despliegue

```bash
supabase link --project-ref <ref>
supabase db push
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy posiciones marcar-parada llamada-app trazado-ruta recomendar-ruta twilio-webhook procesar-llamadas
```

`twilio-webhook` y `procesar-llamadas` se despliegan sin verificación de JWT (ver `supabase/config.toml`):

- el primero valida la firma `X-Twilio-Signature`;
- el segundo exige el header `x-cron-secret`.

Los reintentos de llamada se despachan desde el webhook de estado de Twilio y con cada lote de
posiciones. Como respaldo opcional, programa `procesar-llamadas` cada minuto con `pg_cron` + `pg_net`:

```sql
select cron.schedule('furgon-procesar-llamadas', '* * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/procesar-llamadas',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
  )
$$);
```

**Publicación en tiendas:**

- **Google Play**: exige declarar el uso de ubicación en segundo plano y el *foreground service*
  de ubicación, con un video que muestre la función.
- **App Store**: revisa el texto de los permisos.
- **Critical Alerts (iOS)**: para que la alarma suene incluso en modo silencio hay que solicitar
  el *entitlement* a Apple; mientras tanto se usa `time-sensitive`.

## Privacidad y seguridad

Se trata de datos de menores. Las reglas viven en la base de datos (RLS), no solo en la app:

- **Rastreo acotado.** El GPS existe solo durante un recorrido activo. Al finalizar, el teléfono
  detiene la tarea. Si el conductor olvida cerrar, un job de `pg_cron` finaliza el recorrido tras
  30 min sin posiciones, y el teléfono se apaga al recibir `409`.
- **Mapa en vivo tipo Uber con privacidad.** Durante todo el recorrido, el apoderado ve una **zona
  aproximada** del furgón (~1 km), las paradas que faltan antes de su casa y el ETA. **Desde el
  aviso de su hijo hasta la entrega** ve el furgón **exacto** y el trayecto recorrido desde ese
  momento: las posiciones anteriores al aviso le siguen ocultas. Así no puede deducir dónde viven
  los demás niños. El conductor y el admin ven la ubicación solo mientras el recorrido está activo.
  La última posición del recorrido no es legible por columna.
- **Mínimo acceso.**
  - Cada apoderado ve solo a sus hijos.
  - El conductor ve nombres y direcciones de su ruta, pero **no los teléfonos**.
  - Las escrituras sensibles pasan por RPC que validan el rol.
- **Retención.** Las posiciones crudas se borran a los 30 días. Se conserva el historial de avisos y entregas.
- **Cifrado.** Todo el tráfico es HTTPS y Supabase cifra los datos en reposo. Los secretos solo
  van en variables de entorno.

## Pendiente

- **Fase 3**:
  - pantalla de historial de recorridos y avisos (los datos ya se guardan);
  - panel de administrador completo (furgones, conductores, reordenar paradas).
- Probar en dispositivos reales:
  - la ubicación en segundo plano en Android con ahorro de batería agresivo (Xiaomi, Huawei,
    Samsung), y guiar al conductor para excluir la app de la optimización;
  - el comportamiento en iOS con la app cerrada.
- Llamada gratis con pantalla de llamada nativa con la app cerrada (CallKit + PushKit en iOS,
  ConnectionService en Android). Esto requiere un módulo nativo (p. ej. `react-native-callkeep`).
  Hoy llega como notificación de alarma con botones "Confirmar (1)" / "No puedo", y con la app
  abierta se muestra la pantalla de llamada con voz.
- El acuse de recibo en segundo plano depende de que el sistema despierte la app. Si no la
  despierta, el servidor asume que no hay internet y hace la llamada telefónica: falla hacia el
  lado seguro, a costa de algunas llamadas pagadas de más.
- Inicio de sesión por SMS (OTP) en lugar de correo y contraseña.
- Que las Edge Functions se ejecuten contra un Supabase real: en este prototipo pasan `deno check`,
  pero no se han ejecutado contra un proyecto.
