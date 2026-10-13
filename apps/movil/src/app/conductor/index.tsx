import { router, useFocusEffect } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { llamarFuncion, mensajeError, supabase } from "../../lib/supabase";
import { iniciarSeguimiento, pedirPermisosUbicacion } from "../../ubicacion/seguimiento";
import { type EstadoLic, textoLicencia } from "../../lib/licencia";
import { SelectorTema } from "../../componentes/tema";
import { EnlacePrivacidad } from "../../componentes/privacidad";
import { SelectorIdioma } from "../../i18n";
import { locale, t } from "../../lib/idioma";

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
interface Recomendacion { orden: string[]; metros: number; metrosActual: number; ahorroM: number; cambia: boolean; fuente: "google" | "estimada" }

// Avisos que la tía cerró (se guardan en el teléfono).
const CONSEJOS_CERRADOS = "inicio-consejos-cerrados";
const NUEVOS_VISTOS_HASTA = "inicio-nuevos-vistos-hasta";
const leer = (k: string) => { try { return Storage.getItemSync(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => {
  try { if (v == null) Storage.removeItemSync(k); else Storage.setItemSync(k, v); } catch { /* sin almacenamiento */ }
};

const km = (m: number) => `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;

/** Navegación por Google Maps con las paradas en orden (ida: termina en el colegio). */
function abrirEnMaps(ruta: Ruta, paradas: Parada[]) {
  const puntos = paradas.filter((p) => p.domicilios).map((p) => `${p.domicilios!.lat},${p.domicilios!.lng}`);
  const colegio = ruta.colegio_lat != null && ruta.colegio_lng != null ? `${ruta.colegio_lat},${ruta.colegio_lng}` : null;
  if (ruta.tipo === "ida" && colegio) puntos.push(colegio);
  if (!puntos.length) return;
  const destino = puntos[puntos.length - 1];
  // Google Maps acepta hasta 9 paradas intermedias en el enlace.
  const intermedias = puntos.slice(0, -1).slice(0, 9).join("|");
  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destino)}`
    + (intermedias ? `&waypoints=${encodeURIComponent(intermedias)}` : "");
  Linking.openURL(url).catch(() => {});
}

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
  const { perfil, cerrarSesion } = useSesion();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [activos, setActivos] = useState<Record<string, string>>({});
  const [noVan, setNoVan] = useState<{ alumno_id: string; tipo: string }[]>([]);
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [porResponder, setPorResponder] = useState(0);
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [licencia, setLicencia] = useState<EstadoLic | null>(null);
  const [menu, setMenu] = useState(false);
  const [consejosCerrados, setConsejosCerrados] = useState(() => leer(CONSEJOS_CERRADOS) === "1");
  const [nuevosVistosHasta, setNuevosVistosHasta] = useState(() => leer(NUEVOS_VISTOS_HASTA) ?? "");
  const [recomendacion, setRecomendacion] = useState<{ rutaId: string; r: Recomendacion } | null>(null);
  const [calculando, setCalculando] = useState<string | null>(null);

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
  }, [cargar]));

  const noVaHoy = (alumnoId: string, tipo: "ida" | "vuelta") =>
    noVan.some((x) => x.alumno_id === alumnoId && (x.tipo === tipo || x.tipo === "ambos"));

  async function iniciar(ruta: Ruta) {
    setError(null);
    setIniciando(ruta.id);
    try {
      // Primero los permisos: así no queda un recorrido iniciado sin GPS.
      const permisos = await pedirPermisosUbicacion();
      if (!permisos.ok) {
        Alert.alert(t("Permiso de ubicación"), permisos.mensaje);
        return;
      }
      const { data: recorridoId, error } = await supabase.rpc("iniciar_recorrido", { p_ruta: ruta.id });
      if (error) throw error;
      const gps = await iniciarSeguimiento(recorridoId as string);
      if (!gps.ok) {
        Alert.alert(t("Permiso de ubicación"), gps.mensaje);
        return;
      }
      router.push(`/conductor/recorrido/${recorridoId}`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setIniciando(null);
    }
  }

  async function recomendar(ruta: Ruta) {
    setError(null);
    setExito(null);
    setCalculando(ruta.id);
    try {
      setRecomendacion({ rutaId: ruta.id, r: await llamarFuncion<Recomendacion>("recomendar-ruta", { ruta_id: ruta.id }) });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCalculando(null);
    }
  }

  async function aplicar(ruta: Ruta, orden: string[]) {
    setRecomendacion(null);
    const { error } = await supabase.rpc("aplicar_orden_ruta", { p_ruta: ruta.id, p_alumnos: orden });
    if (error) setError(mensajeError(error));
    else setExito(t("Listo: {ruta} quedó con el orden recomendado.", { ruta: ruta.nombre }));
    cargar();
  }

  const enRecorrido = Object.keys(activos).length > 0;
  const nuevosSinVer = nuevos.filter((x) => x.agregado_en > nuevosVistosHasta);
  const licenciaConProblema = !!licencia && licencia.estado !== "vigente";
  const irA = (ruta: string) => { setMenu(false); router.push(ruta as never); };

  const botonMenu = (
    <Pressable accessibilityRole="button" accessibilityLabel={t("Más opciones")} onPress={() => setMenu(true)} hitSlop={10}
      style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 26, fontWeight: "900", color: colores.texto }}>⋮</Text>
      {porResponder || licenciaConProblema ? (
        <View style={{ position: "absolute", top: 4, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: colores.rojo }} />
      ) : null}
    </Pressable>
  );

  return (
    <Pantalla titulo={t("Hola, {nombre}", { nombre: perfil?.nombre.split(" ")[0] ?? "" })} accion={botonMenu}>
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
        const van = paradas.filter((p) => !noVaHoy(p.alumno_id, ruta.tipo));
        const rec = recomendacion?.rutaId === ruta.id ? recomendacion.r : null;
        const nombre = (id: string) => paradas.find((p) => p.alumno_id === id)?.alumnos?.nombre ?? "—";
        return (
          <Tarjeta key={ruta.id} estilo={activo ? { borderColor: colores.verde, borderWidth: 2 } : undefined}>
            <Text style={estilos.subtitulo}>{ruta.tipo === "ida" ? "🌅" : "🏠"} {ruta.nombre}</Text>
            <Text style={estilos.textoSuave}>
              {ruta.tipo === "ida" ? t("Casa → colegio") : t("Colegio → casa")}
              {ruta.hora_salida ? ` · ${ruta.hora_salida.slice(0, 5)}` : ""}
              {ruta.colegio_nombre ? ` · ${ruta.colegio_nombre}` : ""}
            </Text>

            {/* Los niños que hay que ir a buscar hoy, en el orden de la ruta. */}
            <Text style={[estilos.etiqueta, { marginTop: 10 }]}>
              {ruta.tipo === "ida" ? t("A buscar hoy ({n})", { n: van.length }) : t("A dejar hoy ({n})", { n: van.length })}
            </Text>
            {paradas.length === 0 ? <Text style={estilos.textoSuave}>{t("Esta ruta aún no tiene alumnos.")}</Text> : null}
            {paradas.map((p, i) => {
              const noVa = noVaHoy(p.alumno_id, ruta.tipo);
              return (
                <View key={p.alumno_id} style={{ paddingVertical: 6, borderBottomWidth: i === paradas.length - 1 ? 0 : 1, borderColor: colores.borde }}>
                  <Text style={[estilos.texto, { fontWeight: "600" }, noVa && { color: colores.suave, textDecorationLine: "line-through" }]}>
                    {i + 1}. {p.alumnos?.nombre ?? "—"}
                  </Text>
                  {noVa ? (
                    <Text style={estilos.textoSuave}>{t("Hoy no viaja")}</Text>
                  ) : p.domicilios?.direccion ? (
                    <Text style={estilos.textoSuave}>{p.domicilios.direccion}</Text>
                  ) : null}
                </View>
              );
            })}

            {/* Mejor ruta: navegar con Google Maps y, si administra, recalcular el orden. */}
            {van.length ? (
              <Boton titulo={t("🗺️ Ver la ruta en Google Maps")} variante="secundario" onPress={() => abrirEnMaps(ruta, van)} />
            ) : null}
            {perfil?.puede_administrar && paradas.length >= 2 && !rec && !activo ? (
              <Boton titulo={calculando === ruta.id ? t("Calculando…") : t("🧭 Calcular la mejor ruta")} variante="secundario"
                cargando={calculando === ruta.id} onPress={() => recomendar(ruta)} />
            ) : null}
            {rec ? (
              <View style={{ gap: 6, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: colores.amarillo, marginTop: 6 }}>
                {rec.cambia ? (
                  <>
                    <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("✨ Ruta recomendada: {km} (antes {antes})", { km: km(rec.metros), antes: km(rec.metrosActual) })}</Text>
                    <Text style={estilos.textoSuave}>{t("Ahorras {km} por recorrido.", { km: km(rec.ahorroM) })} {rec.fuente === "google" ? t("Calculada por calles con Google Maps.") : t("Calculada por distancia (aproximada).")}</Text>
                    {rec.orden.map((id, i) => <Text key={id} style={estilos.texto}>{i + 1}. {nombre(id)}</Text>)}
                    <View style={estilos.fila}>
                      <Boton titulo={t("Aplicar")} variante="exito" estilo={{ flex: 1 }} onPress={() => aplicar(ruta, rec.orden)} />
                      <Boton titulo={t("Descartar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setRecomendacion(null)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={estilos.texto}>{t("👍 El orden actual ya es el más corto (≈ {km}).", { km: km(rec.metrosActual) })}</Text>
                    <Boton titulo={t("Cerrar")} variante="texto" onPress={() => setRecomendacion(null)} />
                  </>
                )}
              </View>
            ) : null}

            {activo ? (
              <Boton titulo={t("Continuar recorrido en curso")} variante="exito" grande
                onPress={() => router.push(`/conductor/recorrido/${activo}`)} />
            ) : (
              <Boton titulo={t("Iniciar recorrido")} grande cargando={iniciando === ruta.id} onPress={() => iniciar(ruta)} />
            )}
          </Tarjeta>
        );
      })}

      {/* Menú de los tres puntitos: todo lo que no se usa a diario. */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setMenu(false)}>
          <Pressable onPress={() => {}} style={{ marginTop: 60, marginHorizontal: 12, maxHeight: "85%", backgroundColor: colores.fondo, borderRadius: 16, overflow: "hidden" }}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {/* Abajo están Inicio, Alumnos, Rutas y Mensajes (conductor/_layout.tsx); aquí, lo demás. */}
              {perfil?.puede_administrar ? (
                enRecorrido ? (
                  <Aviso texto={t("Administrar: disponible cuando termines el recorrido (no se administra manejando).")} />
                ) : (
                  <>
                    <Boton titulo={t("💳 Cobros")} variante="secundario" onPress={() => irA("/conductor/administrar/cobros")} />
                    <Boton titulo={t("🧑‍💼 Resumen de administración")} variante="secundario" onPress={() => irA("/conductor/administrar")} />
                  </>
                )
              ) : null}
              <Boton titulo={porResponder ? t("🤝 Familias por conectar ({n})", { n: porResponder }) : t("🤝 Conectar con familias")}
                variante={porResponder ? "exito" : "secundario"} onPress={() => irA("/conductor/conexiones")} />
              <Boton titulo={licencia ? t("🪪 Mi licencia · {estado}", { estado: textoLicencia(licencia).txt }) : t("🪪 Mi licencia")}
                variante="secundario" onPress={() => irA("/conductor/licencia")} />
              {consejosCerrados || nuevosVistosHasta ? (
                <Boton titulo={t("Volver a mostrar los avisos")} variante="texto" onPress={() => {
                  guardar(CONSEJOS_CERRADOS, null); guardar(NUEVOS_VISTOS_HASTA, null);
                  setConsejosCerrados(false); setNuevosVistosHasta(""); setMenu(false);
                }} />
              ) : null}
              <Tarjeta><SelectorTema /></Tarjeta>
              <Tarjeta><SelectorIdioma /></Tarjeta>
              <EnlacePrivacidad />
              <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => irA("/eliminar-cuenta")} />
              <Boton titulo={t("Salir")} variante="peligro" onPress={() => { setMenu(false); cerrarSesion(); }} />
              <Boton titulo={t("Cerrar")} variante="texto" onPress={() => setMenu(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Pantalla>
  );
}
