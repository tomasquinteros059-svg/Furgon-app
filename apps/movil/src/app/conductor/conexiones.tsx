// La tía o el tío del furgón: aparecer (o no) en la búsqueda de las familias, buscar a una
// familia por su correo o teléfono para invitarla, y responder las solicitudes que llegan.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Switch, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { type Conexion, misConexiones } from "../../lib/conexiones";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

interface Familia { id: string; nombre: string; conexion: string | null }
interface MiRuta { id: string; nombre: string; tipo: "ida" | "vuelta" }

export default function Conexiones() {
  const { perfil } = useSesion();
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [visible, setVisible] = useState(false);
  const [comunas, setComunas] = useState("");
  const [presentacion, setPresentacion] = useState("");
  const [texto, setTexto] = useState("");
  const [familias, setFamilias] = useState<Familia[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  // Rutas a las que entrarán los hijos de la familia (se eligen al aceptar o al invitar).
  const [misRutas, setMisRutas] = useState<MiRuta[]>([]);
  const [eligiendo, setEligiendo] = useState<{ tipo: "aceptar" | "invitar"; id: string; nombre: string } | null>(null);
  const [rutasElegidas, setRutasElegidas] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    try { setConexiones(await misConexiones()); } catch (e) { setMsg({ ok: false, txt: mensajeError(e) }); }
    const { data } = await supabase.from("perfiles").select("visible_en_busqueda, comunas, presentacion").eq("id", perfil?.id ?? "").maybeSingle();
    if (data) { setVisible(data.visible_en_busqueda); setComunas(data.comunas ?? ""); setPresentacion(data.presentacion ?? ""); }
    const { data: r } = await supabase.from("rutas").select("id, nombre, tipo").eq("conductor_id", perfil?.id ?? "").eq("activa", true).order("hora_salida");
    setMisRutas((r as MiRuta[]) ?? []);
  }, [perfil?.id]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function ejecutar(p: PromiseLike<{ error: unknown }>, ok: string) {
    setMsg(null);
    const { error } = await p;
    setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: ok });
    if (!error && familias) buscar();
    cargar();
  }

  async function buscar() {
    setMsg(null);
    const { data, error } = await supabase.rpc("buscar_familia", { p_texto: texto });
    if (error) setMsg({ ok: false, txt: mensajeError(error) }); else setFamilias((data as Familia[]) ?? []);
  }

  function elegirRutas(tipo: "aceptar" | "invitar", id: string, nombre: string) {
    setEligiendo({ tipo, id, nombre });
    setRutasElegidas(new Set(misRutas.map((r) => r.id))); // por defecto, todas sus rutas
  }

  function confirmarRutas() {
    if (!eligiendo) return;
    const rutas = [...rutasElegidas];
    const nombres = misRutas.filter((r) => rutasElegidas.has(r.id)).map((r) => r.nombre).join(t(" y "));
    const e = eligiendo;
    const vars = { nombre: e.nombre, rutas: nombres };
    setEligiendo(null);
    if (e.tipo === "aceptar") {
      ejecutar(supabase.rpc("responder_conexion", { p_conexion: e.id, p_aceptar: true, p_rutas: rutas }), rutas.length
        ? t("{nombre} quedó conectada a tu furgón. Sus hijos entrarán solos a {rutas}, en el lugar que menos alarga el recorrido.", vars)
        : t("{nombre} quedó conectada a tu furgón. Sin rutas elegidas: agrégalos después en Rutas.", vars));
    } else {
      ejecutar(supabase.rpc("solicitar_conexion", { p_otro: e.id, p_mensaje: null, p_rutas: rutas }), rutas.length
        ? t("Invitación enviada a {nombre}. Cuando acepte: sus hijos entrarán solos a {rutas}, en el lugar que menos alarga el recorrido.", vars)
        : t("Invitación enviada a {nombre}. Cuando acepte: sin rutas elegidas: agrégalos después en Rutas.", vars));
    }
  }

  const selectorRutas = (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{t("¿En qué rutas va?")}</Text>
      {misRutas.length === 0 ? <Text style={estilos.textoSuave}>{t("Aún no tienes rutas asignadas.")}</Text> : (
        <View style={[estilos.fila, { flexWrap: "wrap" }]}>
          {misRutas.map((r) => {
            const si = rutasElegidas.has(r.id);
            return (
              <Boton key={r.id} titulo={`${si ? "✓ " : ""}${r.tipo === "ida" ? "🌅" : "🏠"} ${r.nombre}`} variante={si ? "exito" : "secundario"}
                estilo={{ minHeight: 40, paddingHorizontal: 12 }}
                onPress={() => { const n = new Set(rutasElegidas); if (si) n.delete(r.id); else n.add(r.id); setRutasElegidas(n); }} />
            );
          })}
        </View>
      )}
      <View style={estilos.fila}>
        <Boton titulo={eligiendo?.tipo === "aceptar" ? t("Aceptar") : t("Enviar invitación")} variante="exito" estilo={{ flex: 1 }} onPress={confirmarRutas} />
        <Boton titulo={t("Cancelar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setEligiendo(null)} />
      </View>
    </View>
  );

  const guardarPerfil = (cambios: { visible_en_busqueda?: boolean; comunas?: string; presentacion?: string }, ok: string) =>
    ejecutar(supabase.from("perfiles").update(cambios).eq("id", perfil?.id ?? ""), ok);

  const recibidas = conexiones.filter((c) => c.estado === "pendiente" && c.iniciada_por === "apoderado");
  const enviadas = conexiones.filter((c) => c.estado === "pendiente" && c.iniciada_por === "conductor");
  const conectadas = conexiones.filter((c) => c.estado === "aceptada");

  return (
    <Pantalla titulo={t("Conexiones con familias")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}

      {recibidas.map((c) => (
        <Tarjeta key={c.id} estilo={{ borderColor: colores.verde, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🤝 {nombre} quiere conectarse", { nombre: c.otro_nombre })}</Text>
          {c.mensaje ? <Text style={estilos.texto}>“{c.mensaje}”</Text> : null}
          {eligiendo?.tipo === "aceptar" && eligiendo.id === c.id ? selectorRutas : (
            <View style={estilos.fila}>
              <Boton titulo={t("Aceptar")} variante="exito" estilo={{ flex: 1 }} onPress={() => elegirRutas("aceptar", c.id, c.otro_nombre)} />
              <Boton titulo={t("Rechazar")} variante="secundario" estilo={{ flex: 1 }}
                onPress={() => ejecutar(supabase.rpc("responder_conexion", { p_conexion: c.id, p_aceptar: false }), t("Solicitud rechazada."))} />
            </View>
          )}
        </Tarjeta>
      ))}

      <Tarjeta>
        <View style={[estilos.fila, { justifyContent: "space-between" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{t("Que las familias me encuentren")}</Text>
            <Text style={estilos.textoSuave}>{t("Apareces en la búsqueda con tu nombre, tu furgón y tus comunas. Nunca se muestran tu teléfono ni tus rutas.")}</Text>
          </View>
          <Switch value={visible} trackColor={{ true: colores.verde }}
            onValueChange={(v) => { setVisible(v); guardarPerfil({ visible_en_busqueda: v }, v ? t("Ahora las familias te pueden encontrar.") : t("Ya no apareces en la búsqueda.")); }} />
        </View>
        <Campo etiqueta={t("Comunas donde trabajas")} value={comunas} onChangeText={setComunas} placeholder={t("Ej: Ñuñoa, La Reina, Providencia")} />
        <Campo etiqueta={t("Presentación (opcional)")} value={presentacion} onChangeText={setPresentacion} placeholder={t("Ej: 12 años de experiencia, Colegio X")} maxLength={300} />
        <Boton titulo={t("Guardar")} variante="secundario" onPress={() => guardarPerfil({ comunas: comunas.trim(), presentacion: presentacion.trim() }, t("Datos guardados."))} />
      </Tarjeta>

      <Tarjeta>
        <Text style={estilos.subtitulo}>{t("Buscar una familia")}</Text>
        <Text style={estilos.textoSuave}>{t("Por privacidad, solo con su correo o su teléfono exactos.")}</Text>
        <Campo etiqueta={t("Correo o teléfono")} value={texto} onChangeText={(v) => { setTexto(v); setFamilias(null); }} autoCapitalize="none" placeholder={t("ana@correo.cl o 9 1234 5678")} />
        <Boton titulo={t("Buscar")} deshabilitado={texto.trim().length < 6} onPress={buscar} />
        {familias?.length === 0 ? <Text style={estilos.textoSuave}>{t("No hay una familia registrada con ese correo o teléfono. Puedes enviarle un código de invitación.")}</Text> : null}
        {familias?.map((f) => (
          <View key={f.id} style={{ paddingTop: 10, gap: 6 }}>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{f.nombre}</Text>
            {f.conexion === "aceptada" ? <Text style={{ color: colores.verde, fontWeight: "700" }}>{t("✓ Conectados")}</Text>
              : f.conexion === "pendiente" ? <Text style={estilos.textoSuave}>{t("Solicitud pendiente")}</Text>
              : eligiendo?.tipo === "invitar" && eligiendo.id === f.id ? selectorRutas
              : <Boton titulo={t("🤝 Invitar a conectarse")} onPress={() => elegirRutas("invitar", f.id, f.nombre)} />}
          </View>
        ))}
      </Tarjeta>

      {enviadas.length ? <Text style={estilos.etiqueta}>{t("Invitaciones enviadas")}</Text> : null}
      {enviadas.map((c) => (
        <Tarjeta key={c.id}>
          <Text style={[estilos.texto, { fontWeight: "700" }]}>{c.otro_nombre}</Text>
          <Text style={estilos.textoSuave}>{t("Esperando respuesta")}</Text>
          <Boton titulo={t("Retirar invitación")} variante="texto" onPress={() => ejecutar(supabase.rpc("cancelar_conexion", { p_conexion: c.id }), t("Invitación retirada."))} />
        </Tarjeta>
      ))}

      {conectadas.length ? <Text style={estilos.etiqueta}>{t("Familias conectadas ({n})", { n: conectadas.length })}</Text> : null}
      {conectadas.map((c) => (
        <Tarjeta key={c.id}>
          <Text style={[estilos.texto, { fontWeight: "700" }]}>✓ {c.otro_nombre}</Text>
          <Text style={estilos.textoSuave}>{c.hijos?.length ? t("Hijos: {hijos}", { hijos: c.hijos.join(", ") }) : t("Aún no registra a sus hijos: entrarán solos a tus rutas")}</Text>
          {c.rutas?.length ? <Text style={estilos.textoSuave}>{t("Va en: {rutas}", { rutas: c.rutas.join(t(" y ")) })}</Text> : null}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
