// Crea (o recrea) una empresa de demo con admin, conductor, dos apoderados, tres
// alumnos y rutas de ida y vuelta. Usa la service_role key: ejecutar solo en local
// o en un proyecto de pruebas.
//
//   npm run demo:preparar

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { normalizarTelefono } from "../../../supabase/functions/_shared/core/telefono.ts";
import { ALUMNOS_DEMO, COLEGIO } from "./ruta-demo.ts";
import { ARCHIVO_DEMO, cargarEnv, requerida } from "./util.ts";

cargarEnv();
const NOMBRE_EMPRESA = "Furgones Demo";
const DOMINIO = "demo.furgon.app";
const PASSWORD = process.env.DEMO_PASSWORD || "demo-furgon-2026";

const sb = createClient(requerida("SUPABASE_URL"), requerida("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USUARIOS = [
  { clave: "admin", email: `admin@${DOMINIO}`, rol: "admin", nombre: "Carla (dueña del furgón)", telefono: "+56900000001" },
  { clave: "conductor", email: `conductor@${DOMINIO}`, rol: "conductor", nombre: "Jorge (conductor)", telefono: "+56900000002" },
  { clave: "apoderado1", email: `apoderado1@${DOMINIO}`, rol: "apoderado", nombre: "Ana Pérez", telefono: "+56900000003" },
  { clave: "apoderado2", email: `apoderado2@${DOMINIO}`, rol: "apoderado", nombre: "Luis Soto", telefono: "+56900000004" },
] as const;

/** Lanza si la operación falló. (Los insert sin .select() devuelven data = null.) */
function ok<T>(r: { data: T; error: { message: string } | null }, que: string): NonNullable<T> {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

async function limpiarDemoAnterior() {
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith(`@${DOMINIO}`)) await sb.auth.admin.deleteUser(u.id);
  }
  await sb.from("empresas").delete().eq("nombre", NOMBRE_EMPRESA);
}

async function main() {
  console.log("🧹 Eliminando demo anterior...");
  await limpiarDemoAnterior();

  console.log("🏢 Creando empresa, usuarios y furgón...");
  const empresa = ok(await sb.from("empresas").insert({ nombre: NOMBRE_EMPRESA }).select("id").single(), "empresa");

  const ids: Record<string, string> = {};
  for (const u of USUARIOS) {
    const { data: creado, error } = await sb.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { nombre: u.nombre },
    });
    if (error || !creado.user) throw new Error(`usuario ${u.email}: ${error?.message}`);
    ids[u.clave] = creado.user.id;
    ok(await sb.from("perfiles").insert({
      id: creado.user.id, empresa_id: empresa.id, rol: u.rol, nombre: u.nombre, telefono: u.telefono,
    }), `perfil ${u.email}`);
  }

  ok(await sb.from("invitaciones").insert([
    { codigo: "DEMOAPOD", empresa_id: empresa.id, rol: "apoderado" },
    { codigo: "DEMOCOND", empresa_id: empresa.id, rol: "conductor" },
  ]), "invitaciones");

  const furgon = ok(await sb.from("furgones").insert({
    empresa_id: empresa.id, patente: "DEMO-11", descripcion: "Hyundai H1 blanca",
  }).select("id").single(), "furgón");

  const rutaBase = {
    empresa_id: empresa.id, furgon_id: furgon.id, conductor_id: ids.conductor,
    colegio_nombre: COLEGIO.nombre, colegio_lat: COLEGIO.lat, colegio_lng: COLEGIO.lng,
  };
  const rutas = ok(await sb.from("rutas").insert([
    { ...rutaBase, nombre: "Ida mañana", tipo: "ida", hora_salida: "07:00" },
    { ...rutaBase, nombre: "Vuelta tarde", tipo: "vuelta", hora_salida: "16:30" },
  ]).select("id, tipo"), "rutas");

  console.log("👧 Registrando alumnos con domicilio y contactos...");
  const telPrincipal = normalizarTelefono(process.env.DEMO_TELEFONO_PRINCIPAL ?? "") ?? "+56911111111";
  const telSecundario = normalizarTelefono(process.env.DEMO_TELEFONO_SECUNDARIO ?? "") ?? "+56922222222";
  const alumnos: { id: string; domicilioId: string }[] = [];
  for (const a of ALUMNOS_DEMO) {
    const alumno = ok(await sb.from("alumnos").insert({
      empresa_id: empresa.id, nombre: a.nombre, colegio: COLEGIO.nombre, curso: a.curso, minutos_aviso: 5,
    }).select("id").single(), `alumno ${a.nombre}`);
    ok(await sb.from("apoderado_alumno").insert({
      apoderado_id: ids[`apoderado${a.apoderado + 1}`], alumno_id: alumno.id, parentesco: "Madre/Padre",
    }), "vínculo");
    const domicilio = ok(await sb.from("domicilios").insert({
      alumno_id: alumno.id, direccion: a.direccion, lat: a.ubicacion.lat, lng: a.ubicacion.lng,
    }).select("id").single(), "domicilio");
    alumnos.push({ id: alumno.id, domicilioId: domicilio.id });
    ok(await sb.from("contactos").insert([
      { alumno_id: alumno.id, nombre: "Contacto principal", telefono: telPrincipal, prioridad: 1 },
      { alumno_id: alumno.id, nombre: "Contacto secundario", telefono: telSecundario, prioridad: 2 },
    ]), "contactos");
  }

  // Ida: recoge en orden inverso (Providencia → Las Condes → La Reina → colegio).
  // Vuelta: deja en orden (colegio → La Reina → Las Condes → Providencia).
  for (const ruta of rutas) {
    const orden = ruta.tipo === "ida" ? [...alumnos].reverse() : alumnos;
    ok(await sb.from("ruta_paradas").insert(orden.map((a, i) => ({
      ruta_id: ruta.id, alumno_id: a.id, domicilio_id: a.domicilioId, orden: i + 1,
    }))), "paradas");
  }

  const demo = {
    empresaId: empresa.id,
    password: PASSWORD,
    usuarios: Object.fromEntries(USUARIOS.map((u) => [u.clave, u.email])),
    rutas: Object.fromEntries(rutas.map((r) => [r.tipo, r.id])),
  };
  writeFileSync(ARCHIVO_DEMO, JSON.stringify(demo, null, 2));

  console.log("\n✅ Demo lista. Cuentas (contraseña: %s):", PASSWORD);
  for (const u of USUARIOS) console.log(`   ${u.rol.padEnd(10)} ${u.email}`);
  console.log("   Códigos de invitación para registrarse desde la app: DEMOAPOD (apoderado), DEMOCOND (conductor)");
  console.log("\nSiguiente paso: npm run simular -- --tipo vuelta --acelerar 4");
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
