// Alumnos de la tía (diseño oct. 2026): total arriba y cada niño con su inicial y dirección. Al
// tocarlo se abre su detalle (curso, rutas, familia y el código para la familia sin app).
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar } from "../../../componentes/avatar";
import { Icono, Text } from "../../../componentes/icono";
import { PantallaTia } from "../../../componentes/pantalla-tia";
import { Aviso, Boton, colores, estilos } from "../../../componentes/ui";
import { compartirCodigo } from "../../../lib/familia";
import { mensajeError, supabase } from "../../../lib/supabase";
import { t } from "../../../lib/idioma";

interface Alumno { id: string; nombre: string; curso: string | null; activo: boolean; domicilios: { direccion: string }[]; apoderado_alumno: { apoderado_id: string }[]; ruta_paradas: { ruta_id: string }[] }

// Función (no constante): los colores dependen del tema actual.
const caja = () => ({ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 26, marginBottom: 12 }) as const;

export default function AlumnosTia() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    supabase.from("alumnos").select("id, nombre, curso, activo, domicilios(direccion), apoderado_alumno(apoderado_id), ruta_paradas(ruta_id)")
      .eq("activo", true).order("nombre").then(({ data }) => setAlumnos((data as unknown as Alumno[]) ?? []));
  }, []));

  return (
    <PantallaTia descripcion={t("Todos tus alumnos. Toca uno para ver su familia y dirección.")}>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <View style={[caja(), estilos.fila, { gap: 12, paddingVertical: 18, paddingHorizontal: 20 }]}>
        <Icono nombre="personas" tam={26} color={colores.texto} acento="transparent" />
        <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>
          {alumnos.length === 1 ? t("1 alumno en total") : t("{n} alumnos en total", { n: alumnos.length })}
        </Text>
      </View>

      {alumnos.map((a) => {
        const visto = abierto === a.id;
        return (
          <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.nombre} onPress={() => setAbierto(visto ? null : a.id)}
            style={({ pressed }) => [caja(), { paddingVertical: 16, paddingHorizontal: 16, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[estilos.fila, { gap: 14 }]}>
              <Avatar nombre={a.nombre} tam={56} letras={1} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{a.nombre}</Text>
                {a.domicilios[0] ? (
                  <View style={[estilos.fila, { gap: 6, alignItems: "flex-start" }]}>
                    <Icono nombre="pin" tam={18} color={colores.suave} acento="transparent" />
                    <Text style={{ fontSize: 15, color: colores.suave, flex: 1 }}>{a.domicilios[0].direccion}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {visto ? (
              <View style={{ marginTop: 12, gap: 4 }}>
                {a.curso ? <Text style={estilos.textoSuave}>{a.curso}</Text> : null}
                <Text style={estilos.textoSuave}>
                  {a.ruta_paradas.length === 1 ? t("En 1 ruta") : a.ruta_paradas.length ? t("En {n} rutas", { n: a.ruta_paradas.length }) : t("⚠️ Sin ruta")} · {a.apoderado_alumno.length ? t("✓ Familia usa la app") : t("Familia sin la app")}
                </Text>
                {!a.apoderado_alumno.length ? (
                  <Boton titulo={t("Enviar código a la familia")} variante="secundario" onPress={() => compartirCodigo(a.id, a.nombre).catch((e) => setError(mensajeError(e)))} />
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Boton titulo={t("+ Agregar alumno")} variante="secundario" onPress={() => router.push("/conductor/administrar/nuevo-alumno")} />
    </PantallaTia>
  );
}
