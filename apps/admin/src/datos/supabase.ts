// Implementación real sobre Supabase. Todo pasa por RLS y por las RPC de administración
// (supabase/migrations/20261009000001_administracion.sql), que exigen rol admin.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Alumno, Cobro, Conductora, Datos, Empresa, LlamadaReporte, Mensaje, Pregunta, RecorridoHoy, Resumen, Ruta, Solicitud,
} from "./tipos";

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(traducir(r.error.message));
  return r.data;
}

function traducir(m: string): string {
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión con el servidor.";
  return m;
}

export function crearDatosSupabase(url: string, anonKey: string): Datos {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true } });
  let empresaId: string | null = null;
  let miId: string | null = null;

  return {
    modo: "real",

    async sesion() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const perfil = ok(await sb.from("perfiles").select("id, nombre, rol, empresa_id").eq("id", data.session.user.id).maybeSingle());
      if (!perfil || perfil.rol !== "admin") {
        await sb.auth.signOut();
        throw new Error("Esta cuenta no es de administrador. Usa la app móvil para conductoras y apoderados.");
      }
      empresaId = perfil.empresa_id;
      miId = perfil.id;
      return { nombre: perfil.nombre };
    },
    async ingresar(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(traducir(error.message));
    },
    async salir() {
      await sb.auth.signOut();
    },

    async resumen() {
      return ok(await sb.rpc("resumen_admin")) as Resumen;
    },
    async recorridosHoy() {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const filas = ok(await sb.from("recorridos")
        .select("id, estado, iniciado_en, rutas(nombre), recorrido_alumnos(estado), avisos(id)")
        .gte("iniciado_en", hoy.toISOString()).order("iniciado_en", { ascending: false }));
      return (filas ?? []).map((r) => {
        const ra = r.recorrido_alumnos as { estado: string }[];
        return {
          id: r.id, estado: r.estado, iniciado_en: r.iniciado_en,
          ruta: (r.rutas as unknown as { nombre: string } | null)?.nombre ?? "—",
          total: ra.length, atendidos: ra.filter((x) => x.estado !== "pendiente").length,
          avisos: (r.avisos as unknown[]).length,
        } satisfies RecorridoHoy;
      });
    },

    async alumnos() {
      const filas = ok(await sb.from("alumnos")
        .select(`id, nombre, colegio, curso, minutos_aviso, mensualidad, activo, fecha_baja, motivo_baja,
          domicilios(id, direccion, lat, lng, indicaciones, principal),
          contactos(nombre, telefono, prioridad),
          apoderado_alumno(perfiles(id, nombre, telefono)),
          ruta_paradas(rutas(id, nombre))`)
        .order("nombre"));
      return (filas ?? []).map((a) => {
        const doms = a.domicilios as unknown as (Alumno["domicilio"] & { principal: boolean })[];
        const dom = doms.find((d) => d!.principal) ?? doms[0] ?? null;
        return {
          id: a.id, nombre: a.nombre, colegio: a.colegio, curso: a.curso, minutos_aviso: a.minutos_aviso,
          mensualidad: a.mensualidad, activo: a.activo, fecha_baja: a.fecha_baja, motivo_baja: a.motivo_baja,
          domicilio: dom ? { id: dom.id, direccion: dom.direccion, lat: dom.lat, lng: dom.lng, indicaciones: dom.indicaciones } : null,
          contactos: (a.contactos as Alumno["contactos"]).sort((x, y) => x.prioridad - y.prioridad),
          apoderados: (a.apoderado_alumno as unknown as { perfiles: Alumno["apoderados"][number] }[]).map((x) => x.perfiles).filter(Boolean),
          rutas: (a.ruta_paradas as unknown as { rutas: { id: string; nombre: string } }[]).map((x) => x.rutas).filter(Boolean),
        } satisfies Alumno;
      });
    },
    async crearAlumno(n) {
      return ok(await sb.rpc("admin_crear_alumno", { p_datos: n })) as { alumno_id: string; codigo: string };
    },
    async actualizarAlumno(id, cambios) {
      ok(await sb.rpc("admin_actualizar_alumno", { p_alumno: id, p_datos: cambios }));
    },
    async actualizarDomicilio(alumnoId, d) {
      if (d.id) {
        ok(await sb.from("domicilios").update({ direccion: d.direccion, lat: d.lat, lng: d.lng, indicaciones: d.indicaciones }).eq("id", d.id));
      } else {
        ok(await sb.from("domicilios").insert({ alumno_id: alumnoId, direccion: d.direccion, lat: d.lat, lng: d.lng, indicaciones: d.indicaciones }));
      }
    },
    async guardarContactos(alumnoId, contactos) {
      ok(await sb.from("contactos").delete().eq("alumno_id", alumnoId));
      if (contactos.length) ok(await sb.from("contactos").insert(contactos.map((c) => ({ ...c, alumno_id: alumnoId }))));
    },
    async codigoFamilia(alumnoId) {
      return ok(await sb.rpc("codigo_familia", { p_alumno: alumnoId })) as string;
    },
    async darDeBaja(alumnoId, motivo) {
      ok(await sb.rpc("dar_de_baja", { p_alumno: alumnoId, p_motivo: motivo }));
    },

    async rutas() {
      const filas = ok(await sb.from("rutas")
        .select("id, nombre, tipo, hora_salida, conductor_id, conductor:perfiles(nombre), furgones(patente, descripcion), ruta_paradas(alumno_id, orden, alumnos(nombre), domicilios(direccion))")
        .order("nombre"));
      return (filas ?? []).map((r) => {
        const f = r.furgones as unknown as { patente: string; descripcion: string | null } | null;
        return {
          id: r.id, nombre: r.nombre, tipo: r.tipo, hora_salida: r.hora_salida, conductor_id: r.conductor_id,
          conductor_nombre: (r.conductor as unknown as { nombre: string } | null)?.nombre ?? null,
          furgon: f ? `${f.descripcion ?? ""} · ${f.patente}` : null,
          paradas: (r.ruta_paradas as unknown as { alumno_id: string; orden: number; alumnos: { nombre: string }; domicilios: { direccion: string } }[])
            .map((p) => ({ alumno_id: p.alumno_id, orden: p.orden, nombre: p.alumnos?.nombre ?? "—", direccion: p.domicilios?.direccion ?? "" }))
            .sort((a, b) => a.orden - b.orden),
        } satisfies Ruta;
      });
    },
    async moverParada(rutaId, alumnoId, delta) {
      ok(await sb.rpc("mover_parada", { p_ruta: rutaId, p_alumno: alumnoId, p_delta: delta }));
    },
    async asignarARuta(alumnoId, rutaId) {
      ok(await sb.rpc("asignar_a_ruta", { p_alumno: alumnoId, p_ruta: rutaId }));
    },
    async quitarDeRuta(rutaId, alumnoId) {
      ok(await sb.from("ruta_paradas").delete().eq("ruta_id", rutaId).eq("alumno_id", alumnoId));
    },
    async asignarConductora(rutaId, conductoraId) {
      ok(await sb.from("rutas").update({ conductor_id: conductoraId }).eq("id", rutaId));
    },

    async conductoras() {
      return (ok(await sb.from("perfiles").select("id, nombre, telefono").eq("rol", "conductor").order("nombre")) ?? []) as Conductora[];
    },
    async invitarConductora() {
      return ok(await sb.rpc("crear_invitacion", { p_rol: "conductor", p_usos: 1 })) as string;
    },

    async cobros(periodo) {
      const filas = ok(await sb.from("cobros")
        .select("id, alumno_id, periodo, monto, vence_en, estado, pagado_en, medio, nota, alumnos(nombre)")
        .eq("periodo", `${periodo}-01`));
      return (filas ?? []).map((c) => ({ ...c, alumno: (c.alumnos as unknown as { nombre: string })?.nombre ?? "—" }) as Cobro)
        .sort((a, b) => a.alumno.localeCompare(b.alumno));
    },
    async generarCobros(periodo) {
      return ok(await sb.rpc("generar_cobros", { p_periodo: `${periodo}-01` })) as number;
    },
    async registrarPago(cobroId, medio, nota) {
      ok(await sb.rpc("registrar_pago", { p_cobro: cobroId, p_medio: medio, p_nota: nota || null }));
    },
    async anularCobro(cobroId, nota) {
      ok(await sb.rpc("anular_cobro", { p_cobro: cobroId, p_nota: nota || null }));
    },

    async solicitudes() {
      const filas = ok(await sb.from("solicitudes")
        .select("id, tipo, asunto, estado, resolucion, alumno_id, creado_en, actualizado_en, alumnos(nombre), autor:perfiles(nombre)")
        .order("actualizado_en", { ascending: false }));
      return (filas ?? []).map((s) => ({
        id: s.id, tipo: s.tipo, asunto: s.asunto, estado: s.estado, resolucion: s.resolucion, alumno_id: s.alumno_id,
        creado_en: s.creado_en, actualizado_en: s.actualizado_en,
        alumno: (s.alumnos as unknown as { nombre: string } | null)?.nombre ?? null,
        autor: (s.autor as unknown as { nombre: string } | null)?.nombre ?? "—",
      }) as Solicitud);
    },
    async mensajes(solicitudId) {
      const filas = ok(await sb.from("solicitud_mensajes")
        .select("id, cuerpo, creado_en, autor:perfiles(nombre, rol)").eq("solicitud_id", solicitudId).order("creado_en"));
      return (filas ?? []).map((m) => {
        const a = m.autor as unknown as { nombre: string; rol: string } | null;
        return { id: m.id, cuerpo: m.cuerpo, creado_en: m.creado_en, autor: a?.nombre ?? "—", es_admin: a?.rol === "admin" } satisfies Mensaje;
      });
    },
    async responder(solicitudId, cuerpo) {
      ok(await sb.from("solicitud_mensajes").insert({ solicitud_id: solicitudId, autor_id: miId, cuerpo }));
    },
    async cerrarSolicitud(solicitudId) {
      ok(await sb.from("solicitudes").update({ estado: "cerrada", actualizado_en: new Date().toISOString() }).eq("id", solicitudId));
    },
    async resolverCancelacion(solicitudId, aprobar, mensaje) {
      ok(await sb.rpc("resolver_cancelacion", { p_solicitud: solicitudId, p_aprobar: aprobar, p_mensaje: mensaje }));
    },

    async preguntas() {
      return (ok(await sb.from("preguntas_frecuentes").select("id, pregunta, respuesta, orden, publicada").order("orden")) ?? []) as Pregunta[];
    },
    async guardarPregunta(p) {
      if (p.id) ok(await sb.from("preguntas_frecuentes").update({ pregunta: p.pregunta, respuesta: p.respuesta, orden: p.orden, publicada: p.publicada }).eq("id", p.id));
      else ok(await sb.from("preguntas_frecuentes").insert({ empresa_id: empresaId, pregunta: p.pregunta, respuesta: p.respuesta, orden: p.orden, publicada: p.publicada }));
    },
    async eliminarPregunta(id) {
      ok(await sb.from("preguntas_frecuentes").delete().eq("id", id));
    },

    async llamadas(mes) {
      const [a, m] = mes.split("-").map(Number);
      const desde = new Date(a, m - 1, 1).toISOString(), hasta = new Date(a, m, 1).toISOString();
      const filas = ok(await sb.from("llamadas")
        .select("id, canal, estado, telefono, iniciada_en, duracion_seg, contactos(nombre), avisos(alumnos(nombre))")
        .gte("iniciada_en", desde).lt("iniciada_en", hasta).order("iniciada_en", { ascending: false }));
      return (filas ?? []).map((l) => ({
        id: l.id, canal: l.canal, estado: l.estado, telefono: l.telefono, fecha: l.iniciada_en, duracion_seg: l.duracion_seg,
        contacto: (l.contactos as unknown as { nombre: string } | null)?.nombre ?? "—",
        alumno: (l.avisos as unknown as { alumnos: { nombre: string } } | null)?.alumnos?.nombre ?? "—",
      }) as LlamadaReporte);
    },
    async empresa() {
      return ok(await sb.from("empresas").select("id, nombre, mensualidad_defecto, dia_vencimiento, telefono_contacto").eq("id", empresaId).single()) as Empresa;
    },
    async guardarEmpresa(e) {
      ok(await sb.from("empresas").update(e).eq("id", empresaId));
    },
  };
}
