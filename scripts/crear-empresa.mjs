// Crea la empresa (el furgón) y le da el rol de administrador a una cuenta que ya existe.
// La cuenta se crea antes en el panel de Supabase (Authentication → Add user), así la
// contraseña nunca pasa por la terminal ni por el chat.
//
//   node scripts/crear-empresa.mjs --empresa "Furgones Tía Marcela" --admin correo@dominio.cl
//   node scripts/crear-empresa.mjs --empresa "Furgones Tía Marcela" --tia correo-tia@dominio.cl
//
// Con --tia, la cuenta queda como conductora que también administra (dueña del furgón).

import { lit, sql } from "./_supabase.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const empresa = arg("empresa"), admin = arg("admin"), tia = arg("tia");
const correo = (admin ?? tia)?.trim().toLowerCase();
if (!empresa || !correo) {
  console.error('Uso: node scripts/crear-empresa.mjs --empresa "Nombre" (--admin correo | --tia correo)');
  process.exit(1);
}

const [usuario] = await sql(`select id, coalesce(raw_user_meta_data ->> 'nombre', split_part(email, '@', 1)) as nombre
  from auth.users where lower(email) = ${lit(correo)}`);
if (!usuario) {
  console.error(`No existe una cuenta con ${correo}. Créala en Supabase → Authentication → Add user (marca «Auto Confirm User»).`);
  process.exit(1);
}
const [e] = await sql(`with e as (insert into public.empresas (nombre) select ${lit(empresa)}
    where not exists (select 1 from public.empresas where nombre = ${lit(empresa)}) returning id)
  select id from e union all select id from public.empresas where nombre = ${lit(empresa)} limit 1`);
await sql(`insert into public.perfiles (id, empresa_id, rol, nombre, puede_administrar)
  values (${lit(usuario.id)}, ${lit(e.id)}, ${admin ? "'admin'" : "'conductor'"}, ${lit(usuario.nombre)}, ${tia ? "true" : "false"})
  on conflict (id) do update set empresa_id = excluded.empresa_id, rol = excluded.rol, puede_administrar = excluded.puede_administrar`);
console.log(`✓ ${correo} es ${admin ? "administrador" : "tía/tío que administra"} de «${empresa}».`);
console.log("  Entra al panel web con esa cuenta para agregar alumnos, rutas y conductoras.");
