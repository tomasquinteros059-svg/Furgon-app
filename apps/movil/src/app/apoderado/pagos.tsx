// Mensualidades de los hijos (las registra la administración).
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { supabase } from "../../lib/supabase";
import { locale, t } from "../../lib/idioma";

interface Cobro { id: string; periodo: string; monto: number; vence_en: string; estado: string; pagado_en: string | null; alumnos: { nombre: string } }

const pesos = (n: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const mes = (p: string) => { const m = new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(new Date(`${p}T12:00:00`)); return m[0].toUpperCase() + m.slice(1); };
const dia = (d: string) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(new Date(`${d.slice(0, 10)}T12:00:00`));

export default function Pagos() {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [telefono, setTelefono] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([
      supabase.from("cobros").select("id, periodo, monto, vence_en, estado, pagado_en, alumnos(nombre)").neq("estado", "anulado").order("periodo", { ascending: false }).limit(24),
      supabase.from("empresas").select("telefono_contacto").maybeSingle(),
    ]);
    setCobros((c.data as unknown as Cobro[]) ?? []); setTelefono(e.data?.telefono_contacto ?? null);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  const hoy = new Date().toISOString().slice(0, 10);
  const pendiente = cobros.filter((c) => c.estado === "pendiente").reduce((s, c) => s + c.monto, 0);

  return (
    <Pantalla titulo={t("Pagos")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {pendiente ? <Aviso texto={telefono
        ? t("Tienes {monto} pendiente. Para pagar o consultar, contacta a la administración ({telefono}).", { monto: pesos(pendiente), telefono })
        : t("Tienes {monto} pendiente.", { monto: pesos(pendiente) })} /> : <Aviso tipo="exito" texto={t("Estás al día. ¡Gracias!")} />}
      {cobros.length === 0 ? <Text style={estilos.textoSuave}>{t("Aún no hay mensualidades registradas.")}</Text> : null}
      {cobros.map((c) => {
        const vencido = c.estado === "pendiente" && c.vence_en < hoy;
        return (
          <Tarjeta key={c.id}>
            <View style={[estilos.fila, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[estilos.texto, { fontWeight: "700" }]}>{mes(c.periodo)} · {c.alumnos?.nombre}</Text>
                <Text style={estilos.textoSuave}>{c.estado === "pagado" ? t("Pagado el {fecha}", { fecha: dia(c.pagado_en!) }) : t("Vence el {fecha}", { fecha: dia(c.vence_en) })}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[estilos.texto, { fontWeight: "700" }]}>{pesos(c.monto)}</Text>
                <Text style={{ fontWeight: "700", color: c.estado === "pagado" ? colores.verde : vencido ? colores.rojo : colores.suave }}>
                  {c.estado === "pagado" ? t("Pagado") : vencido ? t("Vencido") : t("Pendiente")}
                </Text>
              </View>
            </View>
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
