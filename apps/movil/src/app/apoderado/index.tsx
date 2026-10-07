import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";

interface Alumno {
  id: string;
  nombre: string;
  colegio: string | null;
  minutos_aviso: number;
}

interface EstadoHoy {
  alumno_id: string;
  estado: "pendiente" | "entregado" | "ausente" | "no_viaja";
  eta_seg: number | null;
  marcado_en: string | null;
  a_bordo_desde: string | null;
  recorrido: { tipo: "ida" | "vuelta"; estado: string };
  avisos: { id: string; disparado_en: string; confirmado_en: string | null }[];
}

/** Fecha local (Chile) en formato YYYY-MM-DD. */
function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}
const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(iso));

export default function InicioApoderado() {
  const { perfil, sesion, cerrarSesion, recargarPerfil } = useSesion();
  // Entró con código de familia (sesión anónima): su cuenta solo vive en este teléfono.
  const sinProteger = !!sesion?.user.is_anonymous;
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [estados, setEstados] = useState<EstadoHoy[]>([]);
  const [noViaja, setNoViaja] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState(0);

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: e }, { data: i }] = await Promise.all([
      supabase.from("alumnos").select("id, nombre, colegio, minutos_aviso").eq("activo", true).order("nombre"),
      supabase
        .from("recorrido_alumnos")
        .select("alumno_id, estado, eta_seg, marcado_en, a_bordo_desde, recorrido:recorridos!inner(tipo, estado), avisos(id, disparado_en, confirmado_en)")
        .eq("recorrido.estado", "activo"),
      supabase.from("inasistencias").select("alumno_id, tipo").eq("fecha", hoy()),
    ]);
    setAlumnos((a as Alumno[]) ?? []);
    setEstados((e as unknown as EstadoHoy[]) ?? []);
    setNoViaja(new Set((i ?? []).map((x) => `${x.alumno_id}:${x.tipo}`)));
    // Invitaciones de tías o tíos esperando respuesta.
    const { data: c } = await supabase.rpc("mis_conexiones");
    setSolicitudes(((c as { estado: string; iniciada_por: string }[] | null) ?? []).filter((x) => x.estado === "pendiente" && x.iniciada_por === "conductor").length);
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
    // Si una tía aceptó la conexión, la familia ya tiene furgón: se recarga el perfil.
    if (!perfil?.empresa_id) recargarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, perfil?.empresa_id]));

  // Tiempo real: cambios de estado/ETA y avisos de mis hijos (Realtime respeta RLS).
  useEffect(() => {
    const canal = supabase
      .channel("estado-hijos")
      .on("postgres_changes", { event: "*", schema: "public", table: "recorrido_alumnos" }, () => cargar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "avisos" }, () => cargar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  async function cambiarNoViaja(alumno: Alumno, tipo: "ida" | "vuelta", valor: boolean) {
    setError(null);
    const { error } = await supabase.rpc("marcar_no_viaja", {
      p_alumno: alumno.id, p_fecha: hoy(), p_tipo: tipo, p_no_viaja: valor,
    });
    if (error) setError(mensajeError(error));
    cargar();
  }

  async function yaSubio(alumno: Alumno) {
    setError(null);
    const { error } = await supabase.rpc("confirmar_subida", { p_alumno: alumno.id });
    if (error) { setError(mensajeError(error)); return; }
    await cargar();
    router.push({ pathname: "/apoderado/seguir/[id]", params: { id: alumno.id, nombre: alumno.nombre } });
  }

  async function confirmar(avisoId: string) {
    await supabase.rpc("confirmar_aviso", { p_aviso: avisoId });
    cargar();
  }

  function cambiarMinutos(alumno: Alumno) {
    const opciones = [3, 5, 7, 10, 15];
    Alert.alert("Avisarme con anticipación de…", undefined, [
      ...opciones.map((m) => ({
        text: `${m} minutos${m === alumno.minutos_aviso ? " ✓" : ""}`,
        onPress: async () => {
          await supabase.from("alumnos").update({ minutos_aviso: m }).eq("id", alumno.id);
          cargar();
        },
      })),
      { text: "Cancelar", style: "cancel" as const },
    ]);
  }

  return (
    <Pantalla titulo={`Hola, ${perfil?.nombre.split(" ")[0] ?? ""}`} accion={<Boton titulo="Salir" variante="texto" onPress={() => {
      if (!sinProteger) return cerrarSesion();
      Alert.alert("¿Salir sin proteger tu cuenta?", "Entraste con un código: si sales ahora, no podrás volver a entrar. Protégela primero con tu correo.", [
        { text: "Proteger mi cuenta", onPress: () => router.push("/apoderado/proteger-cuenta") },
        { text: "Salir igual", style: "destructive", onPress: cerrarSesion },
      ]);
    }} />}>
      {sinProteger ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>🔒 Protege tu cuenta</Text>
          <Text style={estilos.textoSuave}>Entraste con un código. Agrega tu correo y una contraseña para no perderla si cambias de teléfono.</Text>
          <Boton titulo="Agregar correo y contraseña" variante="secundario" onPress={() => router.push("/apoderado/proteger-cuenta")} />
        </Tarjeta>
      ) : null}
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {!perfil?.empresa_id ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>🤝 Conéctate con tu tía o tío del furgón</Text>
          <Text style={estilos.textoSuave}>Búscalo por su nombre o comuna y envíale una solicitud. Cuando la acepte, registras a tus hijos y empiezas a recibir los avisos.</Text>
          <Boton titulo="Buscar a mi tía o tío" onPress={() => router.push("/apoderado/conectar")} />
          <Boton titulo="Me compartieron un código de la familia" variante="texto" onPress={() => router.push("/apoderado/familia")} />
        </Tarjeta>
      ) : alumnos.length === 0 ? (
        <Aviso texto="Aún no registras alumnos. Agrega a tu hijo/a con su dirección exacta para recibir los avisos." />
      ) : null}
      {solicitudes ? (
        <Boton titulo={`🤝 ${solicitudes === 1 ? "Una tía o tío quiere" : `${solicitudes} tías o tíos quieren`} conectarse contigo`} variante="exito"
          onPress={() => router.push("/apoderado/conectar")} />
      ) : null}

      {alumnos.map((alumno) => {
        const enCurso = estados.find((e) => e.alumno_id === alumno.id);
        const aviso = enCurso?.avisos[0];
        const nombreCorto = alumno.nombre.split(" ")[0];
        // A bordo: en la vuelta hasta llegar a su hogar; en la ida hasta llegar al colegio.
        const aBordo = !!enCurso?.a_bordo_desde && (enCurso.estado === "pendiente" || (enCurso.recorrido.tipo === "ida" && enCurso.estado === "entregado"));
        const puedeDecirQueSubio = !!enCurso && !enCurso.a_bordo_desde && enCurso.estado === "pendiente";
        return (
          <Tarjeta key={alumno.id}>
            <Text style={estilos.subtitulo}>{alumno.nombre}</Text>
            {alumno.colegio ? <Text style={estilos.textoSuave}>{alumno.colegio}</Text> : null}

            {enCurso ? (
              <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#FFF8E1" }}>
                <Text style={[estilos.texto, { fontWeight: "700" }]}>
                  {enCurso.recorrido.tipo === "ida" ? "🌅 Recorrido de ida en curso" : "🏠 Recorrido de vuelta en curso"}
                </Text>
                <Text style={estilos.texto}>
                  {enCurso.estado === "entregado"
                    ? `${enCurso.recorrido.tipo === "ida" ? "Subió al furgón" : "En su hogar"} desde las ${hora(enCurso.marcado_en!)} ✅`
                    : enCurso.estado === "ausente" ? "Marcado ausente por el conductor"
                    : enCurso.estado === "no_viaja" ? "Hoy no viaja"
                    : aviso ? `🔔 Llega en ~${Math.max(1, Math.round((enCurso.eta_seg ?? 60) / 60))} min (aviso ${hora(aviso.disparado_en)})`
                    : "Te avisaremos cuando el furgón esté cerca."}
                </Text>
                {aBordo ? (
                  <Text style={[estilos.texto, { color: colores.verde, fontWeight: "700" }]}>🚐 {nombreCorto} va a bordo desde las {hora(enCurso.a_bordo_desde!)}</Text>
                ) : null}
                {puedeDecirQueSubio ? (
                  <Boton titulo={`🙋 Ya subió ${nombreCorto}`} variante="exito" onPress={() => yaSubio(alumno)} />
                ) : null}
                {enCurso.estado === "pendiente" || aBordo ? (
                  <Boton titulo={aBordo ? `🗺️ Seguir a ${nombreCorto} en vivo` : "🗺️ Seguir el furgón en vivo"} variante={aBordo ? "primario" : "secundario"}
                    onPress={() => router.push({ pathname: "/apoderado/seguir/[id]", params: { id: alumno.id, nombre: alumno.nombre } })} />
                ) : null}
                {aviso && !aviso.confirmado_en && enCurso.estado === "pendiente" ? (
                  <Boton titulo="Recibido, estoy atento/a" variante="exito" onPress={() => confirmar(aviso.id)} />
                ) : null}
              </View>
            ) : null}

            <Text style={[estilos.etiqueta, { marginTop: 12 }]}>Hoy no viaja</Text>
            {(["ida", "vuelta"] as const).map((tipo) => (
              <View key={tipo} style={[estilos.fila, { justifyContent: "space-between" }]}>
                <Text style={estilos.texto}>{tipo === "ida" ? "Ida (mañana)" : "Vuelta (tarde)"}</Text>
                <Switch
                  value={noViaja.has(`${alumno.id}:${tipo}`)}
                  onValueChange={(v) => cambiarNoViaja(alumno, tipo, v)}
                  trackColor={{ true: colores.rojo }}
                />
              </View>
            ))}

            <Boton titulo={`Aviso ${alumno.minutos_aviso} min antes · cambiar`} variante="texto" onPress={() => cambiarMinutos(alumno)} />
          </Tarjeta>
        );
      })}

      <View style={[estilos.fila, { marginTop: 4 }]}>
        <Boton titulo="💳 Pagos" variante="secundario" estilo={{ flex: 1 }} onPress={() => router.push("/apoderado/pagos")} />
        <Boton titulo="💬 Ayuda" variante="secundario" estilo={{ flex: 1 }} onPress={() => router.push("/apoderado/ayuda")} />
      </View>
      <Boton titulo="👨‍👩‍👧 Familia: compartir con papá o mamá" variante="secundario" onPress={() => router.push("/apoderado/familia")} />
      <Boton titulo="🤝 Conectar con mi tía o tío" variante="secundario" onPress={() => router.push("/apoderado/conectar")} />
      {perfil?.empresa_id ? <Boton titulo="+ Registrar alumno" variante="texto" onPress={() => router.push("/apoderado/nuevo-alumno")} /> : null}
    </Pantalla>
  );
}
