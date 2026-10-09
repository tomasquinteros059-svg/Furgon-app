// Mensajes de error de la base de datos (raise exception en supabase/migrations), en inglés.
export const EN_ERRORES: Record<string, string> = {
  // Sesión y permisos
  "Sin sesión": "You're not signed in",
  "No autorizado": "Not authorized",
  "No autorizado o recorrido no activo": "Not authorized, or the trip isn't active",
  "No encontrado": "Not found",
  "Solo el administrador principal puede dar este permiso": "Only the main administrator can grant this permission",
  "Solo el administrador puede crear invitaciones": "Only the administrator can create invites",
  "Solo el administrador puede hacer esto": "Only the administrator can do this",
  "El conductor no pertenece a esta empresa": "The driver doesn't belong to this company",
  "Estado no permitido": "Status not allowed",
  "Tipo no válido": "Invalid type",

  // Códigos
  "Código de invitación inválido o vencido": "Invalid or expired invite code",
  "Código de familia inválido, vencido o ya usado": "Invalid, expired, or already used family code",
  "Demasiados códigos equivocados. Espera una hora e inténtalo de nuevo.": "Too many wrong codes. Wait an hour and try again.",
  "Este código es para compartir con otra persona": "This code is meant to be shared with someone else",
  "Este código es para crear una cuenta con correo y contraseña": "This code is for creating an account with email and password",
  "Solo una cuenta de familia puede unirse": "Only a family account can join",

  // Familias, alumnos y domicilios
  "Alumno no encontrado": "Student not found",
  "Familia no encontrada": "Family not found",
  "Falta el nombre del alumno": "The student's name is missing",
  "Falta ubicar la casa en el mapa": "You still need to place the home on the map",
  "Debe registrar al menos un teléfono de contacto": "You must add at least one contact phone number",
  "Primero registra a tus hijos": "Add your children first",
  "Solo un apoderado puede registrar alumnos": "Only a parent can add students",
  "Eres el único apoderado: no puedes dejarlo sin nadie a cargo": "You're the only parent: you can't leave the child with no one in charge",
  "Solo puedes quitar a quien tú invitaste": "You can only remove people you invited",
  "Solo las familias comparten su perfil": "Only families share their profile",
  "El alumno no tiene domicilio registrado": "The student has no home address on file",
  "Ya está en su hogar": "Already home",
  "Hoy está marcado como que no viaja": "Today is marked as not riding",

  // Conexiones con la tía o el tío
  "Conductora no encontrada": "Driver not found",
  "Tía o tío no encontrado": "Driver not found",
  "Ya están conectados": "You're already connected",
  "Ya hay una solicitud pendiente": "There's already a pending request",
  "Solicitud no encontrada": "Request not found",
  "Solicitud no válida": "Invalid request",
  "La solicitud ya está cerrada": "The request is already closed",
  "La solicitud fue rechazada hace poco. Podrás volver a intentarlo en unos días.": "The request was declined recently. You can try again in a few days.",
  "Solo familias y conductores pueden conectarse": "Only families and drivers can connect",
  "Solo la tía o el tío del furgón puede buscar familias": "Only the school van driver can search for families",
  "Solo las familias pueden buscar tías o tíos": "Only families can search for drivers",
  "No estás conectado/a con esa tía o tío": "You're not connected with that driver",
  "Primero conéctate con tu tía o tío del furgón": "First connect with your school van driver",
  "Primero conéctate con tu tía o tío del furgón (botón «Conectar con mi tía o tío»).": "First connect with your school van driver (“Connect with my driver” button).",

  // Rutas, paradas y recorridos
  "Ruta no encontrada": "Route not found",
  "Ruta no válida": "Invalid route",
  "Ruta o domicilio no encontrado": "Route or home address not found",
  "Parada no encontrada": "Stop not found",
  "No tienes asignada esta ruta": "You're not assigned to this route",
  "El alumno o su domicilio no corresponden a esta ruta": "The student or their home address doesn't belong to this route",
  "La ruta cambió mientras la revisabas: vuelve a pedir la recomendación": "The route changed while you were reviewing it: request the recommendation again",
  "No hay un recorrido en curso para tu hijo/a": "There's no trip in progress for your child",
  "El furgón todavía no llega a tu casa. Toca el botón cuando tu hijo/a se suba.": "The school van hasn't reached your home yet. Tap the button when your child gets on.",

  // Furgones y licencias
  "Furgón no encontrado": "School van not found",
  "Falta la patente": "The license plate is missing",
  "La tía o el tío aún no tiene furgón registrado": "The driver hasn't registered a school van yet",
  "Licencia no encontrada": "Driver's license not found",
  "Falta la foto de la licencia": "The driver's license photo is missing",
  "Foto no válida": "Invalid photo",
  "Esa licencia ya está vencida": "That driver's license has already expired",
  "Solo la tía o el tío del furgón sube su licencia": "Only the school van driver uploads their driver's license",
  "Indica el motivo del rechazo para que la tía pueda corregirlo": "Give the reason for rejecting it so the driver can fix it",
  "Tu licencia de conducir fue rechazada o lleva más de 30 días sin revisar. Sube la licencia al día en «Mi licencia» para iniciar recorridos.":
    "Your driver's license was rejected or has gone more than 30 days without review. Upload a current license in “My license” to start trips.",

  // Mensualidades y cobros
  "El cobro no existe o no está pendiente": "The charge doesn't exist or isn't pending",
  "Solo se puede cambiar el monto de un cobro pendiente": "You can only change the amount of a pending charge",
  "El monto no puede ser negativo": "The amount can't be negative",
  "El precio no puede ser negativo": "The price can't be negative",
  "La familia marcó que hoy no viaja. Si sí viaja, quítalo en «Hoy no va».": "The family marked that this child is not riding today. If they are, remove it in “Not riding today”.",
};

/**
 * Mensajes con datos variables (raise exception '... % ...', v): no calzan por texto exacto.
 * Cada patrón reconoce el mensaje en español y lo reemplaza por el inglés ($1, $2…).
 */
export const EN_ERRORES_PATRONES: [RegExp, string][] = [
  [
    /^Tu licencia de conducir venció el (.+?)\. Sube la renovada en «Mi licencia» para iniciar recorridos\.$/,
    "Your driver's license expired on $1. Upload the renewed one in “My license” to start trips.",
  ],
];
