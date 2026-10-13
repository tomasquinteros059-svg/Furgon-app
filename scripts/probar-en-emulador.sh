#!/usr/bin/env bash
# Prueba el APK en un emulador de Android (lo usa .github/workflows/probar-apk.yml):
# instala, entra con una cuenta y revisa que la app siga abierta. Deja capturas, el árbol de la
# pantalla y el logcat en ./prueba-emulador, y el resumen en $GITHUB_STEP_SUMMARY.
#
#   bash scripts/probar-en-emulador.sh <apk> <correo> <nombre>     (contraseña en CLAVE_CUENTAS_PRUEBA)
#
# Los registros de Actions son públicos: nunca se imprime la contraseña.
set -uo pipefail

APK="$1"; CORREO="$2"; NOMBRE="$3"
PAQUETE="cl.furgonapp.movil"
SALIDA="prueba-emulador/$NOMBRE"
RESUMEN="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
mkdir -p "$SALIDA"

paso() { echo "▶ $*"; }

# Textos visibles de la pantalla actual (para el resumen y para encontrar botones).
pantalla() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml "$SALIDA/$1.xml" >/dev/null 2>&1
  adb exec-out screencap -p > "$SALIDA/$1.png" 2>/dev/null
  echo "   [$1] $(textos "$1")"
}
textos() {
  python3 - "$SALIDA/$1.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
try:
    raiz = ET.parse(sys.argv[1]).getroot()
except Exception:
    print("(sin pantalla)"); sys.exit()
vistos = [n.get("text") or n.get("content-desc") for n in raiz.iter("node")]
print(" · ".join(t for t in vistos if t)[:600] or "(pantalla vacía)")
PY
}
# Centro del N-ésimo campo de texto, o del nodo cuyo texto coincide con alguno de los dados.
centro() {
  python3 - "$SALIDA/$1.xml" "$2" "${3:-}" <<'PY'
import re, sys, xml.etree.ElementTree as ET
raiz = ET.parse(sys.argv[1]).getroot()
modo, valor = sys.argv[2], sys.argv[3]
nodos = list(raiz.iter("node"))
if modo == "campo":
    nodos = [n for n in nodos if n.get("class") == "android.widget.EditText"]
    nodos = nodos[int(valor):int(valor) + 1]
else:
    textos = valor.split("|")
    nodos = [n for n in nodos if (n.get("text") or n.get("content-desc") or "").strip() in textos]
if not nodos: sys.exit(1)
# Con texto, el último que coincide: el título de la pantalla y el botón suelen decir lo mismo.
nodo = nodos[0] if modo == "campo" else nodos[-1]
x1, y1, x2, y2 = map(int, re.findall(r"\d+", nodo.get("bounds")))
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
}
escribir() { # adb input text no acepta espacios ni algunos símbolos sin escapar
  local t; t=$(printf '%s' "$1" | sed -e 's/[\\&|;<>()$`"'"'"' *?#~!]/\\&/g' -e 's/%/\\%/g')
  adb shell input text "$t"
}
viva() { adb shell pidof "$PAQUETE" >/dev/null 2>&1; }

adb logcat -c
paso "Instalar"
adb install -r "$APK" >/dev/null || { echo "### $NOMBRE: no se pudo instalar" >> "$RESUMEN"; exit 1; }
paso "Abrir"
adb shell monkey -p "$PAQUETE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 15
pantalla 1-inicio
INICIO=$(textos 1-inicio)

resultado="✅ siguió abierta"
if ! viva; then
  resultado="💥 se cerró al abrir"
else
  paso "Ingresar como $CORREO"
  if xy=$(centro 1-inicio campo 0); then
    adb shell input tap $xy; sleep 1; escribir "$CORREO"; adb shell input keyevent 111; sleep 1
    pantalla 2-correo
    xy=$(centro 2-correo campo 1) && { adb shell input tap $xy; sleep 1; escribir "$CLAVE_CUENTAS_PRUEBA"; adb shell input keyevent 111; sleep 1; }
    pantalla 3-datos
    if xy=$(centro 3-datos texto "Ingresar|Sign in"); then
      adb shell input tap $xy
    else
      resultado="⚠️ no encontré el botón Ingresar"
    fi
  else
    resultado="⚠️ no encontré el campo de correo"
  fi
  # Se revisa varias veces: el cierre puede llegar unos segundos después de entrar. Si aparece
  # una pregunta de permisos, se acepta como lo haría una persona.
  for i in $(seq 1 12); do
    sleep 5
    viva || { resultado="💥 se cerró después de ingresar (a los ~$((i * 5)) s)"; break; }
    pantalla "espera-$i" >/dev/null
    if xy=$(centro "espera-$i" texto "Allow|Permitir|While using the app|Mientras la app está en uso|Only this time"); then
      echo "   permiso aceptado: $(textos "espera-$i" | cut -c1-160)"
      adb shell input tap $xy
    fi
  done
fi
pantalla 4-final
FINAL=$(textos 4-final)

adb logcat -d > "$SALIDA/logcat.txt" 2>/dev/null
# Lo que explica un cierre: excepciones nativas (AndroidRuntime) y errores de JavaScript.
grep -nE "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|Hermes|TypeError|ReferenceError|Unhandled|Error:|Caused by|libc .*Fatal signal|DEBUG +: " \
  "$SALIDA/logcat.txt" | grep -v "ReactNativeJS: Running" | head -80 > "$SALIDA/errores.txt"

{
  echo "### $NOMBRE: $resultado"
  echo
  echo "- **Al abrir:** $INICIO"
  echo "- **Al final:** $FINAL"
  if [ -s "$SALIDA/errores.txt" ]; then
    echo
    echo '<details><summary>Errores del registro (logcat)</summary>'
    echo
    echo '```'
    cut -c1-400 "$SALIDA/errores.txt"
    echo '```'
    echo '</details>'
  fi
  echo
} >> "$RESUMEN"
echo "$NOMBRE: $resultado"
cat "$SALIDA/errores.txt"
adb shell am force-stop "$PAQUETE"
adb shell pm clear "$PAQUETE" >/dev/null 2>&1 || true
exit 0
