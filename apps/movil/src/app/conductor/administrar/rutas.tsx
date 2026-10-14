import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Icono, Text } from "../../../componentes/icono";
import { PantallaTia } from "../../../componentes/pantalla-tia";
import { Aviso, Boton, Campo, colores, estilos, Tarjeta } from "../../../componentes/ui";
import { useIniciarRecorrido } from "../../../lib/iniciar-recorrido";
import { useSesion } from "../../../lib/sesion";
import { llamarFuncion, mensajeError, supabase } from "../../../lib/supabase";
import { locale, t } from "../../../lib/idioma";

interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  conductor_id: string | null;
  hora_salida: string | null;
  colegio_nombre: string | null;
  ruta_paradas: { alumno_id: string; orden: number; alumnos: { nombre: string }; domicilios: { direccion: string } | null }[];
}
interface Recomendacion { orden: string[]; metros: number; metrosActual: number; ahorroM: number; cambia: boolean; fuente: "google" | "estimada" }

const km = (m: number) => `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;

export default function RutasAdmin() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);
  const [noVan, setNoVan] = useState<{ alumno_id: string; tipo: string }[]>([]);
  const [hoy, setHoy] = useState<string | null>(null);
  const [agregando, setAgregando] = useState<string | null>(null);
  const [recomendacion, setRecomendacion] = useState<{ rutaId: string; r: Recomendacion } | null>(null);
  const [calculando, setCalculando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const { perfil } = useSesion();
  const { iniciando, iniciar } = useIniciarRecorrido(setError);
  // Ruta nueva (por ejemplo, una salida extra o un colegio más).
  const [creando, setCreando] = useState(false);
  // Rutas abiertas (tarjeta desplegada). La primera parte abierta.
  const [abiertas, setAbiertas] = useState<Set<string> | null>(null);
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [nuevaTipo, setNuevaTipo] = useState<"ida" | "vuelta">("ida");
  const [nuevaHora, setNuevaHora] = useState("");
  const [nuevaColegio, setNuevaColegio] = useState("");

  const cargar = useCallback(async () => {
    const { data: fecha } = await supabase.rpc("hoy_empresa");
    const [r, a, i] = await Promise.all([
      supabase.from("rutas").select("id, nombre, tipo, conductor_id, hora_salida, colegio_nombre, ruta_paradas(alumno_id, orden, alumnos(nombre), domicilios(direccion))").eq("activa", true).order("nombre"),
      supabase.from("alumnos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("inasistencias").select("alumno_id, tipo").eq("fecha", fecha as string),
    ]);
    setHoy(fecha as string);
    setRutas((r.data as unknown as Ruta[]) ?? []); setAlumnos(a.data ?? []); setNoVan(i.data ?? []);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  const hacer = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    setError(null); setExito(null);
    const { error } = await p;
    if (error) setError(mensajeError(error)); else if (ok) setExito(ok);
    cargar();
  };

  const noVaHoy = (alumnoId: string, tipo: string) => noVan.some((x) => x.alumno_id === alumnoId && (x.tipo === tipo || x.tipo === "ambos"));
  async function cambiarHoyNoVa(alumnoId: string, nombre: string, tipo: "ida" | "vuelta", valor: boolean) {
    if (!hoy) return;
    const marcar = (tramo: string, v: boolean) => supabase.rpc("marcar_no_viaja", { p_alumno: alumnoId, p_fecha: hoy, p_tipo: tramo, p_no_viaja: v });
    setError(null); setExito(null);
    // Si estaba marcado el día completo, el servidor deja marcado solo el otro tramo.
    const res = await marcar(tipo, valor);
    if (res.error) setError(mensajeError(res.error));
    else setExito(valor ? t("{nombre} no va hoy: tu ruta de hoy se salta su casa y su familia no recibe aviso.", { nombre }) : t("{nombre} sí va hoy.", { nombre }));
    cargar();
  }

  async function recomendar(ruta: Ruta) {
    setError(null); setExito(null); setCalculando(ruta.id);
    try {
      setRecomendacion({ rutaId: ruta.id, r: await llamarFuncion<Recomendacion>("recomendar-ruta", { ruta_id: ruta.id }) });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCalculando(null);
    }
  }

  async function crearRuta() {
    const nombre = nuevaNombre.trim();
    const hora = nuevaHora.trim();
    if (!nombre) { setError(t("Ponle un nombre a la ruta.")); return; }
    if (hora && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(hora)) { setError(t("La hora va como 07:30.")); return; }
    if (!perfil?.empresa_id) return;
    await hacer(supabase.from("rutas").insert({
      empresa_id: perfil.empresa_id, nombre, tipo: nuevaTipo, conductor_id: perfil.id,
      hora_salida: hora || null, colegio_nombre: nuevaColegio.trim() || null,
    }), t("Ruta «{ruta}» creada. Agrégale alumnos abajo.", { ruta: nombre }));
    setCreando(false); setNuevaNombre(""); setNuevaHora(""); setNuevaColegio(""); setNuevaTipo("ida");
  }

  function eliminarRuta(r: Ruta) {
    Alert.alert(t("¿Eliminar la ruta «{ruta}»?", { ruta: r.nombre }), t("Los alumnos siguen registrados; solo se quitan de esta ruta."), [
      { text: t("Cancelar"), style: "cancel" },
      { text: t("Eliminar"), style: "destructive", onPress: () => hacer(supabase.from("rutas").update({ activa: false }).eq("id", r.id), t("Ruta eliminada.")) },
    ]);
  }

  const estaAbierta = (id: string) => (abiertas ? abiertas.has(id) : rutas[0]?.id === id);
  const alternar = (id: string) => {
    const actuales = new Set(abiertas ?? (rutas[0] ? [rutas[0].id] : []));
    if (actuales.has(id)) actuales.delete(id); else actuales.add(id);
    setAbiertas(actuales);
  };
  const flecha = (texto: string, desactivada: boolean, onPress: () => void, etiqueta: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} disabled={desactivada} onPress={onPress} hitSlop={6}
      style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", opacity: desactivada ? 0.3 : 1 }}>
      <Text style={{ fontSize: 24, color: colores.texto }}>{texto}</Text>
    </Pressable>
  );

  return (
    <PantallaTia descripcion={t("Ordena los alumnos, marca quién no va y crea rutas nuevas.")}>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {exito ? <Aviso tipo="exito" texto={exito} /> : null}
      {creando ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo }}>
          <Text style={estilos.subtitulo}>{t("Nueva ruta")}</Text>
          <Campo etiqueta={t("Nombre")} value={nuevaNombre} onChangeText={setNuevaNombre} placeholder={t("Ej.: Mañana Colegio San José")} />
          <Text style={estilos.etiqueta}>{t("Tipo")}</Text>
          <View style={[estilos.fila, { marginBottom: 14 }]}>
            <Boton titulo={t("🌅 Ida (casa → colegio)")} variante={nuevaTipo === "ida" ? "primario" : "secundario"} estilo={{ flex: 1 }} onPress={() => setNuevaTipo("ida")} />
            <Boton titulo={t("🏠 Vuelta (colegio → casa)")} variante={nuevaTipo === "vuelta" ? "primario" : "secundario"} estilo={{ flex: 1 }} onPress={() => setNuevaTipo("vuelta")} />
          </View>
          <Campo etiqueta={t("Hora de salida (opcional)")} value={nuevaHora} onChangeText={setNuevaHora} placeholder="07:30" keyboardType="numbers-and-punctuation" />
          <Campo etiqueta={t("Colegio (opcional)")} value={nuevaColegio} onChangeText={setNuevaColegio} />
          <View style={estilos.fila}>
            <Boton titulo={t("Crear ruta")} estilo={{ flex: 1 }} onPress={crearRuta} />
            <Boton titulo={t("Cancelar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setCreando(false)} />
          </View>
        </Tarjeta>
      ) : null}

      {rutas.map((r) => {
        const paradas = [...r.ruta_paradas].sort((a, b) => a.orden - b.orden);
        const fuera = alumnos.filter((a) => !paradas.some((p) => p.alumno_id === a.id));
        const rec = recomendacion?.rutaId === r.id ? recomendacion.r : null;
        const nombre = (id: string) => paradas.find((p) => p.alumno_id === id)?.alumnos?.nombre ?? "—";
        const abierta = estaAbierta(r.id);
        const colegio = r.colegio_nombre ?? t("Colegio");
        return (
          <View key={r.id} style={{ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 30, marginBottom: 18, overflow: "hidden" }}>
            {/* Encabezado: se toca para abrir o cerrar la ruta. */}
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: abierta }} accessibilityLabel={r.nombre} onPress={() => alternar(r.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 18 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, alignItems: "center", justifyContent: "center" }}>
                <Icono nombre={r.tipo === "ida" ? "furgon" : "casa"} tam={28} color={colores.sobreAmarillo} acento="transparent" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 22, fontWeight: "700", color: colores.texto }}>{r.nombre}</Text>
                <View style={[estilos.fila, { gap: 6 }]}>
                  <Icono nombre="reloj" tam={17} color={colores.suave} acento="transparent" />
                  <Text numberOfLines={1} style={{ fontSize: 15, color: colores.suave, flex: 1 }}>
                    {r.hora_salida ? `${r.hora_salida.slice(0, 5)} · ` : ""}{r.tipo === "ida" ? `${t("Casa")} → ${colegio}` : `${colegio} → ${t("Casa")}`}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 22, color: colores.texto }}>{abierta ? "⌃" : "⌄"}</Text>
            </Pressable>

            {abierta ? (
              <View style={{ backgroundColor: colores.crema, borderTopWidth: 2, borderColor: colores.borde, padding: 16, gap: 10 }}>
                {r.conductor_id === perfil?.id ? (
                  <Boton titulo={t("Iniciar recorrido")} icono="navegar" grande cargando={iniciando === r.id} deshabilitado={paradas.length === 0}
                    onPress={() => { setError(null); setExito(null); iniciar(r.id); }} />
                ) : r.conductor_id ? (
                  <Text style={estilos.textoSuave}>{t("La maneja otra tía o tío.")}</Text>
                ) : (
                  <Boton titulo={t("Asignármela para manejarla")} variante="secundario"
                    onPress={() => hacer(supabase.from("rutas").update({ conductor_id: perfil?.id }).eq("id", r.id), t("Listo: ahora puedes iniciar «{ruta}».", { ruta: r.nombre }))} />
                )}

                {paradas.length === 0 ? <Text style={estilos.textoSuave}>{t("Esta ruta aún no tiene alumnos.")}</Text> : null}
                {paradas.map((p, i) => {
                  const noVa = noVaHoy(p.alumno_id, r.tipo);
                  return (
                    <View key={p.alumno_id} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 22, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, opacity: noVa ? 0.6 : 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colores.sobreAmarillo }}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "600", color: colores.texto, textDecorationLine: noVa ? "line-through" : "none" }}>{p.alumnos?.nombre}</Text>
                        {p.domicilios?.direccion ? <Text numberOfLines={1} style={{ fontSize: 14, color: colores.suave }}>{p.domicilios.direccion}</Text> : null}
                      </View>
                      {flecha("↑", i === 0, () => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: -1 })), t("Subir"))}
                      {flecha("↓", i === paradas.length - 1, () => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: 1 })), t("Bajar"))}
                      <Pressable accessibilityRole="button" accessibilityLabel={noVa ? t("Sí va") : t("Hoy no va")}
                        onPress={() => cambiarHoyNoVa(p.alumno_id, p.alumnos?.nombre ?? "", r.tipo, !noVa)}
                        style={{ backgroundColor: noVa ? colores.amarillo : colores.superficie2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: noVa ? colores.sobreAmarillo : colores.texto }}>{noVa ? t("Sí va") : t("Hoy no va")}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t("Quitar de la ruta")} hitSlop={6}
                        onPress={() => hacer(supabase.from("ruta_paradas").delete().eq("ruta_id", r.id).eq("alumno_id", p.alumno_id))}
                        style={{ width: 34, height: 40, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 22, color: colores.rojo }}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}

                {paradas.length >= 2 && !rec ? (
                  <Boton titulo={calculando === r.id ? t("Calculando…") : t("Calcular la mejor ruta")} icono="brujula" variante="secundario" cargando={calculando === r.id} onPress={() => recomendar(r)} />
                ) : null}
                {rec ? (
                  <View style={{ gap: 6, padding: 14, borderRadius: 22, borderWidth: 2, borderColor: colores.amarillo, backgroundColor: colores.superficie }}>
                    {rec.cambia ? (
                      <>
                        <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("✨ Ruta recomendada: {km} (antes {antes})", { km: km(rec.metros), antes: km(rec.metrosActual) })}</Text>
                        <Text style={estilos.textoSuave}>{t("Ahorras {km} por recorrido.", { km: km(rec.ahorroM) })} {rec.fuente === "google" ? t("Calculada por calles con Google Maps.") : t("Calculada por distancia (aproximada).")}</Text>
                        {rec.orden.map((id, i) => <Text key={id} style={estilos.texto}>{i + 1}. {nombre(id)}</Text>)}
                        <View style={estilos.fila}>
                          <Boton titulo={t("Aplicar")} variante="exito" estilo={{ flex: 1 }} onPress={() => {
                            setRecomendacion(null);
                            hacer(supabase.rpc("aplicar_orden_ruta", { p_ruta: r.id, p_alumnos: rec.orden }), t("Listo: {ruta} quedó con el orden recomendado.", { ruta: r.nombre }));
                          }} />
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

                {agregando === r.id ? (
                  <View style={{ gap: 6 }}>
                    {fuera.length === 0 ? <Text style={estilos.textoSuave}>{t("Todos los alumnos ya están en esta ruta.")}</Text> : fuera.map((a) => (
                      <Pressable key={a.id} accessibilityRole="button" onPress={() => { setAgregando(null); hacer(supabase.rpc("asignar_a_ruta", { p_alumno: a.id, p_ruta: r.id })); }}
                        style={{ padding: 12, borderRadius: 16, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde }}>
                        <Text style={estilos.texto}>+ {a.nombre}</Text>
                      </Pressable>
                    ))}
                    <Boton titulo={t("Cancelar")} variante="texto" onPress={() => setAgregando(null)} />
                  </View>
                ) : <Boton titulo={t("+ Agregar alumno a esta ruta")} variante="texto" onPress={() => setAgregando(r.id)} />}

                <Boton titulo={t("Eliminar ruta")} icono="basura" variante="contornoPeligro" onPress={() => eliminarRuta(r)} />
              </View>
            ) : null}
          </View>
        );
      })}

      {!creando ? (
        <Boton titulo={t("Nueva ruta")} icono="ruta" onPress={() => { setError(null); setExito(null); setCreando(true); }} />
      ) : null}
    </PantallaTia>
  );
}
