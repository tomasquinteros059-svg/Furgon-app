// Implementación real sobre Supabase. Todo pasa por RLS y por las RPC de administración
// (supabase/migrations/20261009000001_administracion.sql), que exigen rol admin.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Alumno, Cobro, Conductora, Datos, Empresa, Furgon, Licencia, LlamadaReporte, Mensaje, Pregunta, RecomendacionRuta, RecorridoHoy, Resumen, Ruta, Solicitud,
} from "./tipos";
import { t } from "../i18n";

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(traducir(r.error.message));
  return r.data;
}

function traducir(m: string): string {
  if (/Invalid login credentials/i.test(m)) return t("Correo o contraseña incorrectos.");
  if (/Failed to fetch|NetworkError/i.test(m)) return t("Sin conexión con el servidor.");
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
      const perfil = ok(await sb.from("perfiles").select("id, nombre, rol, empresa_id, puede_administrar").eq("id", data.session.user.id).maybeSingle());
      const administra = perfil && (perfil.rol === "admin" || (perfil.rol === "conductor" && perfil.puede_administrar));
      if (!perfil || !administra) {
        await sb.auth.signOut();
        throw new Error(t("Esta cuenta no tiene permiso de administración. Pídeselo al administrador principal."));
      }
      empresaId = perfil.empresa_id;
      miId = perfil.id;
      return { nombre: perfil.nombre, tipo: perfil.rol === "admin" ? "principal" : "conductora" };
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
      // En una sola transacción: si falla, el alumno conserva sus teléfonos.
      ok(await sb.rpc("reemplazar_contactos", { p_alumno: alumnoId, p_contactos: contactos }));
    },
    async codigoFamilia(alumnoId) {
      return ok(await sb.rpc("codigo_familia", { p_alumno: alumnoId })) as string;
    },
    async darDeBaja(alumnoId, motivo) {
      ok(await sb.rpc("dar_de_baja", { p_alumno: alumnoId, p_motivo: motivo }));
    },

    async rutas() {
      const [filas, hoy] = await Promise.all([
        sb.from("rutas")
          .select("id, nombre, tipo, hora_salida, conductor_id, furgon_id, activa, colegio_nombre, colegio_lat, colegio_lng, conductor:perfiles(nombre), furgones(patente, modelo, descripcion), ruta_paradas(alumno_id, orden, alumnos(nombre), domicilios(direccion, lat, lng))")
          .order("nombre").then(ok),
        sb.rpc("hoy_empresa").then(ok) as Promise<string>,
      ]);
      const inasistencias = ok(await sb.from("inasistencias").select("alumno_id, tipo").eq("fecha", hoy)) ?? [];
      return (filas ?? []).map((r) => {
        const f = r.furgones as unknown as { patente: string; modelo: string | null; descripcion: string | null } | null;
        const noVa = (alumnoId: string) => inasistencias.some((i) => i.alumno_id === alumnoId && (i.tipo === r.tipo || i.tipo === "ambos"));
        return {
          id: r.id, nombre: r.nombre, tipo: r.tipo, hora_salida: r.hora_salida, conductor_id: r.conductor_id,
          conductor_nombre: (r.conductor as unknown as { nombre: string } | null)?.nombre ?? null,
          furgon: f ? [f.modelo ?? f.descripcion, f.patente].filter(Boolean).join(" · ") : null,
          furgon_id: r.furgon_id, activa: r.activa,
          colegio: r.colegio_lat != null && r.colegio_lng != null ? { nombre: r.colegio_nombre, lat: r.colegio_lat, lng: r.colegio_lng } : null,
          paradas: (r.ruta_paradas as unknown as { alumno_id: string; orden: number; alumnos: { nombre: string }; domicilios: { direccion: string; lat: number; lng: number } | null }[])
            .map((p) => ({
              alumno_id: p.alumno_id, orden: p.orden, nombre: p.alumnos?.nombre ?? "—", direccion: p.domicilios?.direccion ?? "",
              lat: p.domicilios?.lat ?? null, lng: p.domicilios?.lng ?? null, hoy_no_va: noVa(p.alumno_id),
            }))
            .sort((a, b) => a.orden - b.orden),
        } satisfies Ruta;
      });
    },
    async recomendarRuta(rutaId) {
      const { data, error } = await sb.functions.invoke("recomendar-ruta", { body: { ruta_id: rutaId } });
      if (error) {
        const cuerpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(cuerpo?.mensaje ?? t("No se pudo calcular la recomendación."));
      }
      return data as RecomendacionRuta;
    },
    async aplicarOrden(rutaId, orden) {
      ok(await sb.rpc("aplicar_orden_ruta", { p_ruta: rutaId, p_alumnos: orden }));
    },
    async hoyNoVa(alumnoId, tipo, valor) {
      const hoy = ok(await sb.rpc("hoy_empresa")) as string;
      const marcar = async (t: string, v: boolean) => ok(await sb.rpc("marcar_no_viaja", { p_alumno: alumnoId, p_fecha: hoy, p_tipo: t, p_no_viaja: v }));
      if (valor) { await marcar(tipo, true); return; }
      await marcar(tipo, false);
      // Si la familia había marcado todo el día, se deja solo el otro tramo.
      const ambos = ok(await sb.from("inasistencias").select("id").eq("alumno_id", alumnoId).eq("fecha", hoy).eq("tipo", "ambos"));
      if (ambos?.length) { await marcar("ambos", false); await marcar(tipo === "ida" ? "vuelta" : "ida", true); }
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

    async furgones() {
      return (ok(await sb.rpc("resumen_furgones")) ?? []) as Furgon[];
    },
    async guardarFurgon(f) {
      return ok(await sb.rpc("guardar_furgon", { p_datos: f })) as string;
    },
    async licencias() {
      return (ok(await sb.rpc("estado_licencias")) ?? []) as Licencia[];
    },
    async revisarLicencia(id, aprobar, motivo) {
      ok(await sb.rpc("revisar_licencia", { p_licencia: id, p_aprobar: aprobar, p_motivo: motivo || null }));
    },
    async fotoLicencia(ruta) {
      const { data, error } = await sb.storage.from("licencias").createSignedUrl(ruta, 300);
      if (error) throw new Error(traducir(error.message));
      return data.signedUrl;
    },

    async conductoras() {
      return (ok(await sb.from("perfiles").select("id, nombre, telefono, puede_administrar").eq("rol", "conductor").order("nombre")) ?? []) as Conductora[];
    },
    async permitirAdministrar(conductoraId, valor) {
      ok(await sb.rpc("permitir_administrar", { p_perfil: conductoraId, p_valor: valor }));
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
    async cambiarMontoCobro(cobroId, monto, nota) {
      ok(await sb.rpc("cambiar_monto_cobro", { p_cobro: cobroId, p_monto: monto, p_nota: nota || null }));
    },
    async fijarMensualidad(alumnoId, monto, desde) {
      return ok(await sb.rpc("fijar_mensualidad", { p_alumno: alumnoId, p_monto: monto, p_desde: desde ? `${desde}-01` : null })) as number;
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
        return { id: m.id, cuerpo: m.cuerpo, creado_en: m.creado_en, autor: a?.nombre ?? "—", es_admin: !!a && a.rol !== "apoderado" } satisfies Mensaje; // admin o tía que administra
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
