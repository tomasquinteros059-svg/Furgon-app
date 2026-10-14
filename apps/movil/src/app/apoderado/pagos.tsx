// Mensualidades de los hijos (las registra la administración). Diseño oct. 2026: arriba el próximo
// pago y, debajo, el historial con cada mes.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Icono, Text } from "../../componentes/icono";
import { PantallaFamilia } from "../../componentes/pantalla-familia";
import { colores, estilos } from "../../componentes/ui";
import { supabase } from "../../lib/supabase";
import { locale, t } from "../../lib/idioma";

interface Cobro { id: string; periodo: string; monto: number; vence_en: string; estado: string; pagado_en: string | null; alumnos: { nombre: string } | null }

const pesos = (n: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const mes = (p: string) => { const m = new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(new Date(`${p}T12:00:00`)); return m[0].toUpperCase() + m.slice(1); };
const dia = (d: string) => new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${d.slice(0, 10)}T12:00:00`)).replace(/\./g, "").replace(/ de /g, " ");
const hoyChile = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

export default function Pagos() {
  const [cobros, setCobros] = useState<Cobro[] | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([
      supabase.from("cobros").select("id, periodo, monto, vence_en, estado, pagado_en, alumnos(nombre)").neq("estado", "anulado").order("periodo", { ascending: false }).limit(24),
      supabase.from("empresas").select("telefono_contacto").maybeSingle(),
    ]);
    setCobros((c.data as unknown as Cobro[]) ?? []); setTelefono(e.data?.telefono_contacto ?? null);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const lista = cobros ?? [];
  const hoy = hoyChile();
  const variosHijos = new Set(lista.map((c) => c.alumnos?.nombre)).size > 1;
  const pendientes = lista.filter((c) => c.estado === "pendiente").sort((a, b) => a.periodo.localeCompare(b.periodo));
  const destacado = pendientes[0] ?? lista[0];
  const vencido = (c: Cobro) => c.estado === "pendiente" && c.vence_en < hoy; // i18n-ignorar: comparación
  const estado = (c: Cobro) => c.estado === "pagado" ? t("Pagado") : vencido(c) ? t("Vencido") : t("Pendiente");
  const colorEstado = (c: Cobro) => c.estado === "pagado" ? colores.texto : vencido(c) ? colores.rojo : colores.suave;
  const tarjeta = () => ({ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 28 }) as const;

  return (
    <PantallaFamilia>
      {cobros && lista.length === 0 ? <Text style={estilos.textoSuave}>{t("Aún no hay mensualidades registradas.")}</Text> : null}

      {destacado ? (
        <View style={[tarjeta(), { padding: 20, marginBottom: 24, gap: 6 }]}>
          <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: 1, color: colores.suave }}>
            {(pendientes.length ? t("Próximo pago") : t("Estás al día")).toUpperCase()}
          </Text>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colores.texto, flex: 1 }}>{mes(destacado.periodo)}</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colores.texto }}>{pesos(destacado.monto)}</Text>
          </View>
          <View style={[estilos.fila, { gap: 10 }]}>
            <Icono nombre={destacado.estado === "pagado" ? "check" : "calendario"} tam={20} color={vencido(destacado) ? colores.rojo : colores.suave} acento="transparent" />
            <Text style={{ fontSize: 16, color: vencido(destacado) ? colores.rojo : colores.suave, flex: 1 }}>
              {destacado.estado === "pagado" ? t("Pagado el {fecha}", { fecha: dia(destacado.pagado_en!) }) : t("Vence el {fecha}", { fecha: dia(destacado.vence_en) })}
            </Text>
          </View>
          {pendientes.length && telefono ? (
            <Text style={{ fontSize: 14, color: colores.suave, marginTop: 4 }}>{t("Para pagar o consultar, contacta a la administración ({telefono}).", { telefono })}</Text>
          ) : null}
        </View>
      ) : null}

      {lista.length ? <Text style={{ fontSize: 18, color: colores.suave, marginBottom: 12 }}>{t("Historial")}</Text> : null}
      {lista.map((c) => (
        <View key={c.id} style={[tarjeta(), estilos.fila, { gap: 14, paddingVertical: 16, paddingHorizontal: 14, marginBottom: 12 }]}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colores.amarillo, borderWidth: 3, borderColor: colores.borde, alignItems: "center", justifyContent: "center" }}>
            <Icono nombre="billetera" tam={26} color={colores.sobreAmarillo} acento="transparent" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{mes(c.periodo)}</Text>
            <Text numberOfLines={1} style={{ fontSize: 15, color: colores.suave }}>
              {c.estado === "pagado" && c.pagado_en ? dia(c.pagado_en) : t("Vence el {fecha}", { fecha: dia(c.vence_en) })}{variosHijos && c.alumnos ? ` · ${c.alumnos.nombre}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colores.texto }}>{pesos(c.monto)}</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colorEstado(c) }}>{estado(c)}</Text>
          </View>
        </View>
      ))}
    </PantallaFamilia>
  );
}
