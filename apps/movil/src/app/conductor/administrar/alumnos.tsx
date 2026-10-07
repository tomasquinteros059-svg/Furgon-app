import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Text } from "../../../componentes/icono";
import { Aviso, Boton, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { compartirCodigo } from "../../../lib/familia";
import { mensajeError, supabase } from "../../../lib/supabase";

interface Alumno { id: string; nombre: string; curso: string | null; activo: boolean; domicilios: { direccion: string }[]; apoderado_alumno: { apoderado_id: string }[]; ruta_paradas: { ruta_id: string }[] }

export default function AlumnosAdmin() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    supabase.from("alumnos").select("id, nombre, curso, activo, domicilios(direccion), apoderado_alumno(apoderado_id), ruta_paradas(ruta_id)")
      .eq("activo", true).order("nombre").then(({ data }) => setAlumnos((data as unknown as Alumno[]) ?? []));
  }, []));
  return (
    <Pantalla titulo="Alumnos" accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Boton titulo="+ Agregar alumno" onPress={() => router.push("/conductor/administrar/nuevo-alumno")} />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {alumnos.map((a) => (
        <Tarjeta key={a.id}>
          <Text style={[estilos.texto, { fontWeight: "700", fontSize: 17 }]}>{a.nombre}</Text>
          <Text style={estilos.textoSuave}>{a.curso ?? ""}{a.domicilios[0] ? ` · ${a.domicilios[0].direccion}` : ""}</Text>
          <Text style={estilos.textoSuave}>
            {a.ruta_paradas.length ? `En ${a.ruta_paradas.length} ruta(s)` : "⚠️ Sin ruta"} · {a.apoderado_alumno.length ? "✓ Familia usa la app" : "Familia sin la app"}
          </Text>
          {!a.apoderado_alumno.length ? (
            <View style={{ marginTop: 6 }}>
              <Boton titulo="Enviar código a la familia" variante="secundario" onPress={() => compartirCodigo(a.id, a.nombre).catch((e) => setError(mensajeError(e)))} />
            </View>
          ) : null}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
