import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
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
  const { perfil, cerrarSesion } = useSesion();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [estados, setEstados] = useState<EstadoHoy[]>([]);
  const [noViaja, setNoViaja] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: e }, { data: i }] = await Promise.all([
      supabase.from("alumnos").select("id, nombre, colegio, minutos_aviso").eq("activo", true).order("nombre"),
      supabase
        .from("recorrido_alumnos")
        .select("alumno_id, estado, eta_seg, marcado_en, recorrido:recorridos!inner(tipo, estado), avisos(id, disparado_en, confirmado_en)")
        .eq("recorrido.estado", "activo"),
      supabase.from("inasistencias").select("alumno_id, tipo").eq("fecha", hoy()),
    ]);
    setAlumnos((a as Alumno[]) ?? []);
    setEstados((e as unknown as EstadoHoy[]) ?? []);
    setNoViaja(new Set((i ?? []).map((x) => `${x.alumno_id}:${x.tipo}`)));
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
  }, [cargar]));

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
    <Pantalla titulo={`Hola, ${perfil?.nombre.split(" ")[0] ?? ""}`} accion={<Boton titulo="Salir" variante="texto" onPress={cerrarSesion} />}>
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {alumnos.length === 0 ? (
        <Aviso texto="Aún no registras alumnos. Agrega a tu hijo/a con su dirección exacta para recibir los avisos." />
      ) : null}

      {alumnos.map((alumno) => {
        const enCurso = estados.find((e) => e.alumno_id === alumno.id);
        const aviso = enCurso?.avisos[0];
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
                    ? `${enCurso.recorrido.tipo === "ida" ? "Subió al furgón" : "Entregado"} a las ${hora(enCurso.marcado_en!)} ✅`
                    : enCurso.estado === "ausente" ? "Marcado ausente por el conductor"
                    : enCurso.estado === "no_viaja" ? "Hoy no viaja"
                    : aviso ? `🔔 Llega en ~${Math.max(1, Math.round((enCurso.eta_seg ?? 60) / 60))} min (aviso ${hora(aviso.disparado_en)})`
                    : "Te avisaremos cuando el furgón esté cerca."}
                </Text>
                {enCurso.estado === "pendiente" ? (
                  <Boton titulo="🗺️ Seguir el furgón en vivo" variante="secundario"
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
      <Boton titulo="+ Registrar alumno" variante="texto" onPress={() => router.push("/apoderado/nuevo-alumno")} />
    </Pantalla>
  );
}
