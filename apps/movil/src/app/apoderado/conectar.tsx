// La familia busca a su tía o tío del furgón y le pide conectarse; también responde
// las invitaciones que le envían. Al aceptarse, la familia queda en ese furgón.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { type Conexion, misConexiones } from "../../lib/conexiones";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

interface Tia { id: string; nombre: string; empresa: string; comunas: string | null; presentacion: string | null; conexion: string | null; conexion_id: string | null }

export default function Conectar() {
  const { recargarPerfil } = useSesion();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Tia[] | null>(null);
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [eligiendo, setEligiendo] = useState<Tia | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [refrescar, setRefrescar] = useState(0);

  const cargar = useCallback(async () => {
    try { setConexiones(await misConexiones()); } catch (e) { setMsg({ ok: false, txt: mensajeError(e) }); }
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Búsqueda mientras se escribe (nombre, empresa o comuna).
  useEffect(() => {
    if (texto.trim().length < 2) { setResultados(null); return; }
    const espera = setTimeout(async () => {
      const { data, error } = await supabase.rpc("buscar_tias", { p_texto: texto });
      if (error) setMsg({ ok: false, txt: mensajeError(error) }); else setResultados((data as Tia[]) ?? []);
    }, 350);
    return () => clearTimeout(espera);
  }, [texto, refrescar]);

  async function ejecutar(p: PromiseLike<{ error: unknown }>, ok: string) {
    setMsg(null);
    const { error } = await p;
    if (error) { setMsg({ ok: false, txt: mensajeError(error) }); return; }
    setMsg({ ok: true, txt: ok });
    setEligiendo(null); setMensaje("");
    await cargar();
    await recargarPerfil();
    setRefrescar((n) => n + 1); // actualiza el estado de la conexión en los resultados
  }

  const recibidas = conexiones.filter((c) => c.estado === "pendiente" && c.iniciada_por === "conductor");
  const enviadas = conexiones.filter((c) => c.estado === "pendiente" && c.iniciada_por === "apoderado");
  const conectadas = conexiones.filter((c) => c.estado === "aceptada");

  return (
    <Pantalla titulo={t("Conectar con tu tía o tío")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}

      {recibidas.map((c) => (
        <Tarjeta key={c.id} estilo={{ borderColor: colores.verde, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("🤝 {nombre} quiere conectarse contigo", { nombre: c.otro_nombre })}</Text>
          <Text style={estilos.textoSuave}>{c.empresa}{c.comunas ? ` · ${c.comunas}` : ""}</Text>
          {c.mensaje ? <Text style={estilos.texto}>“{c.mensaje}”</Text> : null}
          <View style={estilos.fila}>
            <Boton titulo={t("Aceptar")} variante="exito" estilo={{ flex: 1 }}
              onPress={() => ejecutar(supabase.rpc("responder_conexion", { p_conexion: c.id, p_aceptar: true }), t("Listo: ya estás conectado/a con {nombre}. Ahora registra a tus hijos.", { nombre: c.otro_nombre }))} />
            <Boton titulo={t("Rechazar")} variante="secundario" estilo={{ flex: 1 }}
              onPress={() => ejecutar(supabase.rpc("responder_conexion", { p_conexion: c.id, p_aceptar: false }), t("Invitación rechazada."))} />
          </View>
        </Tarjeta>
      ))}

      <Tarjeta>
        <Campo etiqueta={t("Buscar tía o tío del furgón")} value={texto} onChangeText={setTexto} placeholder={t("Nombre, furgón o comuna")} autoCapitalize="words" />
        {resultados === null ? (
          <Text style={estilos.textoSuave}>{t("Escribe al menos 2 letras. Solo aparecen quienes activaron «Que las familias me encuentren».")}</Text>
        ) : resultados.length === 0 ? (
          <Text style={estilos.textoSuave}>{t("No encontramos a nadie con «{texto}». Pídele a tu tía o tío que active la búsqueda en su app, o que te envíe un código.", { texto: texto.trim() })}</Text>
        ) : resultados.map((tia) => (
          <View key={tia.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: colores.borde, gap: 4 }}>
            <Text style={[estilos.texto, { fontWeight: "700" }]}>{tia.nombre}</Text>
            <Text style={estilos.textoSuave}>🚐 {tia.empresa}{tia.comunas ? ` · ${tia.comunas}` : ""}</Text>
            {tia.presentacion ? <Text style={estilos.textoSuave}>{tia.presentacion}</Text> : null}
            {tia.conexion === "aceptada" ? <Text style={{ color: colores.verde, fontWeight: "700" }}>{t("✓ Conectados")}</Text>
              : tia.conexion === "pendiente" ? <Text style={estilos.textoSuave}>{t("Solicitud enviada · esperando respuesta")}</Text>
              : eligiendo?.id === tia.id ? (
                <View style={{ gap: 6 }}>
                  <Campo etiqueta={t("Mensaje (opcional)")} value={mensaje} onChangeText={setMensaje} placeholder={t("Ej: Hola tía, Sofía va en 3° básico")} maxLength={300} />
                  <View style={estilos.fila}>
                    <Boton titulo={t("Enviar solicitud")} estilo={{ flex: 1 }}
                      onPress={() => ejecutar(supabase.rpc("solicitar_conexion", { p_otro: tia.id, p_mensaje: mensaje }), t("Solicitud enviada a {nombre}. Te avisaremos cuando responda.", { nombre: tia.nombre }))} />
                    <Boton titulo={t("Cancelar")} variante="secundario" estilo={{ flex: 1 }} onPress={() => setEligiendo(null)} />
                  </View>
                </View>
              ) : <Boton titulo={t("🤝 Conectar")} variante="secundario" onPress={() => { setEligiendo(tia); setMensaje(""); }} />}
          </View>
        ))}
      </Tarjeta>

      {enviadas.length ? <Text style={estilos.etiqueta}>{t("Solicitudes enviadas")}</Text> : null}
      {enviadas.map((c) => (
        <Tarjeta key={c.id}>
          <Text style={[estilos.texto, { fontWeight: "700" }]}>{c.otro_nombre}</Text>
          <Text style={estilos.textoSuave}>{t("{empresa} · esperando respuesta", { empresa: c.empresa })}</Text>
          <Boton titulo={t("Retirar solicitud")} variante="texto" onPress={() => ejecutar(supabase.rpc("cancelar_conexion", { p_conexion: c.id }), t("Solicitud retirada."))} />
        </Tarjeta>
      ))}

      {conectadas.length ? <Text style={estilos.etiqueta}>{t("Conectado/a con")}</Text> : null}
      {conectadas.map((c) => (
        <Tarjeta key={c.id}>
          <Text style={[estilos.texto, { fontWeight: "700" }]}>✓ {c.otro_nombre}</Text>
          <Text style={estilos.textoSuave}>🚐 {c.empresa}{c.comunas ? ` · ${c.comunas}` : ""}</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
