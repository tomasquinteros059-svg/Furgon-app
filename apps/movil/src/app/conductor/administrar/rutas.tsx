import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { llamarFuncion, mensajeError, supabase } from "../../../lib/supabase";
import { locale, t } from "../../../lib/idioma";

interface Ruta {
  id: string;
  nombre: string;
  tipo: "ida" | "vuelta";
  ruta_paradas: { alumno_id: string; orden: number; alumnos: { nombre: string } }[];
}
interface Recomendacion { orden: string[]; metros: number; metrosActual: number; ahorroM: number; cambia: boolean; fuente: "google" | "estimada" }

const km = (m: number) => `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;
const botonChico = { minHeight: 40, paddingHorizontal: 12 };

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

  const cargar = useCallback(async () => {
    const { data: fecha } = await supabase.rpc("hoy_empresa");
    const [r, a, i] = await Promise.all([
      supabase.from("rutas").select("id, nombre, tipo, ruta_paradas(alumno_id, orden, alumnos(nombre))").eq("activa", true).order("nombre"),
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
    let res = await marcar(tipo, valor);
    // Si la familia había marcado todo el día, se deja marcado solo el otro tramo.
    if (!res.error && !valor && noVan.some((x) => x.alumno_id === alumnoId && x.tipo === "ambos")) {
      res = await marcar("ambos", false);
      if (!res.error) res = await marcar(tipo === "ida" ? "vuelta" : "ida", true);
    }
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

  return (
    <Pantalla titulo={t("Rutas")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      <Text style={estilos.textoSuave}>{t("El orden es el que sigues y el que usa el sistema para avisar a cada familia a tiempo. «Recomendar ruta» calcula el orden más corto con las direcciones de tus alumnos.")}</Text>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {exito ? <Aviso tipo="exito" texto={exito} /> : null}
      {rutas.map((r) => {
        const paradas = [...r.ruta_paradas].sort((a, b) => a.orden - b.orden);
        const fuera = alumnos.filter((a) => !paradas.some((p) => p.alumno_id === a.id));
        const rec = recomendacion?.rutaId === r.id ? recomendacion.r : null;
        const nombre = (id: string) => paradas.find((p) => p.alumno_id === id)?.alumnos?.nombre ?? "—";
        return (
          <Tarjeta key={r.id}>
            <Text style={estilos.subtitulo}>{r.tipo === "ida" ? "🌅" : "🏠"} {r.nombre}</Text>
            {paradas.length >= 2 && !rec ? (
              <Boton titulo={calculando === r.id ? t("Calculando…") : t("✨ Recomendar ruta")} variante="secundario" cargando={calculando === r.id} onPress={() => recomendar(r)} />
            ) : null}
            {rec ? (
              <View style={{ gap: 6, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: colores.amarillo }}>
                {rec.cambia ? (
                  <>
                    <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("✨ Ruta recomendada: {km} (antes {antes})", { km: km(rec.metros), antes: km(rec.metrosActual) })}</Text>
                    <Text style={estilos.textoSuave}>{t("Ahorras {km} por recorrido.", { km: km(rec.ahorroM) })} {rec.fuente === "google" ? t("Calculada por calles con Google Maps.") : t("Calculada por distancia (aproximada).")}</Text>
                    {rec.orden.map((id, i) => {
                      const antes = paradas.findIndex((p) => p.alumno_id === id);
                      return <Text key={id} style={estilos.texto}>{i + 1}. {nombre(id)} <Text style={estilos.textoSuave}>{antes === i ? "" : t("(antes {n}°)", { n: antes + 1 })}</Text></Text>;
                    })}
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
            {paradas.map((p, i) => {
              const noVa = noVaHoy(p.alumno_id, r.tipo);
              return (
                <View key={p.alumno_id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: colores.borde, gap: 6 }}>
                  <View style={[estilos.fila, { justifyContent: "space-between" }]}>
                    <Text style={[estilos.texto, { flex: 1 }, noVa && { color: colores.suave, textDecorationLine: "line-through" }]}>{i + 1}. {p.alumnos?.nombre}</Text>
                    <View style={estilos.fila}>
                      <Boton titulo="↑" variante="secundario" deshabilitado={i === 0} estilo={botonChico}
                        onPress={() => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: -1 }))} />
                      <Boton titulo="↓" variante="secundario" deshabilitado={i === paradas.length - 1} estilo={botonChico}
                        onPress={() => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: 1 }))} />
                      <Boton titulo="✕" variante="secundario" estilo={botonChico}
                        onPress={() => hacer(supabase.from("ruta_paradas").delete().eq("ruta_id", r.id).eq("alumno_id", p.alumno_id))} />
                    </View>
                  </View>
                  <Boton titulo={noVa ? t("📅 Hoy no va · tocar si sí va") : t("Hoy no va")} variante={noVa ? "peligro" : "secundario"} estilo={botonChico}
                    onPress={() => cambiarHoyNoVa(p.alumno_id, p.alumnos?.nombre ?? "", r.tipo, !noVa)} />
                </View>
              );
            })}
            {agregando === r.id ? (
              <View style={{ gap: 6, marginTop: 8 }}>
                {fuera.length === 0 ? <Text style={estilos.textoSuave}>{t("Todos los alumnos ya están en esta ruta.")}</Text> : fuera.map((a) => (
                  <Pressable key={a.id} accessibilityRole="button" onPress={() => { setAgregando(null); hacer(supabase.rpc("asignar_a_ruta", { p_alumno: a.id, p_ruta: r.id })); }}
                    style={{ padding: 10, borderRadius: 10, backgroundColor: colores.fondo }}>
                    <Text style={estilos.texto}>+ {a.nombre}</Text>
                  </Pressable>
                ))}
                <Boton titulo={t("Cancelar")} variante="texto" onPress={() => setAgregando(null)} />
              </View>
            ) : <Boton titulo={t("+ Agregar alumno a esta ruta")} variante="texto" onPress={() => setAgregando(r.id)} />}
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
