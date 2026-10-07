# Puesta en marcha: Supabase y Google Maps

Esta guía deja funcionando el backend real (base de datos, usuarios, avisos, rutas, cobros,
conexiones y familia compartida) y la clave de Google para el ETA con tráfico, la ruta por
calles y la ruta recomendada. Las apps de Android e iPhone vienen después.

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
   `trazado-ruta`, `recomendar-ruta`, `twilio-webhook`, `procesar-llamadas`);
4. escribe la URL y la *anon key* (valores públicos) en `apps/movil/.env` y `apps/admin/.env`.

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

## Qué queda para después

- **Android e iPhone**: claves de *Maps SDK for Android/iOS* restringidas a la app, proyecto de
  Expo/EAS para las notificaciones y compilar las apps de prueba.
- **Twilio** para las llamadas telefónicas con costo.
- **Correo propio** (SMTP) para confirmaciones y recuperación de contraseña.
