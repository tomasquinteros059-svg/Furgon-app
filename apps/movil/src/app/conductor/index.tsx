import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Icono, Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { supabase } from "../../lib/supabase";
import { useIniciarRecorrido } from "../../lib/iniciar-recorrido";
import { CONSEJOS_CERRADOS, guardar, leer, NUEVOS_VISTOS_HASTA } from "../../lib/avisos-inicio";
import { type EstadoLic, textoLicencia } from "../../lib/licencia";
import { t } from "../../lib/idioma";

interface Parada {
  alumno_id: string;
  orden: number;
  alumnos: { nombre: string } | null;
  domicilios: { direccion: string; lat: number; lng: number } | null;
}
interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  hora_salida: string | null;
  colegio_nombre: string | null;
  colegio_lat: number | null;
  colegio_lng: number | null;
  ruta_paradas: Parada[];
}
interface Nuevo { alumno: string; ruta: string; tipo: "ida" | "vuelta"; parada: number; agregado_en: string }

/** Aviso que se puede cerrar con la ✕. */
function AvisoCerrable({ texto, onCerrar }: { texto: string; onCerrar: () => void }) {
  return (
    <View style={{ position: "relative" }}>
      <Aviso texto={texto} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("Cerrar aviso")} onPress={onCerrar} hitSlop={12}
        style={{ position: "absolute", top: 6, right: 8, padding: 4 }}>
        <Text style={{ fontSize: 18, color: colores.suave }}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function RutasConductor() {
  const { perfil } = useSesion();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [activos, setActivos] = useState<Record<string, string>>({});
  const [noVan, setNoVan] = useState<{ alumno_id: string; tipo: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [porResponder, setPorResponder] = useState(0);
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [licencia, setLicencia] = useState<EstadoLic | null>(null);
  const [consejosCerrados, setConsejosCerrados] = useState(() => leer(CONSEJOS_CERRADOS) === "1");
  const [nuevosVistosHasta, setNuevosVistosHasta] = useState(() => leer(NUEVOS_VISTOS_HASTA) ?? "");
  const { iniciando, iniciar } = useIniciarRecorrido(setError);

  const cargar = useCallback(async () => {
    const { data: fecha } = await supabase.rpc("hoy_empresa");
    const [{ data: r }, { data: rec }, { data: i }] = await Promise.all([
      // Solo sus rutas (con permiso de administrar vería también las de otras conductoras).
      supabase.from("rutas")
        .select("id, nombre, tipo, hora_salida, colegio_nombre, colegio_lat, colegio_lng, ruta_paradas(alumno_id, orden, alumnos(nombre), domicilios(direccion, lat, lng))")
        .eq("activa", true).eq("conductor_id", perfil?.id ?? "").order("hora_salida"),
      supabase.from("recorridos").select("id, ruta_id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? ""),
      fecha ? supabase.from("inasistencias").select("alumno_id, tipo").eq("fecha", fecha as string) : Promise.resolve({ data: [] }),
    ]);
    setRutas(((r as unknown as Ruta[]) ?? []).map((x) => ({ ...x, ruta_paradas: [...(x.ruta_paradas ?? [])].sort((a, b) => a.orden - b.orden) })));
    setActivos(Object.fromEntries((rec ?? []).map((x) => [x.ruta_id, x.id])));
    setNoVan((i as { alumno_id: string; tipo: string }[]) ?? []);
    const { data: l } = await supabase.rpc("estado_licencias");
    setLicencia(((l as (EstadoLic & { conductor_id: string })[]) ?? []).find((x) => x.conductor_id === perfil?.id) ?? null);
    const { data: n } = await supabase.rpc("nuevos_en_mis_rutas", { p_dias: 3 });
    setNuevos((n as Nuevo[]) ?? []);
    const { data: c } = await supabase.rpc("mis_conexiones");
    setPorResponder(((c as { estado: string; iniciada_por: string }[] | null) ?? []).filter((x) => x.estado === "pendiente" && x.iniciada_por === "apoderado").length);
  }, [perfil?.id]);

  useFocusEffect(useCallback(() => {
    cargar();
    // «Volver a mostrar los avisos» (pestaña Más) los borra del teléfono: se releen al volver.
    setConsejosCerrados(leer(CONSEJOS_CERRADOS) === "1");
    setNuevosVistosHasta(leer(NUEVOS_VISTOS_HASTA) ?? "");
  }, [cargar]));

  const noVaHoy = (alumnoId: string, tipo: "ida" | "vuelta") =>
    noVan.some((x) => x.alumno_id === alumnoId && (x.tipo === tipo || x.tipo === "ambos"));

  const nuevosSinVer = nuevos.filter((x) => x.agregado_en > nuevosVistosHasta);
  const licenciaConProblema = !!licencia && licencia.estado !== "vigente";


  return (
    <Pantalla antetitulo={t("Tía del furgón")} titulo={t("Hola, {nombre}", { nombre: perfil?.nombre ?? "" })}>
      {!consejosCerrados ? (
        <AvisoCerrable
          texto={t("Inicia el recorrido antes de partir. Los avisos a los apoderados se envían solos: no necesitas tocar el teléfono mientras manejas.") + "\n\n"
            + t("📡 Tu celular es el GPS del furgón: mantenlo con batería, con la ubicación activada y en su soporte.")}
          onCerrar={() => { guardar(CONSEJOS_CERRADOS, "1"); setConsejosCerrados(true); }} />
      ) : null}
      {error ? <Aviso texto={error} tipo="error" /> : null}
      {exito ? <Aviso texto={exito} tipo="exito" /> : null}

      {licenciaConProblema ? (
        <Tarjeta estilo={{ borderColor: licencia!.estado === "por_verificar" ? colores.amarillo : colores.rojo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🪪 Mi licencia")}</Text>
          <Text style={estilos.texto}>{textoLicencia(licencia!).txt}</Text>
          <Boton titulo={licencia!.estado === "por_verificar" ? t("Ver mi licencia") : t("Subir licencia")} variante="secundario"
            onPress={() => router.push("/conductor/licencia")} />
        </Tarjeta>
      ) : null}

      {porResponder ? (
        <Boton titulo={porResponder === 1 ? t("🤝 1 familia quiere conectarse contigo") : t("🤝 {n} familias quieren conectarse contigo", { n: porResponder })}
          variante="exito" onPress={() => router.push("/conductor/conexiones")} />
      ) : null}

      {nuevosSinVer.length ? (
        <Tarjeta estilo={{ borderColor: colores.verde, borderWidth: 2 }}>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <Text style={[estilos.subtitulo, { flex: 1 }]}>{t("🆕 Se sumaron a tus rutas")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Cerrar aviso")} hitSlop={12} onPress={() => {
              const hasta = nuevos.reduce((m, x) => (x.agregado_en > m ? x.agregado_en : m), nuevosVistosHasta);
              guardar(NUEVOS_VISTOS_HASTA, hasta);
              setNuevosVistosHasta(hasta);
            }}>
              <Text style={{ fontSize: 18, color: colores.suave }}>✕</Text>
            </Pressable>
          </View>
          {nuevosSinVer.map((x, i) => (
            <Text key={i} style={estilos.texto}>
              {x.tipo === "ida" ? "🌅" : "🏠"} <Text style={{ fontWeight: "700" }}>{x.alumno}</Text> · {t("{ruta}, parada {parada}", { ruta: x.ruta, parada: x.parada })}
            </Text>
          ))}
          <Text style={estilos.textoSuave}>{t("Quedaron donde menos alargan el recorrido. Su familia ya recibe los avisos.")}</Text>
        </Tarjeta>
      ) : null}

      {rutas.length === 0 ? <Text style={estilos.textoSuave}>{t("No tienes rutas asignadas.")}</Text> : null}
      {rutas.map((ruta) => {
        const activo = activos[ruta.id];
        const paradas = ruta.ruta_paradas;
        // Primero los que van (numerados en orden); al final, los que hoy no van.
        const van = paradas.filter((p) => !noVaHoy(p.alumno_id, ruta.tipo));
        const noVan = paradas.filter((p) => noVaHoy(p.alumno_id, ruta.tipo));
        const colegio = ruta.colegio_nombre ?? t("Colegio");
        return (
          <Tarjeta key={ruta.id} estilo={activo ? { borderColor: colores.verde } : undefined}>
            <View style={[estilos.fila, { gap: 14, alignItems: "center" }]}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, alignItems: "center", justifyContent: "center" }}>
                <Icono nombre={ruta.tipo === "ida" ? "furgon" : "casa"} tam={30} color={colores.sobreAmarillo} acento="transparent" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 24, fontWeight: "700", color: colores.texto }}>{ruta.nombre}</Text>
                {ruta.hora_salida ? (
                  <View style={[estilos.fila, { gap: 6 }]}>
                    <Icono nombre="reloj" tam={18} color={colores.suave} acento="transparent" />
                    <Text style={{ fontSize: 17, color: colores.suave }}>{ruta.hora_salida.slice(0, 5)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ backgroundColor: colores.superficie2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 1, maxWidth: "55%" }}>
                <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "600", color: colores.texto, textAlign: "center" }}>
                  {ruta.tipo === "ida" ? `${t("Casa")} → ${colegio}` : `${colegio} → ${t("Casa")}`}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 15, fontWeight: "700", color: colores.suave, letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>
              {(ruta.tipo === "ida" ? t("A buscar hoy") : t("A dejar hoy")).toUpperCase()} · {van.length}
            </Text>
            {paradas.length === 0 ? <Text style={estilos.textoSuave}>{t("Esta ruta aún no tiene alumnos.")}</Text> : null}
            {van.map((p, i) => (
              <View key={p.alumno_id} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colores.crema, borderWidth: 2, borderColor: colores.borde, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colores.sobreAmarillo }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{p.alumnos?.nombre ?? "—"}</Text>
                  {p.domicilios?.direccion ? (
                    <View style={[estilos.fila, { gap: 6, alignItems: "flex-start" }]}>
                      <Icono nombre="pin" tam={18} color={colores.suave} acento="transparent" />
                      <Text style={{ fontSize: 15, color: colores.suave, flex: 1 }}>{p.domicilios.direccion}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {noVan.map((p) => (
              <View key={p.alumno_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: colores.superficie2, borderWidth: 2, borderStyle: "dashed", borderColor: colores.borde, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colores.suave, textDecorationLine: "line-through", flex: 1 }}>{p.alumnos?.nombre ?? "—"}</Text>
                <View style={{ backgroundColor: colores.rojoSuave, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colores.rojo }}>{t("Hoy no va")}</Text>
                </View>
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              {activo ? (
                <Boton titulo={t("Continuar recorrido")} icono="navegar" variante="exito" grande
                  onPress={() => router.push(`/conductor/recorrido/${activo}`)} />
              ) : (
                <Boton titulo={t("Iniciar recorrido")} icono="navegar" grande cargando={iniciando === ruta.id} deshabilitado={van.length === 0}
                  onPress={() => { setError(null); iniciar(ruta.id); }} />
              )}
            </View>
          </Tarjeta>
        );
      })}

    </Pantalla>
  );
}
