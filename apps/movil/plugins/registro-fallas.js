// Plugin de Expo: si la app se cae por un error NATIVO de Android (Java/Kotlin), antes de cerrarse
// guarda el detalle en `ultima-falla-nativa.txt` (carpeta de documentos de la app). Al volver a
// abrirla, src/lib/fallas.ts lo muestra en pantalla para que la persona mande una captura.
// Los errores de JavaScript los cubre src/lib/fallas.ts directamente.
const { withMainApplication } = require("expo/config-plugins");

const MARCA = "// registro-fallas";
const CODIGO = `
    ${MARCA}: guarda el error nativo antes de que Android cierre la app.
    val anteriorManejador = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { hilo, error ->
      try {
        java.io.File(filesDir, "ultima-falla-nativa.txt").writeText(
          java.util.Date().toString() + " (" + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL +
            ", Android " + android.os.Build.VERSION.RELEASE + ")\\n" + android.util.Log.getStackTraceString(error).take(6000)
        )
      } catch (_: Throwable) {}
      anteriorManejador?.uncaughtException(hilo, error)
    }
    // Cierres que el manejador de arriba no ve (código C++, «la app no responde», falta de memoria):
    // Android los anota y aquí se recupera el último, si fue una falla y es nuevo.
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      try {
        val am = getSystemService(android.app.ActivityManager::class.java)
        val salida = am.getHistoricalProcessExitReasons(packageName, 0, 1).firstOrNull()
        val prefs = getSharedPreferences("registro-fallas", MODE_PRIVATE)
        val graves = setOf(
          android.app.ApplicationExitInfo.REASON_CRASH, android.app.ApplicationExitInfo.REASON_CRASH_NATIVE,
          android.app.ApplicationExitInfo.REASON_ANR, android.app.ApplicationExitInfo.REASON_LOW_MEMORY,
          android.app.ApplicationExitInfo.REASON_INITIALIZATION_FAILURE
        )
        if (salida != null && salida.timestamp != prefs.getLong("visto", 0L) && salida.reason in graves) {
          prefs.edit().putLong("visto", salida.timestamp).apply()
          val archivo = java.io.File(filesDir, "ultima-falla-nativa.txt")
          if (!archivo.exists()) {
            val traza = try { salida.traceInputStream?.bufferedReader()?.use { it.readText().take(6000) } } catch (_: Throwable) { null }
            archivo.writeText(
              java.util.Date(salida.timestamp).toString() + " (" + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL +
                ", Android " + android.os.Build.VERSION.RELEASE + ")\\nmotivo " + salida.reason + ": " + salida.description + "\\n" + (traza ?: "")
            )
          }
        }
      } catch (_: Throwable) {}
    }`;

module.exports = function registroFallas(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(MARCA)) {
      if (!/super\.onCreate\(\)/.test(src)) throw new Error("registro-fallas: no encontré super.onCreate() en MainApplication");
      src = src.replace(/super\.onCreate\(\)/, (m) => m + CODIGO);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
