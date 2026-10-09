import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { TextInput, View } from "react-native";
import { Text } from "../../../componentes/icono";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { mensajeError, supabase } from "../../../lib/supabase";
import { locale, t } from "../../../lib/idioma";

interface Cobro { id: string; alumno_id: string; monto: number; vence_en: string; estado: string; medio: string | null; nota: string | null; alumnos: { nombre: string } }
interface AlumnoPrecio { id: string; nombre: string; mensualidad: number | null }
const pesos = (n: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const soloDigitos = (texto: string) => texto.replace(/\D/g, "");
const medioDePago = (medio: string | null) => medio === "efectivo" ? t("efectivo") : medio === "transferencia" ? t("transferencia") : (medio ?? "");
const estiloEntrada = { borderWidth: 1, borderColor: colores.borde, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 17, color: colores.texto, backgroundColor: "#fff" };

export default function CobrosAdmin() {
  const [vista, setVista] = useState<"cobros" | "precios">("cobros");
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoPrecio[]>([]);
  const [precioGeneral, setPrecioGeneral] = useState(0);
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const cargar = useCallback(async () => {
    const [c, a, e] = await Promise.all([
      supabase.from("cobros").select("id, alumno_id, monto, vence_en, estado, medio, nota, alumnos(nombre)").eq("periodo", periodoActual()),
      supabase.from("alumnos").select("id, nombre, mensualidad").eq("activo", true).order("nombre"),
      supabase.from("empresas").select("mensualidad_defecto").maybeSingle(),
    ]);
    setCobros(((c.data as unknown as Cobro[]) ?? []).sort((x, y) => x.alumnos.nombre.localeCompare(y.alumnos.nombre)));
    setAlumnos((a.data as AlumnoPrecio[]) ?? []);
    setPrecioGeneral(e.data?.mensualidad_defecto ?? 0);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  // Fecha de hoy en la hora del teléfono (Chile), no en UTC.
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  const pendiente = cobros.filter((c) => c.estado === "pendiente").reduce((s, c) => s + c.monto, 0);
  const cobrado = cobros.filter((c) => c.estado === "pagado").reduce((s, c) => s + c.monto, 0);
  const mes = new Intl.DateTimeFormat(locale(), { month: "long" }).format(new Date());
  const precio = (a: AlumnoPrecio) => a.mensualidad ?? precioGeneral;

  async function ejecutar(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p;
    setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: ok });
    if (!error) setEditando(null);
    cargar();
  }

  return (
    <Pantalla titulo={t("Cobros de {mes}", { mes })} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      <View style={estilos.fila}>
        <Boton titulo={t("Cobros del mes")} variante={vista === "cobros" ? "primario" : "secundario"} estilo={{ flex: 1 }} onPress={() => { setVista("cobros"); setEditando(null); }} />
        <Boton titulo={t("Precios")} variante={vista === "precios" ? "primario" : "secundario"} estilo={{ flex: 1 }} onPress={() => { setVista("precios"); setEditando(null); }} />
      </View>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}

      {vista === "precios" ? (
        <>
          <Tarjeta>
            <Text style={estilos.texto}>{t("Ingreso mensual esperado:")} <Text style={{ fontWeight: "700" }}>{pesos(alumnos.reduce((s, a) => s + precio(a), 0))}</Text></Text>
            <Text style={estilos.textoSuave}>{t("Toca «Cambiar» para poner el precio de cada alumno. También se actualiza su cobro pendiente de {mes}.", { mes })}</Text>
          </Tarjeta>
          {alumnos.map((a) => (
            <Tarjeta key={a.id}>
              <View style={[estilos.fila, { justifyContent: "space-between" }]}>
                <Text style={[estilos.texto, { fontWeight: "700", flex: 1 }]}>{a.nombre}</Text>
                <Text style={[estilos.texto, { fontWeight: "700" }]}>{pesos(precio(a))}</Text>
              </View>
              {a.mensualidad == null ? <Text style={estilos.textoSuave}>{t("Precio general")}</Text> : null}
              {editando?.id === a.id ? (
                <View style={{ gap: 6 }}>
                  <TextInput accessibilityLabel={t("Precio mensual de {nombre}", { nombre: a.nombre })} keyboardType="number-pad" autoFocus style={estiloEntrada}
                    value={editando.valor} onChangeText={(v) => setEditando({ id: a.id, valor: soloDigitos(v) })} />
                  <View style={estilos.fila}>
                    <Boton titulo={t("Guardar")} variante="exito" estilo={{ flex: 1 }} deshabilitado={!editando.valor}
                      onPress={() => ejecutar(supabase.rpc("fijar_mensualidad", { p_alumno: a.id, p_monto: Number(editando.valor), p_desde: periodoActual() }),
                        t("Precio de {nombre}: {monto} al mes.", { nombre: a.nombre, monto: pesos(Number(editando.valor)) }))} />
                    <Boton titulo={t("Cancelar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setEditando(null)} />
                  </View>
                </View>
              ) : <Boton titulo={t("Cambiar precio")} variante="secundario" onPress={() => setEditando({ id: a.id, valor: String(precio(a)) })} />}
            </Tarjeta>
          ))}
        </>
      ) : (
        <>
          <Tarjeta>
            <Text style={estilos.texto}>{t("Cobrado:")} <Text style={{ fontWeight: "700", color: colores.verde }}>{pesos(cobrado)}</Text></Text>
            <Text style={estilos.texto}>{t("Por cobrar:")} <Text style={{ fontWeight: "700" }}>{pesos(pendiente)}</Text></Text>
          </Tarjeta>
          {cobros.length === 0 ? (
            <>
              <Text style={estilos.textoSuave}>{t("Aún no se generan las mensualidades de este mes. Revisa antes los precios en «Precios».")}</Text>
              <Boton titulo={t("Generar mensualidades del mes")} onPress={() => ejecutar(supabase.rpc("generar_cobros", { p_periodo: periodoActual() }), t("Mensualidades generadas."))} />
            </>
          ) : alumnos.some((a) => !cobros.some((c) => c.alumno_id === a.id)) ? (
            // Alumnos que llegaron después de generar el mes: generar_cobros no duplica los que ya existen.
            <Boton titulo={t("Generar mensualidades de alumnos nuevos")} variante="secundario"
              onPress={() => ejecutar(supabase.rpc("generar_cobros", { p_periodo: periodoActual() }), t("Mensualidades generadas."))} />
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
                  {c.estado === "pagado" ? t("Pagado · {medio}", { medio: medioDePago(c.medio) }) : c.estado === "anulado" ? t("Anulado") : vencido ? t("Vencido") : t("Pendiente")}{c.nota ? ` · ${c.nota}` : ""}
                </Text>
                {c.estado === "pendiente" && editando?.id === c.id ? (
                  <View style={{ gap: 6 }}>
                    <TextInput accessibilityLabel={t("Monto de {nombre}", { nombre: c.alumnos.nombre })} keyboardType="number-pad" autoFocus style={estiloEntrada}
                      value={editando.valor} onChangeText={(v) => setEditando({ id: c.id, valor: soloDigitos(v) })} />
                    <View style={estilos.fila}>
                      <Boton titulo={t("Guardar monto")} variante="exito" estilo={{ flex: 1 }} deshabilitado={!editando.valor}
                        onPress={() => ejecutar(supabase.rpc("cambiar_monto_cobro", { p_cobro: c.id, p_monto: Number(editando.valor), p_nota: null }),
                          t("Cobro de {nombre}: ahora {monto}.", { nombre: c.alumnos.nombre, monto: pesos(Number(editando.valor)) }))} />
                      <Boton titulo={t("Cancelar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setEditando(null)} />
                    </View>
                  </View>
                ) : c.estado === "pendiente" ? (
                  <>
                    <View style={[estilos.fila, { marginTop: 6 }]}>
                      <Boton titulo={t("Pagó en efectivo")} variante="exito" estilo={{ flex: 1 }}
                        onPress={() => ejecutar(supabase.rpc("registrar_pago", { p_cobro: c.id, p_medio: "efectivo", p_nota: null }), t("Pago de {nombre} registrado.", { nombre: c.alumnos.nombre }))} />
                      <Boton titulo={t("Transferencia")} variante="secundario" estilo={{ flex: 1 }}
                        onPress={() => ejecutar(supabase.rpc("registrar_pago", { p_cobro: c.id, p_medio: "transferencia", p_nota: null }), t("Pago de {nombre} registrado.", { nombre: c.alumnos.nombre }))} />
                    </View>
                    <Boton titulo={t("Cambiar monto de este mes")} variante="texto" onPress={() => setEditando({ id: c.id, valor: String(c.monto) })} />
                  </>
                ) : null}
              </Tarjeta>
            );
          })}
        </>
      )}
    </Pantalla>
  );
}
