# Furgón Escolar — guía para Claude Code

App chilena para furgones escolares: la tía o el tío del furgón inicia el recorrido y las familias
reciben una alarma (y una llamada) minutos antes de que llegue, siguen el furgón en vivo y marcan
«Hoy no va» / «Ya subió». El dueño del servicio administra furgones, rutas, cobros y licencias en
un panel web.

El dueño del proyecto habla español y no es programador: respóndele en español, en simple, con
pasos concretos y enlaces exactos. Nunca le pidas claves, tokens ni contraseñas por el chat: van
en las variables del entorno de Claude Code (claude.ai/code → ícono ☁️ sobre el cuadro de mensajes
→ ⚙️) o en cada servicio.

## Estructura

| Carpeta | Qué es |
|---|---|
| `apps/movil` | App Expo (SDK 57, expo-router) para tía y familias; una sola app, el rol decide las pantallas |
| `apps/admin` | Panel web (Vite + React). `npm run build:demo` genera `docs/app-administracion.html` con datos de ejemplo |
| `supabase/migrations` | Esquema, RLS y funciones SQL. Se aplican en orden; la última `create or replace` gana |
| `supabase/functions` | Edge Functions (Deno): posiciones, avisos, llamadas (Twilio), rutas (Google Routes), licencias, eliminar cuenta |
| `idiomas/` | Traducciones: el texto en español es la clave, `t("…")`; diccionarios en `idiomas/en/` |
| `diseno/` | Colores (70 % blanco, 20 % amarillo, 10 % gris; modo oscuro) e íconos propios (`iconos.ts`) |
| `tests/` | Vitest; `tests/sql` corre las migraciones reales en PGlite |
| `scripts/` | Despliegue y utilidades (ver abajo) |
| `docs/` | Guías (`PUESTA-EN-MARCHA.md`), tareas del dueño (`tus-tareas.html`), maquetas, ficha de tiendas, informe de QA |

## Comandos

```bash
npm test                      # 193+ tests (incluye SQL en PGlite y traducciones)
npm run idiomas               # textos sin traducir
npx tsc --noEmit -p tsconfig.json && (cd apps/movil && npx tsc --noEmit) && (cd apps/admin && npx tsc --noEmit -p .)
npm run desplegar -- --sin-confirmar-correo   # Supabase: migraciones, secretos, funciones, cron (SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN)
npm run verificar-google      # prueba GOOGLE_MAPS_API_KEY
npm run crear-empresa -- --empresa "Nombre" --tia correo   # o --admin correo
npm run cuentas-revision -- --tia correo --familia correo  # cuentas de prueba con datos de ejemplo
npm run compilar-app -- --plataforma android --perfil preview   # APK en EAS (EXPO_TOKEN)
```

## Reglas del proyecto

- Todo texto visible va con `t("texto en español")` y su traducción en `idiomas/en/*.ts`;
  `tests/idiomas.test.ts` falla si falta alguna. Datos guardados (nombres, notas) no se traducen.
- Cambios de base de datos: migración nueva en `supabase/migrations` (no editar las ya desplegadas)
  y test en `tests/sql`. Funciones `security definer` siempre con `set search_path = ''`.
- Fechas de negocio en hora de Chile (`public.hoy_empresa()`), nunca `current_date` UTC.
- Privacidad: la ubicación exacta del furgón solo durante el recorrido y nunca cerca de la casa
  de otro niño (`puede_ver_posicion`, `cerca_de_otra_casa`).
- Antes de subir: tests, tipos y `npm run idiomas` en verde.

## Estado (octubre 2026)

- Código completo y revisado (seguridad + QA, ver `docs/informe-qa.md`). Nada desplegado aún.
- Pendiente del dueño (ver `docs/tus-tareas.html`): proyecto Supabase, tokens de Supabase y Expo,
  clave de Google Maps, Firebase (la creación de claves de cuenta de servicio está bloqueada por
  la política de su organización de Google Cloud), Twilio (opcional), Vercel, tiendas, dirección
  y razón social de la empresa para `apps/admin/public/privacidad.html` y `terminos.html`.
- Siguiente paso técnico: con las claves en el entorno, `npm run desplegar`, crear cuentas de
  revisión y compilar el APK de Android con `npm run compilar-app`.
- Sugerido: optimizar las consultas a Google Routes (hoy cada 60 s por recorrido; consultar solo
  cuando falten menos de ~15 min para un aviso) para bajar el costo.
