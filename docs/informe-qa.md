# Informe de QA — Furgón Escolar

Fecha: 9 de octubre de 2026 · Rama `ccr-56babac3-pakmvc`

## Cómo se hizo

1. **Pruebas automáticas**: 193 tests (23 archivos), revisión de tipos de las tres apps,
   compilación del panel web y de la app de Android, revisión de las 9 funciones del servidor y
   de las traducciones.
2. **Revisión a fondo en 5 frentes** (en paralelo): app de las familias, app de la tía, panel web
   probado en el navegador (cada sección y acción, español/inglés, claro/oscuro, computador y
   celular), funciones del servidor y lógica de la base de datos.
3. Cada hallazgo se verificó en el código; los de la base de datos se reprodujeron con tests antes
   de corregirlos.

## Resultado final

| Revisión | Resultado |
|---|---|
| Tests | 193 de 193 ✓ |
| Tipos (proyecto, app, panel) | sin errores ✓ |
| Compilación panel web y app Android | ✓ |
| Funciones del servidor (9) | ✓ |
| Traducciones (1.073 textos) | 0 faltantes ✓ |
| Panel en el navegador | sin errores de página ni desbordes en celular ✓ |
| Maquetas y páginas públicas | sin errores ni enlaces rotos ✓ |

## Lo que se encontró y se corrigió (más de 40 problemas)

### Graves
- **App de la tía — GPS tras reiniciar el teléfono**: si el teléfono se reiniciaba o se cerraba la
  app en medio del recorrido, el GPS no se reanudaba y las familias no recibían avisos.
- **App de las familias — el teléfono seguía recibiendo alarmas después de «Salir»**.
- **Servidor — llamadas que quedaban «en curso» para siempre** y cortaban la escalera de llamadas
  de esa familia.
- **Panel — no había cómo agregar un alumno** desde el menú (ahora: botones en Furgones).

### Importantes
- App de la tía: sin señal se borraba la lista de paradas; «Finalizar» podía fallar sin avisar y
  perder las últimas posiciones; un alumno nuevo quedaba en las rutas de otras tías; faltaba
  cómo cobrar a alumnos que llegan a mitad de mes; fechas en UTC.
- App de las familias: cambiar el tema o el idioma recargaba la sesión; una llamada podía abrir
  dos pantallas; validar el código mientras se escribe gastaba los intentos y mostraba un error
  equivocado; parpadeo de «Cuenta sin perfil».
- Servidor: confirmar tarde una llamada por la app no detenía las llamadas telefónicas; un
  fallo en un aviso de licencia cortaba los demás; el idioma del contacto no se encontraba;
  la cercanía avisaba a casas que venían mucho después en la ruta; sin tiempo límite con
  Twilio, Expo y Google.
- Base de datos: «Hoy no va» con día completo y un tramo; la tía podía revivir un «hoy no
  viaja»; doble toque al iniciar; recorridos de días anteriores; avisos y llamadas para niños ya
  atendidos; fechas en UTC en bajas y resumen; cobros de meses pasados; eliminar cuenta dejaba
  cobros futuros; dos familiares saliendo a la vez.
- Panel: editar un furgón tomaba rutas de otro furgón con el mismo nombre y borraba su
  descripción; paradas ilegibles en el celular; acciones sin confirmación; teléfonos que se
  podían perder al guardar; botones que fallaban sin mostrar el error.

## Pendiente (menor, decidido no corregir ahora)

| Tema | Por qué |
|---|---|
| Si el teléfono cambia solo a modo oscuro con el tema en «Automático», la app vuelve al inicio | Poco frecuente; arreglarlo exige rehacer cómo se aplican los colores |
| Teléfonos de contacto sin verificar por SMS | Tiene costo por mensaje; decidir junto con Twilio |
| Recibos de Expo (limpieza de teléfonos desinstalados) | Solo ordena la base; no afecta avisos |
| La demo del panel difiere en detalles del servidor real (datos de ejemplo en español) | Solo afecta la demostración |

## Lo que solo se puede probar con los servicios reales

Nada de esto se ha ejecutado aún contra Supabase, Google, Twilio ni en un teléfono. Al desplegar
conviene probar: un recorrido completo con la app en segundo plano, la alarma con el teléfono
bloqueado, la llamada por la app y la telefónica, y el panel con datos reales.
