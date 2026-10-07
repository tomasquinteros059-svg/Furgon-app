// Implementación en memoria con datos de ejemplo, para la demostración (sin backend).
// Reproduce las mismas reglas que las RPC del servidor (cobros idempotentes, bajas, etc.).
import { extremosDeRuta, recomendarRuta } from "../../../../supabase/functions/_shared/core/recomendar-ruta.ts";
import type {
  Alumno, Cobro, Conductora, Datos, Empresa, Furgon, Licencia, LlamadaReporte, Mensaje, MedioPago, Pregunta, Ruta, Solicitud,
} from "./tipos";

const uid = () => Math.random().toString(36).slice(2, 10);
const codigo = () => Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0");
const iso = (d: Date) => d.toISOString();
const hoy = new Date();
const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
const haceDias = (d: number, h = 9) => { const x = new Date(hoy); x.setDate(x.getDate() - d); x.setHours(h, 12, 0, 0); return x; };
const esperar = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export function crearDatosDemo(): Datos {
  const empresa: Empresa = { id: "e1", nombre: "Furgones Tía Marcela", mensualidad_defecto: 60000, dia_vencimiento: 5, telefono_contacto: "+56 9 5555 1234" };
  const conductoras: Conductora[] = [
    { id: "c1", nombre: "Marcela Fuentes (tía Marcela)", telefono: "+56 9 5555 1234", puede_administrar: true },
    { id: "c2", nombre: "Jorge Díaz", telefono: "+56 9 5555 9876", puede_administrar: false },
  ];
  const base = [
    ["Sofía Pérez", "3° Básico", -33.4495, -70.5560, "Av. Ossa 1200, La Reina", "Ana Pérez", "+56 9 1111 1111", null],
    ["Isidora Rojas", "1° Básico", -33.4260, -70.6100, "Av. Pedro de Valdivia 900, Providencia", "Ana Pérez", "+56 9 1111 1111", null],
    ["Matías Soto", "5° Básico", -33.4180, -70.5540, "Av. Tomás Moro 300, Las Condes", "Luis Soto", "+56 9 3333 3333", 65000],
    ["Benjamín Muñoz", "2° Básico", -33.4560, -70.5900, "Irarrázaval 3500, Ñuñoa", "Carla Muñoz", "+56 9 4444 1212", null],
    ["Florencia Díaz", "4° Básico", -33.4420, -70.5750, "Simón Bolívar 4200, Ñuñoa", "Pedro Díaz", "+56 9 7777 2323", null],
    ["Agustín Vera", "6° Básico", -33.4330, -70.5650, "Av. Príncipe de Gales 6800, La Reina", "Marta Vera", "+56 9 8888 3434", 55000],
    ["Josefa Torres", "Kínder", -33.4610, -70.5830, "José Pedro Alessandri 1100, Ñuñoa", "Rocío Torres", "+56 9 6666 4545", null],
  ] as const;
  const alumnos: Alumno[] = base.map(([nombre, curso, lat, lng, direccion, apod, tel, mensualidad], i) => ({
    id: `a${i + 1}`, nombre, colegio: "Colegio Demo (Ñuñoa)", curso, minutos_aviso: 5, mensualidad, activo: true,
    fecha_baja: null, motivo_baja: null,
    domicilio: { id: `d${i + 1}`, direccion, lat, lng, indicaciones: i === 0 ? "Portón verde" : null },
    contactos: [{ nombre: apod, telefono: tel, prioridad: 1 }, ...(i % 2 === 0 ? [{ nombre: "Abuelo/a", telefono: "+56 9 2222 2222", prioridad: 2 }] : [])],
    apoderados: i === 6 ? [] : [{ id: `p${i}`, nombre: apod, telefono: tel }],
    rutas: [],
  }));
  // Josefa recién agregada: aún sin ruta y su familia sin la app.
  const colegio = { nombre: "Colegio Demo (Plaza Ñuñoa)", lat: -33.4565, lng: -70.5978 };
  const rutas: Ruta[] = [
    { id: "r1", nombre: "Ida mañana", tipo: "ida", hora_salida: "07:00:00", conductor_id: "c1", conductor_nombre: conductoras[0].nombre, furgon: "Hyundai H1 blanca · DEMO-11", colegio, paradas: [] },
    { id: "r2", nombre: "Vuelta tarde", tipo: "vuelta", hora_salida: "16:30:00", conductor_id: "c1", conductor_nombre: conductoras[0].nombre, furgon: "Hyundai H1 blanca · DEMO-11", colegio, paradas: [] },
  ];
  const ponerEnRuta = (r: Ruta, a: Alumno) => {
    r.paradas.push({ alumno_id: a.id, nombre: a.nombre, orden: r.paradas.length + 1, direccion: a.domicilio?.direccion ?? "",
      lat: a.domicilio?.lat ?? null, lng: a.domicilio?.lng ?? null, hoy_no_va: false });
    a.rutas.push({ id: r.id, nombre: r.nombre });
  };
  [5, 4, 2, 1, 0, 3].forEach((i) => ponerEnRuta(rutas[0], alumnos[i]));
  [3, 0, 2, 1, 4, 5].forEach((i) => ponerEnRuta(rutas[1], alumnos[i]));
  rutas[1].paradas.find((p) => p.alumno_id === "a3")!.hoy_no_va = true; // la familia de Matías avisó que hoy no va

  // Furgones y licencias de las conductoras.
  const enDias = (n: number) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const furgones: (Omit<Furgon, "conductor" | "rutas" | "alumnos" | "licencia" | "licencia_vence">)[] = [
    { id: "f1", patente: "DEMO-11", modelo: "Hyundai H1 blanca", descripcion: null, capacidad: 12, activo: true, conductor_id: "c1" },
    { id: "f2", patente: "DEMO-22", modelo: "Toyota Hiace amarilla", descripcion: null, capacidad: 15, activo: true, conductor_id: "c2" },
  ];
  const furgonDeRuta: Record<string, string | null> = { r1: "f1", r2: "f1" };
  const fotoDemo = (titulo: string, lado: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="340" viewBox="0 0 540 340"><rect width="540" height="340" rx="22" fill="#E8F1FA" stroke="#16324F" stroke-width="4"/>
    <rect x="0" y="0" width="540" height="64" rx="22" fill="#16324F"/><text x="24" y="42" font-family="Arial" font-size="24" font-weight="700" fill="#fff">LICENCIA DE CONDUCTOR · CHILE</text>
    <rect x="28" y="92" width="130" height="160" rx="10" fill="#C9D6E3"/><circle cx="93" cy="150" r="34" fill="#9AAEC2"/><rect x="48" y="196" width="90" height="44" rx="20" fill="#9AAEC2"/>
    <text x="186" y="118" font-family="Arial" font-size="22" font-weight="700" fill="#16324F">${titulo}</text>
    <text x="186" y="160" font-family="Arial" font-size="18" fill="#16324F">${lado}</text>
    <text x="186" y="200" font-family="Arial" font-size="18" fill="#16324F">Ejemplo de la demostración</text></svg>`);
  const licencias: Licencia[] = [
    { conductor_id: "c1", conductor: conductoras[0].nombre, licencia_id: "l1", numero: "12.345.678-9", clase: "A3", vence_en: enDias(24), dias_restantes: 24,
      estado: "por_vencer", motivo_rechazo: null, revisada_en: iso(haceDias(300)), foto_frente: fotoDemo("MARCELA FUENTES · A3", "Frente"), foto_reverso: fotoDemo("MARCELA FUENTES · A3", "Reverso") },
    { conductor_id: "c2", conductor: conductoras[1].nombre, licencia_id: "l2", numero: "15.222.333-4", clase: "A1", vence_en: enDias(410), dias_restantes: 410,
      estado: "por_verificar", motivo_rechazo: null, revisada_en: null, foto_frente: fotoDemo("JORGE DÍAZ · A1", "Frente"), foto_reverso: fotoDemo("JORGE DÍAZ · A1", "Reverso") },
  ];
  const resumenFurgon = (f: (typeof furgones)[number]): Furgon => {
    const rs = rutas.filter((r) => furgonDeRuta[r.id] === f.id);
    const lic = licencias.find((l) => l.conductor_id === f.conductor_id);
    return { ...f, conductor: conductoras.find((c) => c.id === f.conductor_id)?.nombre ?? null, rutas: rs.map((r) => r.nombre),
      alumnos: new Set(rs.flatMap((r) => r.paradas.map((p) => p.alumno_id))).size,
      licencia: f.conductor_id ? lic?.estado ?? "sin_licencia" : null, licencia_vence: lic?.vence_en ?? null };
  };

  const codigos = new Map<string, string>();
  const cobros: Cobro[] = [];
  const montoDe = (a: Alumno) => a.mensualidad ?? empresa.mensualidad_defecto;
  function generar(periodo: string) {
    let n = 0;
    for (const a of alumnos.filter((x) => x.activo)) {
      if (cobros.some((c) => c.alumno_id === a.id && c.periodo === `${periodo}-01`)) continue;
      cobros.push({ id: uid(), alumno_id: a.id, alumno: a.nombre, periodo: `${periodo}-01`, monto: montoDe(a),
        vence_en: `${periodo}-${String(empresa.dia_vencimiento).padStart(2, "0")}`, estado: "pendiente", pagado_en: null, medio: null, nota: null });
      n++;
    }
    return n;
  }
  const mesAnterior = (() => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  generar(mesAnterior);
  cobros.forEach((c, i) => { if (i !== 4) Object.assign(c, { estado: "pagado", pagado_en: iso(haceDias(30 + i)), medio: i % 2 ? "transferencia" : "efectivo" }); });
  generar(mesActual);
  cobros.filter((c) => c.periodo === `${mesActual}-01`).forEach((c, i) => {
    if (i < 3) Object.assign(c, { estado: "pagado", pagado_en: iso(haceDias(3 - i)), medio: "transferencia" });
  });

  const solicitudes: (Solicitud & { mensajes: Mensaje[] })[] = [
    { id: "s1", tipo: "cancelacion_servicio", asunto: "Nos cambiamos de comuna", estado: "abierta", resolucion: null, alumno_id: "a6", alumno: "Agustín Vera",
      autor: "Marta Vera", creado_en: iso(haceDias(1, 20)), actualizado_en: iso(haceDias(1, 20)),
      mensajes: [{ id: "m1", autor: "Marta Vera", es_admin: false, cuerpo: "Hola, a fin de mes nos cambiamos a Maipú y ya no vamos a necesitar el furgón. ¿Cómo hacemos la baja?", creado_en: iso(haceDias(1, 20)) }] },
    { id: "s2", tipo: "pregunta", asunto: "¿Pueden pasar 10 minutos más tarde los viernes?", estado: "abierta", resolucion: null, alumno_id: "a4", alumno: "Benjamín Muñoz",
      autor: "Carla Muñoz", creado_en: iso(haceDias(0, 8)), actualizado_en: iso(haceDias(0, 8)),
      mensajes: [{ id: "m2", autor: "Carla Muñoz", es_admin: false, cuerpo: "Los viernes Benjamín tiene taller y sale 16:40. ¿Se puede ajustar?", creado_en: iso(haceDias(0, 8)) }] },
    { id: "s3", tipo: "cambio_datos", asunto: "Nuevo teléfono del papá", estado: "respondida", resolucion: null, alumno_id: "a3", alumno: "Matías Soto",
      autor: "Luis Soto", creado_en: iso(haceDias(4)), actualizado_en: iso(haceDias(3)),
      mensajes: [
        { id: "m3", autor: "Luis Soto", es_admin: false, cuerpo: "Cambié de número, ahora es +56 9 3333 9999.", creado_en: iso(haceDias(4)) },
        { id: "m4", autor: "Administración", es_admin: true, cuerpo: "¡Gracias Luis! Ya quedó actualizado para las llamadas automáticas.", creado_en: iso(haceDias(3)) },
      ] },
    { id: "s4", tipo: "reclamo", asunto: "El aviso llegó tarde el martes", estado: "cerrada", resolucion: null, alumno_id: "a5", alumno: "Florencia Díaz",
      autor: "Pedro Díaz", creado_en: iso(haceDias(9)), actualizado_en: iso(haceDias(8)),
      mensajes: [
        { id: "m5", autor: "Pedro Díaz", es_admin: false, cuerpo: "El martes el aviso llegó cuando el furgón ya estaba afuera.", creado_en: iso(haceDias(9)) },
        { id: "m6", autor: "Administración", es_admin: true, cuerpo: "Revisamos: la tía estuvo sin señal en Irarrázaval. Movimos el pin de su casa a la entrada correcta.", creado_en: iso(haceDias(8)) },
      ] },
  ];
  const preguntas: Pregunta[] = [
    { id: "q1", pregunta: "¿Cómo aviso que mi hijo no viaja hoy?", respuesta: "En la app, en la tarjeta de tu hijo, activa “Hoy no viaja” para la ida o la vuelta. La tía no pasará por tu casa.", orden: 1, publicada: true },
    { id: "q2", pregunta: "¿Por qué recibo una llamada si ya tengo la app?", respuesta: "Primero te llamamos gratis por la app. Si tu teléfono no tiene internet, te llamamos por teléfono para que no te pierdas el aviso.", orden: 2, publicada: true },
    { id: "q3", pregunta: "¿Cuándo vence la mensualidad?", respuesta: "El día 5 de cada mes. Puedes pagar por transferencia o en efectivo a la tía.", orden: 3, publicada: true },
    { id: "q4", pregunta: "¿Qué pasa en vacaciones de invierno?", respuesta: "Borrador: definir si se cobra media mensualidad.", orden: 4, publicada: false },
  ];
  const llamadas: LlamadaReporte[] = [];
  const quienes: [string, string, string][] = [["Sofía Pérez", "Ana Pérez", "+56 9 1111 1111"], ["Matías Soto", "Luis Soto", "+56 9 3333 3333"], ["Florencia Díaz", "Pedro Díaz", "+56 9 7777 2323"], ["Benjamín Muñoz", "Carla Muñoz", "+56 9 4444 1212"]];
  for (let d = 0; d < 18; d++) {
    quienes.forEach(([alumno, contacto, telefono], i) => {
      const porTelefono = (d + i) % 7 === 0;
      llamadas.push({ id: uid(), fecha: iso(haceDias(d, 16 + (i % 2))), alumno, contacto, telefono, canal: "app", estado: porTelefono ? "sin_internet" : "confirmada", duracion_seg: null });
      if (porTelefono) llamadas.push({ id: uid(), fecha: iso(haceDias(d, 16 + (i % 2))), alumno, contacto, telefono, canal: "telefono", estado: "confirmada", duracion_seg: 28 + i * 7 });
    });
  }

  const enMes = (f: string, mes: string) => f.slice(0, 7) === mes;
  return {
    modo: "demo",
    async sesion() { return sesionActiva ? { nombre: "Administración", tipo: "principal" as const } : null; },
    async ingresar() { await esperar(300); sesionActiva = true; },
    async salir() { sesionActiva = false; },

    async resumen() {
      await esperar();
      const activos = alumnos.filter((a) => a.activo);
      const delMes = cobros.filter((c) => c.periodo === `${mesActual}-01`);
      const llam = llamadas.filter((l) => enMes(l.fecha, mesActual));
      const hoyStr = hoy.toISOString().slice(0, 10);
      return {
        alumnos_activos: activos.length,
        alumnos_sin_ruta: activos.filter((a) => a.rutas.length === 0).length,
        familias_sin_app: activos.filter((a) => a.apoderados.length === 0).length,
        recorridos_activos: hoy.getHours() >= 16 && hoy.getHours() < 18 ? 1 : 0,
        avisos_mes: llam.filter((l) => l.canal === "app").length,
        llamadas_app_mes: llam.filter((l) => l.canal === "app").length,
        llamadas_telefono_mes: llam.filter((l) => l.canal === "telefono").length,
        minutos_telefono_mes: llam.filter((l) => l.canal === "telefono").reduce((s, l) => s + Math.ceil((l.duracion_seg ?? 0) / 60), 0),
        cobrado_mes: delMes.filter((c) => c.estado === "pagado").reduce((s, c) => s + c.monto, 0),
        por_cobrar_mes: delMes.filter((c) => c.estado === "pendiente").reduce((s, c) => s + c.monto, 0),
        morosos: new Set(cobros.filter((c) => c.estado === "pendiente" && c.vence_en < hoyStr).map((c) => c.alumno_id)).size,
        solicitudes_abiertas: solicitudes.filter((s) => s.estado === "abierta").length,
      };
    },
    async recorridosHoy() {
      await esperar();
      const ida = new Date(hoy); ida.setHours(7, 2, 0, 0);
      const res = [{ id: "rh1", ruta: "Ida mañana", estado: "finalizado", iniciado_en: iso(ida), atendidos: 6, total: 6, avisos: 6 }];
      if (hoy.getHours() >= 16) {
        const v = new Date(hoy); v.setHours(16, 31, 0, 0);
        res.unshift({ id: "rh2", ruta: "Vuelta tarde", estado: hoy.getHours() < 18 ? "activo" : "finalizado", iniciado_en: iso(v), atendidos: hoy.getHours() < 18 ? 2 : 6, total: 6, avisos: hoy.getHours() < 18 ? 3 : 6 });
      }
      return res;
    },

    async alumnos() { await esperar(); return structuredClone(alumnos); },
    async crearAlumno(n) {
      await esperar(300);
      if (!n.nombre.trim()) throw new Error("Falta el nombre del alumno");
      const a: Alumno = { id: uid(), nombre: n.nombre.trim(), colegio: n.colegio, curso: n.curso, minutos_aviso: n.minutos_aviso, mensualidad: n.mensualidad,
        activo: true, fecha_baja: null, motivo_baja: null, domicilio: { ...n.domicilio, id: uid() }, contactos: n.contactos, apoderados: [], rutas: [] };
      alumnos.push(a);
      for (const rid of n.ruta_ids) { const r = rutas.find((x) => x.id === rid); if (r) ponerEnRuta(r, a); }
      const c = codigo(); codigos.set(a.id, c);
      return { alumno_id: a.id, codigo: c };
    },
    async actualizarAlumno(id, cambios) {
      await esperar(); const a = alumnos.find((x) => x.id === id)!; Object.assign(a, cambios);
      rutas.forEach((r) => r.paradas.forEach((p) => { if (p.alumno_id === id) p.nombre = a.nombre; }));
    },
    async actualizarDomicilio(alumnoId, d) {
      await esperar(); const a = alumnos.find((x) => x.id === alumnoId)!; a.domicilio = { ...d, id: d.id ?? uid() };
      rutas.forEach((r) => r.paradas.forEach((p) => { if (p.alumno_id === alumnoId) Object.assign(p, { direccion: d.direccion, lat: d.lat, lng: d.lng }); }));
    },
    async guardarContactos(alumnoId, contactos) { await esperar(); alumnos.find((x) => x.id === alumnoId)!.contactos = contactos; },
    async codigoFamilia(alumnoId) { await esperar(); if (!codigos.has(alumnoId)) codigos.set(alumnoId, codigo()); return codigos.get(alumnoId)!; },
    async darDeBaja(alumnoId, motivo) {
      await esperar();
      const a = alumnos.find((x) => x.id === alumnoId)!;
      Object.assign(a, { activo: false, fecha_baja: hoy.toISOString().slice(0, 10), motivo_baja: motivo, rutas: [] });
      rutas.forEach((r) => { r.paradas = r.paradas.filter((p) => p.alumno_id !== alumnoId); r.paradas.forEach((p, i) => { p.orden = i + 1; }); });
      cobros.forEach((c) => { if (c.alumno_id === alumnoId && c.estado === "pendiente" && c.periodo > `${mesActual}-01`) Object.assign(c, { estado: "anulado", nota: "Baja del servicio" }); });
    },

    async rutas() { await esperar(); return structuredClone(rutas); },
    async moverParada(rutaId, alumnoId, delta) {
      await esperar(60);
      const r = rutas.find((x) => x.id === rutaId)!; const i = r.paradas.findIndex((p) => p.alumno_id === alumnoId); const j = i + delta;
      if (j < 0 || j >= r.paradas.length) return;
      [r.paradas[i], r.paradas[j]] = [r.paradas[j], r.paradas[i]];
      r.paradas.forEach((p, k) => { p.orden = k + 1; });
    },
    async asignarARuta(alumnoId, rutaId) {
      await esperar(); const r = rutas.find((x) => x.id === rutaId)!; const a = alumnos.find((x) => x.id === alumnoId)!;
      if (!r.paradas.some((p) => p.alumno_id === alumnoId)) ponerEnRuta(r, a);
    },
    async quitarDeRuta(rutaId, alumnoId) {
      await esperar(); const r = rutas.find((x) => x.id === rutaId)!;
      r.paradas = r.paradas.filter((p) => p.alumno_id !== alumnoId); r.paradas.forEach((p, i) => { p.orden = i + 1; });
      const a = alumnos.find((x) => x.id === alumnoId); if (a) a.rutas = a.rutas.filter((x) => x.id !== rutaId);
    },
    async asignarConductora(rutaId, conductoraId) {
      await esperar(); const r = rutas.find((x) => x.id === rutaId)!;
      r.conductor_id = conductoraId; r.conductor_nombre = conductoras.find((c) => c.id === conductoraId)?.nombre ?? null;
    },

    async recomendarRuta(rutaId) {
      await esperar(400);
      const r = rutas.find((x) => x.id === rutaId)!;
      const conCasa = r.paradas.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.alumno_id, lat: p.lat!, lng: p.lng! }));
      return { ...recomendarRuta(conCasa, extremosDeRuta(r.tipo, r.colegio)), fuente: "estimada" as const };
    },
    async aplicarOrden(rutaId, orden) {
      await esperar();
      const r = rutas.find((x) => x.id === rutaId)!;
      if (orden.length !== r.paradas.length || !r.paradas.every((p) => orden.includes(p.alumno_id))) {
        throw new Error("La ruta cambió mientras la revisabas: vuelve a pedir la recomendación");
      }
      r.paradas.sort((a, b) => orden.indexOf(a.alumno_id) - orden.indexOf(b.alumno_id)).forEach((p, i) => { p.orden = i + 1; });
    },
    async hoyNoVa(alumnoId, tipo, valor) {
      await esperar(80);
      rutas.filter((r) => r.tipo === tipo).forEach((r) => r.paradas.forEach((p) => { if (p.alumno_id === alumnoId) p.hoy_no_va = valor; }));
    },

    async furgones() { await esperar(); return furgones.map(resumenFurgon); },
    async guardarFurgon(f) {
      await esperar();
      if (!f.patente.trim()) throw new Error("Falta la patente");
      let id = f.id;
      const datosF = { patente: f.patente.trim().toUpperCase(), modelo: f.modelo || null, capacidad: f.capacidad, conductor_id: f.conductor_id, activo: f.activo ?? true };
      if (id) Object.assign(furgones.find((x) => x.id === id)!, datosF);
      else { id = uid(); furgones.push({ id, descripcion: null, ...datosF }); }
      for (const r of rutas) {
        if (f.ruta_ids.includes(r.id)) furgonDeRuta[r.id] = id;
        else if (furgonDeRuta[r.id] === id) furgonDeRuta[r.id] = null;
        const fu = furgones.find((x) => x.id === furgonDeRuta[r.id]);
        r.furgon = fu ? `${fu.modelo ?? ""} · ${fu.patente}` : null;
      }
      return id;
    },
    async licencias() {
      await esperar();
      return conductoras.map((c) => licencias.find((l) => l.conductor_id === c.id) ?? {
        conductor_id: c.id, conductor: c.nombre, licencia_id: null, numero: null, clase: null, vence_en: null, dias_restantes: null,
        estado: "sin_licencia" as const, motivo_rechazo: null, revisada_en: null, foto_frente: null, foto_reverso: null });
    },
    async revisarLicencia(id, aprobar, motivo) {
      await esperar();
      if (!aprobar && !motivo.trim()) throw new Error("Indica el motivo del rechazo para que la tía pueda corregirlo");
      const l = licencias.find((x) => x.licencia_id === id)!;
      Object.assign(l, { estado: !aprobar ? "rechazada" : (l.dias_restantes ?? 0) <= 30 ? "por_vencer" : "vigente",
        motivo_rechazo: aprobar ? null : motivo.trim(), revisada_en: iso(new Date()) });
    },
    async fotoLicencia(ruta) { return ruta; },

    async conductoras() { await esperar(); return structuredClone(conductoras); },
    async invitarConductora() { await esperar(); return codigo(); },
    async permitirAdministrar(id, valor) { await esperar(); conductoras.find((c) => c.id === id)!.puede_administrar = valor; },

    async cobros(periodo) { await esperar(); return structuredClone(cobros.filter((c) => c.periodo === `${periodo}-01`)).sort((a, b) => a.alumno.localeCompare(b.alumno)); },
    async generarCobros(periodo) { await esperar(); return generar(periodo); },
    async registrarPago(cobroId, medio: MedioPago, nota) {
      await esperar(); const c = cobros.find((x) => x.id === cobroId)!;
      if (c.estado !== "pendiente") throw new Error("El cobro no existe o no está pendiente");
      Object.assign(c, { estado: "pagado", pagado_en: iso(new Date()), medio, nota: nota || null });
    },
    async anularCobro(cobroId, nota) {
      await esperar(); const c = cobros.find((x) => x.id === cobroId)!;
      Object.assign(c, { estado: "anulado", nota: nota || c.nota });
    },
    async cambiarMontoCobro(cobroId, monto, nota) {
      await esperar(); const c = cobros.find((x) => x.id === cobroId)!;
      if (monto < 0) throw new Error("El monto no puede ser negativo");
      if (c.estado !== "pendiente") throw new Error("Solo se puede cambiar el monto de un cobro pendiente");
      Object.assign(c, { monto, nota: nota.trim() || c.nota });
    },
    async fijarMensualidad(alumnoId, monto, desde) {
      await esperar();
      if (monto < 0) throw new Error("El precio no puede ser negativo");
      alumnos.find((x) => x.id === alumnoId)!.mensualidad = monto;
      if (!desde) return 0;
      const afectados = cobros.filter((c) => c.alumno_id === alumnoId && c.estado === "pendiente" && c.periodo >= `${desde}-01`);
      afectados.forEach((c) => { c.monto = monto; });
      return afectados.length;
    },

    async solicitudes() { await esperar(); return structuredClone(solicitudes.map(({ mensajes: _m, ...s }) => s)).sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en)); },
    async mensajes(id) { await esperar(60); return structuredClone(solicitudes.find((s) => s.id === id)!.mensajes); },
    async responder(id, cuerpo) {
      await esperar(); const s = solicitudes.find((x) => x.id === id)!;
      s.mensajes.push({ id: uid(), autor: "Administración", es_admin: true, cuerpo, creado_en: iso(new Date()) });
      if (s.estado !== "cerrada") s.estado = "respondida";
      s.actualizado_en = iso(new Date());
    },
    async cerrarSolicitud(id) { await esperar(); const s = solicitudes.find((x) => x.id === id)!; s.estado = "cerrada"; s.actualizado_en = iso(new Date()); },
    async resolverCancelacion(id, aprobar, mensaje) {
      const s = solicitudes.find((x) => x.id === id)!;
      if (mensaje.trim()) await this.responder(id, mensaje);
      if (aprobar && s.alumno_id) await this.darDeBaja(s.alumno_id, "Cancelación solicitada por el apoderado");
      Object.assign(s, { estado: "cerrada", resolucion: aprobar ? "aprobada" : "rechazada", actualizado_en: iso(new Date()) });
    },

    async preguntas() { await esperar(); return structuredClone(preguntas).sort((a, b) => a.orden - b.orden); },
    async guardarPregunta(p) {
      await esperar();
      if (p.id) Object.assign(preguntas.find((x) => x.id === p.id)!, p);
      else preguntas.push({ ...p, id: uid() });
    },
    async eliminarPregunta(id) { await esperar(); preguntas.splice(preguntas.findIndex((x) => x.id === id), 1); },

    async llamadas(mes) { await esperar(); return structuredClone(llamadas.filter((l) => enMes(l.fecha, mes))); },
    async empresa() { await esperar(); return { ...empresa }; },
    async guardarEmpresa(e) { await esperar(); Object.assign(empresa, e); },
  };
}

let sesionActiva = false;
