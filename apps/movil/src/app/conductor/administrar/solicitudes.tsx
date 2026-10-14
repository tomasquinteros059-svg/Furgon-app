// Mensajes de la tía (diseño oct. 2026): cada consulta con la inicial, el nombre, la hora, el último
// mensaje y un punto amarillo si falta responder.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar } from "../../../componentes/avatar";
import { Text } from "../../../componentes/icono";
import { PantallaTia } from "../../../componentes/pantalla-tia";
import { colores, estilos } from "../../../componentes/ui";
import { supabase } from "../../../lib/supabase";
import { locale, t } from "../../../lib/idioma";

interface Solicitud {
  id: string; asunto: string; estado: string; actualizado_en: string;
  autor: { nombre: string } | null;
  solicitud_mensajes: { cuerpo: string; creado_en: string }[] | null;
}

/** Hora si fue hoy, «Ayer», o la fecha corta (hora de Chile). */
function cuando(iso: string): string {
  const zona = "America/Santiago";
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
  const fecha = new Date(iso);
  const hoy = new Date();
  if (dia(fecha) === dia(hoy)) return new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", timeZone: zona }).format(fecha);
  if (dia(fecha) === dia(new Date(hoy.getTime() - 86_400_000))) return t("Ayer");
  return new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "2-digit", timeZone: zona }).format(fecha);
}

export default function MensajesTia() {
  const [lista, setLista] = useState<Solicitud[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from("solicitudes").select("id, asunto, estado, actualizado_en, autor:perfiles(nombre), solicitud_mensajes(cuerpo, creado_en)")
      .neq("estado", "cerrada").order("actualizado_en", { ascending: false })
      .then(({ data }) => setLista((data as unknown as Solicitud[]) ?? []));
  }, []));

  return (
    <PantallaTia descripcion={t("Consultas de las familias. Toca para responder.")}>
      {lista.length === 0 ? <Text style={estilos.textoSuave}>{t("No hay consultas por responder.")}</Text> : null}
      {lista.map((s) => {
        const ultimo = [...(s.solicitud_mensajes ?? [])].sort((a, b) => a.creado_en.localeCompare(b.creado_en)).pop();
        const sinResponder = s.estado === "abierta";
        const nombre = s.autor?.nombre ?? t("Familia");
        return (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={nombre}
            onPress={() => router.push(`/conductor/administrar/solicitud/${s.id}`)}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde,
              borderRadius: 26, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, opacity: pressed ? 0.8 : 1,
            })}>
            <Avatar nombre={nombre} tam={52} letras={1} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={[estilos.fila, { justifyContent: "space-between" }]}>
                <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "600", color: colores.texto, flex: 1 }}>{nombre}</Text>
                <Text style={{ fontSize: 15, color: colores.suave }}>{cuando(ultimo?.creado_en ?? s.actualizado_en)}</Text>
                {sinResponder ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colores.amarillo, marginLeft: 6 }} /> : null}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 16, color: colores.suave }}>{ultimo?.cuerpo ?? s.asunto}</Text>
            </View>
          </Pressable>
        );
      })}
    </PantallaTia>
  );
}
