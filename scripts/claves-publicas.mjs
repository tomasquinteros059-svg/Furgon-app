// Escribe la URL y la clave pública del proyecto de Supabase en el formato KEY=valor, para que
// GitHub Actions las pase a la compilación del APK (son valores PÚBLICOS: quedan dentro de la app).
//
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/claves-publicas.mjs >> "$GITHUB_ENV"

import { clavePublica, REF } from "./_supabase.mjs";

const clave = await clavePublica();
console.log(`EXPO_PUBLIC_SUPABASE_URL=https://${REF()}.supabase.co`);
console.log(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${clave}`);
