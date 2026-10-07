import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { mensajeError, supabase } from "../../../lib/supabase";

interface Cobro { id: string; monto: number; vence_en: string; estado: string; medio: string | null; alumnos: { nombre: string } }
const pesos = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

export default function CobrosAdmin() {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const cargar = useCallback(async () => {
    const { data } = await supabase.from("cobros").select("id, monto, vence_en, estado, medio, alumnos(nombre)").eq("periodo", periodoActual());
    setCobros(((data as unknown as Cobro[]) ?? []).sort((a, b) => a.alumnos.nombre.localeCompare(b.alumnos.nombre)));
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  const hoy = new Date().toISOString().slice(0, 10);
  const pendiente = cobros.filter((c) => c.estado === "pendiente").reduce((s, c) => s + c.monto, 0);
  const cobrado = cobros.filter((c) => c.estado === "pagado").reduce((s, c) => s + c.monto, 0);
  const mes = new Intl.DateTimeFormat("es-CL", { month: "long" }).format(new Date());

  async function pagar(c: Cobro, medio: "efectivo" | "transferencia") {
    const { error } = await supabase.rpc("registrar_pago", { p_cobro: c.id, p_medio: medio, p_nota: null });
    setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: `Pago de ${c.alumnos.nombre} registrado.` });
    cargar();
  }

  return (
    <Pantalla titulo={`Cobros de ${mes}`} accion={<Boton titulo="Volver" variante="texto" onPress={() => router.back()} />}>
      <Tarjeta>
        <Text style={estilos.texto}>Cobrado: <Text style={{ fontWeight: "700", color: colores.verde }}>{pesos(cobrado)}</Text></Text>
        <Text style={estilos.texto}>Por cobrar: <Text style={{ fontWeight: "700" }}>{pesos(pendiente)}</Text></Text>
      </Tarjeta>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}
      {cobros.length === 0 ? (
        <>
          <Text style={estilos.textoSuave}>Aún no se generan las mensualidades de este mes.</Text>
          <Boton titulo="Generar mensualidades del mes" onPress={async () => {
            const { error } = await supabase.rpc("generar_cobros", { p_periodo: periodoActual() });
            setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: "Mensualidades generadas." });
            cargar();
          }} />
        </>
      ) : null}
      {cobros.map((c) => {
        const vencido = c.estado === "pendiente" && c.vence_en < hoy;
        return (
          <Tarjeta key={c.id}>
            <View style={[estilos.fila, { justifyContent: "space-between" }]}>
              <Text style={[estilos.texto, { fontWeight: "700", flex: 1 }]}>{c.alumnos.nombre}</Text>
              <Text style={[estilos.texto, { fontWeight: "700" }]}>{pesos(c.monto)}</Text>
            </View>
            <Text style={{ color: c.estado === "pagado" ? colores.verde : vencido ? colores.rojo : colores.suave, fontWeight: "600" }}>
              {c.estado === "pagado" ? `Pagado · ${c.medio}` : c.estado === "anulado" ? "Anulado" : vencido ? "Vencido" : "Pendiente"}
            </Text>
            {c.estado === "pendiente" ? (
              <View style={[estilos.fila, { marginTop: 6 }]}>
                <Boton titulo="Pagó en efectivo" variante="exito" estilo={{ flex: 1 }} onPress={() => pagar(c, "efectivo")} />
                <Boton titulo="Transferencia" variante="secundario" estilo={{ flex: 1 }} onPress={() => pagar(c, "transferencia")} />
              </View>
            ) : null}
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
