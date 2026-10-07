// Contrato de datos de la app de administración. Dos implementaciones:
// supabase.ts (real) y demo.ts (en memoria, para la demostración).

export interface Resumen {
  alumnos_activos: number;
  alumnos_sin_ruta: number;
  familias_sin_app: number;
  recorridos_activos: number;
  avisos_mes: number;
  llamadas_app_mes: number;
  llamadas_telefono_mes: number;
  minutos_telefono_mes: number;
  cobrado_mes: number;
  por_cobrar_mes: number;
  morosos: number;
  solicitudes_abiertas: number;
}

export interface Contacto {
  nombre: string;
  telefono: string;
  prioridad: number;
}

export interface Domicilio {
  id?: string;
  direccion: string;
  lat: number;
  lng: number;
  indicaciones: string | null;
}

export interface Alumno {
  id: string;
  nombre: string;
  colegio: string | null;
  curso: string | null;
  minutos_aviso: number;
  mensualidad: number | null;
  activo: boolean;
  fecha_baja: string | null;
  motivo_baja: string | null;
  domicilio: Domicilio | null;
  contactos: Contacto[];
  apoderados: { id: string; nombre: string; telefono: string | null }[];
  rutas: { id: string; nombre: string }[];
}

export interface NuevoAlumno {
  nombre: string;
  colegio: string;
  curso: string;
  minutos_aviso: number;
  mensualidad: number | null;
  domicilio: Domicilio;
  contactos: Contacto[];
  ruta_ids: string[];
}

export interface Parada {
  alumno_id: string;
  nombre: string;
  orden: number;
  direccion: string;
}

export interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  hora_salida: string | null;
  conductor_id: string | null;
  conductor_nombre: string | null;
  furgon: string | null;
  paradas: Parada[];
}

export interface Conductora {
  id: string;
  nombre: string;
  telefono: string | null;
}

export interface RecorridoHoy {
  id: string;
  ruta: string;
  estado: string;
  iniciado_en: string;
  atendidos: number;
  total: number;
  avisos: number;
}

export type EstadoCobro = "pendiente" | "pagado" | "anulado";
export type MedioPago = "efectivo" | "transferencia" | "tarjeta" | "otro";

export interface Cobro {
  id: string;
  alumno_id: string;
  alumno: string;
  periodo: string; // YYYY-MM-01
  monto: number;
  vence_en: string; // YYYY-MM-DD
  estado: EstadoCobro;
  pagado_en: string | null;
  medio: MedioPago | null;
  nota: string | null;
}

export type TipoSolicitud = "pregunta" | "cancelacion_servicio" | "cambio_datos" | "reclamo" | "otro";

export interface Solicitud {
  id: string;
  tipo: TipoSolicitud;
  asunto: string;
  estado: "abierta" | "respondida" | "cerrada";
  resolucion: "aprobada" | "rechazada" | null;
  alumno_id: string | null;
  alumno: string | null;
  autor: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Mensaje {
  id: string;
  autor: string;
  es_admin: boolean;
  cuerpo: string;
  creado_en: string;
}

export interface Pregunta {
  id: string;
  pregunta: string;
  respuesta: string;
  orden: number;
  publicada: boolean;
}

export interface LlamadaReporte {
  id: string;
  fecha: string;
  alumno: string;
  contacto: string;
  telefono: string;
  canal: "app" | "telefono";
  estado: string;
  duracion_seg: number | null;
}

export interface Empresa {
  id: string;
  nombre: string;
  mensualidad_defecto: number;
  dia_vencimiento: number;
  telefono_contacto: string | null;
}

export interface Datos {
  modo: "demo" | "real";
  sesion(): Promise<{ nombre: string } | null>;
  ingresar(email: string, password: string): Promise<void>;
  salir(): Promise<void>;

  resumen(): Promise<Resumen>;
  recorridosHoy(): Promise<RecorridoHoy[]>;

  alumnos(): Promise<Alumno[]>;
  crearAlumno(n: NuevoAlumno): Promise<{ alumno_id: string; codigo: string }>;
  actualizarAlumno(id: string, cambios: Partial<Pick<Alumno, "nombre" | "colegio" | "curso" | "minutos_aviso" | "mensualidad">>): Promise<void>;
  actualizarDomicilio(alumnoId: string, d: Domicilio): Promise<void>;
  guardarContactos(alumnoId: string, contactos: Contacto[]): Promise<void>;
  codigoFamilia(alumnoId: string): Promise<string>;
  darDeBaja(alumnoId: string, motivo: string): Promise<void>;

  rutas(): Promise<Ruta[]>;
  moverParada(rutaId: string, alumnoId: string, delta: -1 | 1): Promise<void>;
  asignarARuta(alumnoId: string, rutaId: string): Promise<void>;
  quitarDeRuta(rutaId: string, alumnoId: string): Promise<void>;
  asignarConductora(rutaId: string, conductoraId: string | null): Promise<void>;

  conductoras(): Promise<Conductora[]>;
  invitarConductora(): Promise<string>;

  cobros(periodo: string): Promise<Cobro[]>; // periodo: YYYY-MM
  generarCobros(periodo: string): Promise<number>;
  registrarPago(cobroId: string, medio: MedioPago, nota: string): Promise<void>;
  anularCobro(cobroId: string, nota: string): Promise<void>;

  solicitudes(): Promise<Solicitud[]>;
  mensajes(solicitudId: string): Promise<Mensaje[]>;
  responder(solicitudId: string, cuerpo: string): Promise<void>;
  cerrarSolicitud(solicitudId: string): Promise<void>;
  resolverCancelacion(solicitudId: string, aprobar: boolean, mensaje: string): Promise<void>;

  preguntas(): Promise<Pregunta[]>;
  guardarPregunta(p: Omit<Pregunta, "id"> & { id?: string }): Promise<void>;
  eliminarPregunta(id: string): Promise<void>;

  llamadas(mes: string): Promise<LlamadaReporte[]>; // mes: YYYY-MM
  empresa(): Promise<Empresa>;
  guardarEmpresa(e: Omit<Empresa, "id">): Promise<void>;
}
