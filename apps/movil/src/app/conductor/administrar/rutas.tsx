import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { mensajeError, supabase } from "../../../lib/supabase";

interface Ruta { id: string; nombre: string; tipo: string; ruta_paradas: { alumno_id: string; orden: number; alumnos: { nombre: string } }[] }

export default function RutasAdmin() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);
  const [agregando, setAgregando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const [r, a] = await Promise.all([
      supabase.from("rutas").select("id, nombre, tipo, ruta_paradas(alumno_id, orden, alumnos(nombre))").eq("activa", true).order("nombre"),
      supabase.from("alumnos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    setRutas((r.data as unknown as Ruta[]) ?? []); setAlumnos(a.data ?? []);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  const hacer = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    setError(null);
    const { error } = await p;
    if (error) setError(mensajeError(error));
    cargar();
  };

  return (
    <Pantalla titulo="Rutas" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Text style={estilos.textoSuave}>El orden es el que sigues y el que usa el sistema para avisar a cada familia a tiempo.</Text>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {rutas.map((r) => {
        const paradas = [...r.ruta_paradas].sort((a, b) => a.orden - b.orden);
        const fuera = alumnos.filter((a) => !paradas.some((p) => p.alumno_id === a.id));
        return (
          <Tarjeta key={r.id}>
            <Text style={estilos.subtitulo}>{r.tipo === "ida" ? "🌅" : "🏠"} {r.nombre}</Text>
            {paradas.map((p, i) => (
              <View key={p.alumno_id} style={[estilos.fila, { justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderColor: colores.borde }]}>
                <Text style={[estilos.texto, { flex: 1 }]}>{i + 1}. {p.alumnos?.nombre}</Text>
                <View style={estilos.fila}>
                  <Boton titulo="↑" variante="secundario" deshabilitado={i === 0} estilo={{ minHeight: 40, paddingHorizontal: 12 }}
                    onPress={() => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: -1 }))} />
                  <Boton titulo="↓" variante="secundario" deshabilitado={i === paradas.length - 1} estilo={{ minHeight: 40, paddingHorizontal: 12 }}
                    onPress={() => hacer(supabase.rpc("mover_parada", { p_ruta: r.id, p_alumno: p.alumno_id, p_delta: 1 }))} />
                  <Boton titulo="✕" variante="secundario" estilo={{ minHeight: 40, paddingHorizontal: 12 }}
                    onPress={() => hacer(supabase.from("ruta_paradas").delete().eq("ruta_id", r.id).eq("alumno_id", p.alumno_id))} />
                </View>
              </View>
            ))}
            {agregando === r.id ? (
              <View style={{ gap: 6, marginTop: 8 }}>
                {fuera.length === 0 ? <Text style={estilos.textoSuave}>Todos los alumnos ya están en esta ruta.</Text> : fuera.map((a) => (
                  <Pressable key={a.id} accessibilityRole="button" onPress={() => { setAgregando(null); hacer(supabase.rpc("asignar_a_ruta", { p_alumno: a.id, p_ruta: r.id })); }}
                    style={{ padding: 10, borderRadius: 10, backgroundColor: colores.fondo }}>
                    <Text style={estilos.texto}>+ {a.nombre}</Text>
                  </Pressable>
                ))}
                <Boton titulo="Cancelar" variante="texto" onPress={() => setAgregando(null)} />
              </View>
            ) : <Boton titulo="+ Agregar alumno a esta ruta" variante="texto" onPress={() => setAgregando(r.id)} />}
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
