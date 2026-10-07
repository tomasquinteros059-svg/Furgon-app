// Normalización de teléfonos a formato E.164 (por defecto Chile, +56).

/**
 * Convierte lo que escribe el usuario a E.164. Devuelve null si no es válido.
 * Acepta: "+56 9 1234 5678", "56912345678", "912345678", "9 1234 5678", "(2) 2345 6789".
 */
export function normalizarTelefono(entrada: string, codigoPais = "56"): string | null {
  const limpio = entrada.trim().replace(/[\s().-]/g, "");
  if (limpio === "") return null;

  let digitos: string;
  if (limpio.startsWith("+")) {
    digitos = limpio.slice(1);
  } else if (limpio.startsWith("00")) {
    digitos = limpio.slice(2);
  } else if (limpio.startsWith(codigoPais) && limpio.length > 9) {
    digitos = limpio;
  } else {
    digitos = codigoPais + limpio.replace(/^0+/, "");
  }
  if (!/^[1-9]\d{7,14}$/.test(digitos)) return null;
  // En Chile todos los números nacionales tienen 9 dígitos.
  if (digitos.startsWith("56") && digitos.length !== 11) return null;
  return `+${digitos}`;
}

/** Formato legible para mostrar: +56 9 1234 5678 */
export function formatearTelefono(e164: string): string {
  const m = /^\+56(9)(\d{4})(\d{4})$/.exec(e164);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
