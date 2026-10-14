import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import { Avatar } from "../../componentes/avatar";
import { tituloFamilia } from "../../componentes/pantalla-familia";
import { Icono, Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, FilaMenu, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { alarmaLocal, tienePush } from "../../notificaciones";
import { comoLista, mensajeError, supabase } from "../../lib/supabase";
import { locale, t } from "../../i18n";

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
  new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(iso));

export default function InicioApoderado() {
  const { perfil, sesion, cerrarSesion, recargarPerfil } = useSesion();
  // Entró con código de familia (sesión anónima): su cuenta solo vive en este teléfono.
  const sinProteger = !!sesion?.user.is_anonymous;
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const alumnosRef = useRef<Alumno[]>([]);
  alumnosRef.current = alumnos;
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
    // Un único aviso por parada: llega como objeto o null (ver comoLista).
    setEstados(((e ?? []) as unknown as (Omit<EstadoHoy, "avisos"> & { avisos: unknown })[])
      .map((x) => ({ ...x, avisos: comoLista(x.avisos as EstadoHoy["avisos"][number] | EstadoHoy["avisos"] | null) })));
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "avisos" }, (cambio) => {
        cargar();
        // Sin push (p. ej. aún sin Firebase), la alarma suena igual mientras la app está abierta.
        const aviso = cambio.new as { id?: string; alumno_id?: string; eta_seg?: number | null };
        const hijo = alumnosRef.current.find((a) => a.id === aviso.alumno_id);
        if (!tienePush() && hijo && aviso.id) {
          const min = Math.max(1, Math.round((aviso.eta_seg ?? 300) / 60));
          alarmaLocal(t("🚐 El furgón llega en ~{min} min", { min }), t("Prepara a {nombre}: el furgón está cerca.", { nombre: hijo.nombre.split(" ")[0] }),
            { tipo: "aviso", avisoId: aviso.id, alumnoId: hijo.id }).catch(() => {});
        }
      })
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
    Alert.alert(t("Avisarme con anticipación de…"), undefined, [
      ...opciones.map((m) => ({
        text: t("{n} minutos", { n: m }) + (m === alumno.minutos_aviso ? " ✓" : ""),
        onPress: async () => {
          await supabase.from("alumnos").update({ minutos_aviso: m }).eq("id", alumno.id);
          cargar();
        },
      })),
      { text: t("Cancelar"), style: "cancel" as const },
    ]);
  }

  return (
    <Pantalla antetitulo={t("Familia")} titulo={tituloFamilia(perfil?.nombre)} accion={
      <Pressable accessibilityRole="button" accessibilityLabel={t("Mi perfil")} onPress={() => router.push("/perfil")} hitSlop={8}>
        <Avatar nombre={perfil?.nombre ?? ""} foto={perfil?.foto} tam={44} />
      </Pressable>
    }>
      {sinProteger ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🔒 Protege tu cuenta")}</Text>
          <Text style={estilos.textoSuave}>{t("Entraste con un código. Agrega tu correo y una contraseña para no perderla si cambias de teléfono.")}</Text>
          <Boton titulo={t("Agregar correo y contraseña")} variante="secundario" onPress={() => router.push("/apoderado/proteger-cuenta")} />
        </Tarjeta>
      ) : null}
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {!perfil?.empresa_id ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🤝 Conéctate con tu tía o tío del furgón")}</Text>
          <Text style={estilos.textoSuave}>{t("Búscalo por su nombre o comuna y envíale una solicitud. Cuando la acepte, registras a tus hijos y empiezas a recibir los avisos.")}</Text>
          <Boton titulo={t("Buscar a mi tía o tío")} onPress={() => router.push("/apoderado/conectar")} />
          <Boton titulo={t("Me compartieron un código de la familia")} variante="texto" onPress={() => router.push("/apoderado/familia")} />
        </Tarjeta>
      ) : alumnos.length === 0 ? (
        <Aviso texto={t("Aún no registras alumnos. Agrega a tu hijo/a con su dirección exacta para recibir los avisos.")} />
      ) : null}
      {solicitudes ? (
        <Boton titulo={solicitudes === 1 ? t("🤝 Una tía o tío quiere conectarse contigo") : t("🤝 {n} tías o tíos quieren conectarse contigo", { n: solicitudes })} variante="exito"
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
              <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colores.superficie2 }}>
                <Text style={[estilos.texto, { fontWeight: "700" }]}>
                  {enCurso.recorrido.tipo === "ida" ? t("🌅 Recorrido de ida en curso") : t("🏠 Recorrido de vuelta en curso")}
                </Text>
                <Text style={estilos.texto}>
                  {enCurso.estado === "entregado"
                    ? (enCurso.recorrido.tipo === "ida"
                      ? t("Subió al furgón desde las {hora} ✅", { hora: hora(enCurso.marcado_en!) })
                      : t("En su hogar desde las {hora} ✅", { hora: hora(enCurso.marcado_en!) }))
                    : enCurso.estado === "ausente" ? t("Marcado ausente por el conductor")
                    : enCurso.estado === "no_viaja" ? t("Hoy no viaja")
                    : aviso ? t("🔔 Llega en ~{min} min (aviso {hora})", { min: Math.max(1, Math.round((enCurso.eta_seg ?? 60) / 60)), hora: hora(aviso.disparado_en) })
                    : t("Te avisaremos cuando el furgón esté cerca.")}
                </Text>
                {aBordo ? (
                  <Text style={[estilos.texto, { color: colores.verde, fontWeight: "700" }]}>{t("🚐 {nombre} va a bordo desde las {hora}", { nombre: nombreCorto, hora: hora(enCurso.a_bordo_desde!) })}</Text>
                ) : null}
                {puedeDecirQueSubio ? (
                  <Boton titulo={t("🙋 Ya subió {nombre}", { nombre: nombreCorto })} variante="exito" onPress={() => yaSubio(alumno)} />
                ) : null}
                {enCurso.estado === "pendiente" || aBordo ? (
                  <Boton titulo={aBordo ? t("🗺️ Seguir a {nombre} en vivo", { nombre: nombreCorto }) : t("🗺️ Seguir el furgón en vivo")} variante={aBordo ? "primario" : "secundario"}
                    onPress={() => router.push({ pathname: "/apoderado/seguir/[id]", params: { id: alumno.id, nombre: alumno.nombre } })} />
                ) : null}
                {aviso && !aviso.confirmado_en && enCurso.estado === "pendiente" ? (
                  <Boton titulo={t("Recibido, estoy atento/a")} variante="exito" onPress={() => confirmar(aviso.id)} />
                ) : null}
              </View>
            ) : null}

            {/* «Va en la mañana / en la tarde»: encendido = sí va (verde). Apagarlo marca «hoy no viaja». */}
            {(["ida", "vuelta"] as const).map((tipo) => {
              const va = !noViaja.has(`${alumno.id}:${tipo}`);
              return (
                <View key={tipo} style={[estilos.fila, { justifyContent: "space-between", marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.texto}>{tipo === "ida" ? t("Va en la mañana") : t("Va en la tarde")}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: va ? colores.verde : colores.rojo }}>{va ? t("Sí va") : t("Hoy no va")}</Text>
                  </View>
                  <Switch value={va} onValueChange={(v) => cambiarNoViaja(alumno, tipo, !v)}
                    trackColor={{ true: colores.verde, false: colores.borde }} thumbColor={colores.superficie} />
                </View>
              );
            })}

            <FilaMenu titulo={t("Aviso: {min} min antes", { min: alumno.minutos_aviso })} detalle={t("Cambiar cuándo te avisamos")}
              izquierda={<Icono nombre="campana" tam={24} color={colores.texto} />} onPress={() => cambiarMinutos(alumno)} />
          </Tarjeta>
        );
      })}

      {/* Mensajes y Pagos están en la barra de abajo; perfil, familia, furgón y cuenta, en «Más». */}
      {perfil?.empresa_id ? <Boton titulo={t("+ Registrar alumno")} variante="texto" onPress={() => router.push("/apoderado/nuevo-alumno")} /> : null}
    </Pantalla>
  );
}
