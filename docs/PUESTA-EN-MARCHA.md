# Puesta en marcha: Supabase y Google Maps

Esta guía deja funcionando el backend real (base de datos, usuarios, avisos, rutas, cobros,
conexiones y familia compartida) y la clave de Google para el ETA con tráfico, la ruta por
calles y la ruta recomendada (pasos 1–6). Luego las llamadas con Twilio (7), las apps de
Android e iPhone (8), el panel web en internet (9) y las tiendas (10).

> **Regla de oro:** las claves secretas nunca se pegan en un chat, un correo ni el código.
> Se guardan como variables de entorno (en la configuración del entorno de Claude Code, en
> tu computador o en Supabase).

## 1. Supabase (≈ 10 min)

1. Entra a <https://supabase.com> y crea una cuenta (puede ser con GitHub).
2. **New project**:
   - *Name*: `furgon-app`
   - *Database password*: genera una y guárdala en tu gestor de contraseñas.
   - *Region*: **South America (São Paulo)** — la más cercana a Chile.
   - Plan *Free* para el piloto.
3. Anota el **Project ref**: es el código de la URL del proyecto
   (`https://supabase.com/dashboard/project/`**`abcdefghijklmnop`**). No es secreto.
4. Crea un **Access token** (es secreto): avatar → *Account preferences* → *Access Tokens* →
   *Generate new token*, nombre `furgon-despliegue`. Cópialo una sola vez a tu gestor.

## 2. Google Maps Platform (≈ 15 min)

1. Entra a <https://console.cloud.google.com> y crea un proyecto `furgon-app`.
2. **Facturación**: Google exige una tarjeta, pero incluye un crédito mensual gratis que
   alcanza para un piloto. Configura además un **presupuesto con alerta** (Facturación →
   Presupuestos y alertas), por ejemplo USD 20.
3. **APIs y servicios → Biblioteca**: habilita **Routes API**.
   (Para las apps se habilitarán después *Maps SDK for Android* y *Maps SDK for iOS*.)
4. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**:
   - Nombre: `furgon-servidor`.
   - *Restricciones de aplicación*: **Ninguna** (la usa el servidor de Supabase, que no tiene IP fija).
   - *Restricciones de API*: **Restringir clave → Routes API**.
   - Copia la clave (es secreta).

## 3. Dónde dejar las claves

Para que Claude Code despliegue desde la nube, en la configuración del entorno (menú del
entorno en la barra de título de la sesión → *Edit*):

| Qué | Dónde | Valor |
|---|---|---|
| Acceso de red | *Network access* → dominios permitidos | `api.supabase.com` y `*.supabase.co` |
| Variable | Variables de entorno / secretos | `SUPABASE_PROJECT_REF` = el *Project ref* |
| Secreto | Variables de entorno / secretos | `SUPABASE_ACCESS_TOKEN` = el *Access token* |
| Secreto | Variables de entorno / secretos | `GOOGLE_MAPS_API_KEY` = la clave `furgon-servidor` |

Los cambios del entorno los toma una **sesión nueva**: abre una y pide «despliega Supabase».

Si prefieres hacerlo en tu computador (Node 20 o más reciente):

```bash
export SUPABASE_PROJECT_REF=abcdefghijklmnop
export SUPABASE_ACCESS_TOKEN=…        # no lo guardes en archivos del repositorio
export GOOGLE_MAPS_API_KEY=…
```

## 4. Desplegar

```bash
npm run verificar-google               # prueba la clave: ETA con tráfico y ruta optimizada
npm run desplegar -- --sin-confirmar-correo
```

`desplegar` hace, en orden y sin repetir lo ya hecho:

1. aplica las migraciones de `supabase/migrations` (tablas, seguridad RLS, funciones);
2. carga los secretos de las funciones (clave de Google, `ETA_PROVEEDOR=google`, un
   `CRON_SECRET` aleatorio, `LLAMADAS_HABILITADAS=false` hasta configurar Twilio);
3. despliega las Edge Functions (`posiciones`, `marcar-parada`, `llamada-app`,
   `trazado-ruta`, `recomendar-ruta`, `avisos-licencias`, `eliminar-cuenta`, `twilio-webhook`, `procesar-llamadas`);
4. escribe la URL y la *anon key* (valores públicos) en `apps/movil/.env` y `apps/admin/.env`.
5. programa con `pg_cron` los avisos diarios de vencimiento de licencias y el respaldo de
   reintentos de llamadas (el secreto queda en el Vault de Supabase).

`--sin-confirmar-correo` evita que las familias tengan que confirmar su correo durante el
piloto. Quítalo cuando configures el correo de la app.

## 5. Tu cuenta de administrador

1. En Supabase: **Authentication → Users → Add user → Create new user**, con tu correo y una
   contraseña, y marca **Auto Confirm User**. (Así la contraseña no pasa por ningún chat.)
2. Crea la empresa y dale el rol:

```bash
# Administrador del panel web:
npm run crear-empresa -- --empresa "Furgones Tía Marcela" --admin tu@correo.cl
# o, si la cuenta es de la tía dueña del furgón (conduce y administra):
npm run crear-empresa -- --empresa "Furgones Tía Marcela" --tia tia@correo.cl
```

## 6. Probar el panel web con datos reales

```bash
npm install
npm run admin          # http://localhost:5173 — usa apps/admin/.env (escrito en el paso 4)
```

Entra con tu cuenta, agrega una conductora (código de invitación), alumnos y rutas.
Publicarlo en internet (Vercel o Netlify) es un paso aparte.

### Cuentas de prueba para las tiendas

Google Play y App Store piden una cuenta para revisar la app. Usa dos correos tuyos que no sean
tus cuentas personales (por ejemplo `revision.tia@…` y `revision.familia@…`):

```bash
npm run cuentas-revision -- --tia revision.tia@tudominio.cl --familia revision.familia@tudominio.cl
```

Crea un servicio de demostración (tía con licencia al día, furgón, rutas «Mañana» y «Tarde» y una
familia con dos hijos) y muestra contraseñas nuevas una sola vez, para copiarlas en cada tienda.

## 7. Llamadas telefónicas con Twilio (≈ 20 min, con costo)

Sin este paso igual funcionan la alarma y la llamada gratis por la app. Twilio solo hace la
llamada telefónica cuando el teléfono de la familia no tiene internet.

1. Crea una cuenta en <https://www.twilio.com> y carga saldo (la cuenta de prueba solo llama a
   números verificados, sirve para probar con tu propio teléfono).
2. Compra un **número con voz** (*Phone Numbers → Buy a number*, capacidad *Voice*). Anótalo en
   formato `+56…` o el país que ofrezca.
3. En la consola de Twilio copia **Account SID** y **Auth Token** (secreto).
4. Agrégalos al entorno (igual que en el paso 3) y vuelve a desplegar:

| Variable | Valor |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID |
| `TWILIO_AUTH_TOKEN` | Auth Token (secreto) |
| `TWILIO_NUMERO_ORIGEN` | el número comprado, p. ej. `+56221234567` |
| `LLAMADAS_HABILITADAS` | `true` |

```bash
npm run desplegar
```

No hay que configurar nada en el número de Twilio: cada llamada le indica a Twilio la URL de
`twilio-webhook`, y el webhook valida la firma de Twilio.

## 8. Apps de Android e iPhone (≈ 1 h, la primera vez)

1. **Expo / EAS**: crea una cuenta en <https://expo.dev>, y en `apps/movil` ejecuta
   `npx eas-cli login` y `npx eas-cli init`. Copia el *project ID* a `EAS_PROJECT_ID` en
   `apps/movil/.env` (necesario para las notificaciones y la llamada por la app).
2. **Google Maps en las apps**: en Google Cloud habilita *Maps SDK for Android* y
   *Maps SDK for iOS* y crea dos claves nuevas:
   - `furgon-android`: restringida a apps Android, paquete `cl.furgonapp.movil` y la huella
     SHA-1 que muestra `npx eas-cli credentials`;
   - `furgon-ios`: restringida a apps iOS, bundle `cl.furgonapp.movil`.

   Ponlas en `GOOGLE_MAPS_ANDROID_API_KEY` y `GOOGLE_MAPS_IOS_API_KEY` de `apps/movil/.env`.
3. **Android** (gratis para probar): `npx eas-cli build --profile development --platform android`
   genera un APK que se instala con el enlace o código QR que entrega EAS.
4. **iPhone**: requiere la **Apple Developer Program** (USD 99 al año). Luego
   `npx eas-cli device:create` (registra tu iPhone) y
   `npx eas-cli build --profile development --platform ios`.
5. **Notificaciones**: en Android, EAS pide subir la clave de Firebase (FCM v1); en iOS crea la
   clave de push automáticamente. `npx eas-cli credentials` guía ambos pasos.
6. Prueba en teléfonos reales: el recorrido con la app en segundo plano (ubicación), la alarma
   con el teléfono bloqueado y la llamada gratis. En Android de Xiaomi, Huawei o Samsung, saca la
   app de la optimización de batería.

## 9. Publicar el panel web (≈ 15 min)

1. Crea una cuenta en <https://vercel.com> (o Netlify) e importa el repositorio de GitHub.
2. *Root directory*: `apps/admin`; *Build command*: `npm run build`; *Output*: `dist`.
3. Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (las de `apps/admin/.env`; son públicas).
4. Pon la dirección resultante en `EXPO_PUBLIC_PANEL_URL` de `apps/movil/.env`.
5. En Supabase, *Authentication → URL Configuration*, agrega esa dirección como *Site URL*.

## 10. Publicar en las tiendas

1. **Google Play**: cuenta de desarrollador (USD 25, pago único). `npx eas-cli build --profile
   production --platform android` y `npx eas-cli submit --platform android`. Requiere política de
   privacidad publicada y justificar la **ubicación en segundo plano** (video corto del uso).
2. **App Store**: con la cuenta de Apple, `npx eas-cli build --profile production --platform ios`
   y `npx eas-cli submit --platform ios`; luego TestFlight para probar con familias reales y
   enviar a revisión.

## Qué queda para después

- **Correo propio** (SMTP) para confirmaciones y recuperación de contraseña.
