import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Icono, Text } from "../../../componentes/icono";
import { navegarConGoogleMaps, navegarConWaze } from "../../../componentes/mapa";
import { MapaConductor } from "../../../componentes/MapaConductor";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { comoLista, llamarFuncion, mensajeError, supabase } from "../../../lib/supabase";
import { t } from "../../../lib/idioma";
import { detenerSeguimiento, enviarCola, gpsActivoPara, iniciarSeguimiento, pendientesEnCola } from "../../../ubicacion/seguimiento";

type EstadoParada = "pendiente" | "entregado" | "ausente" | "no_viaja";

interface Parada {
  id: string;
  orden: number;
  estado: EstadoParada;
  eta_seg: number | null;
  alumno: { nombre: string };
  domicilio: { direccion: string; indicaciones: string | null; lat: number; lng: number };
  avisos: { id: string }[];
  a_bordo_por: "familia" | "tia" | null;
}

const etiqueta = (estado: EstadoParada, tipo: "ida" | "vuelta"): string => ({
  pendiente: t("Pendiente"),
  entregado: tipo === "ida" ? t("Subió ✅") : t("En su hogar ✅"),
  ausente: t("Ausente"),
  no_viaja: t("Hoy no viaja"),
})[estado];

interface DestinoRec { id: string; orden: number; nombre: string; direccion: string | null; lat: number; lng: number; llegado: boolean }

export default function RecorridoConductor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tipo, setTipo] = useState<"ida" | "vuelta">("vuelta");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [destinos, setDestinos] = useState<DestinoRec[]>([]);
  const [enCola, setEnCola] = useState(0);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Carga el recorrido; devuelve si sigue activo (null si no hubo conexión). */
  const cargar = useCallback(async (): Promise<boolean | null> => {
    const [r1, r2] = await Promise.all([
      supabase.from("recorridos").select("tipo, estado, ruta_id").eq("id", id).single(),
      supabase
        .from("recorrido_alumnos")
        .select("id, orden, estado, eta_seg, alumno:alumnos(nombre), domicilio:domicilios(direccion, indicaciones, lat, lng), avisos(id), a_bordo_por")
        .eq("recorrido_id", id)
        .order("orden"),
    ]);
    setEnCola(await pendientesEnCola());
    // Sin señal: se mantiene lo último que se vio (no se borra la lista de paradas).
    if (r1.error || r2.error || !r1.data) return null;
    setTipo(r1.data.tipo);
    // Colegios de la ruta (destino final en la ida, partida en la vuelta) y si ya se marcaron.
    const [d, ll] = await Promise.all([
      supabase.from("ruta_destinos").select("id, orden, nombre, direccion, lat, lng").eq("ruta_id", r1.data.ruta_id).order("orden"),
      supabase.from("recorrido_destinos").select("destino_id").eq("recorrido_id", id),
    ]);
    if (!d.error && !ll.error) {
      const marcados = new Set((ll.data ?? []).map((x) => x.destino_id));
      setDestinos((d.data ?? []).map((x) => ({ ...x, llegado: marcados.has(x.id) })));
    }
    if (r1.data.estado !== "activo") {
      await detenerSeguimiento();
      router.replace("/conductor");
      return false;
    }
    // avisos tiene un único aviso por parada (recorrido_alumno_id es unique): Supabase lo entrega
    // como objeto o null, no como lista. Se normaliza para no caerse con .length sobre null.
    setParadas(((r2.data ?? []) as unknown as (Omit<Parada, "avisos"> & { avisos: unknown })[])
      .map((p) => ({ ...p, avisos: comoLista(p.avisos as Parada["avisos"][number] | Parada["avisos"] | null) })));
    return true;
  }, [id]);

  useEffect(() => {
    (async () => {
      // Primero se confirma que el recorrido sigue activo; si el GPS no está corriendo para él
      // (la app se cerró o el teléfono se reinició), se reanuda.
      const activo = await cargar();
      if (activo !== false && !(await gpsActivoPara(id))) iniciarSeguimiento(id).catch(() => {});
    })();
    const intervalo = setInterval(() => {
      enviarCola().catch(() => {});
      cargar();
    }, 15_000);
    return () => clearInterval(intervalo);
  }, [id, cargar]);

  async function marcar(parada: Parada, estado: EstadoParada) {
    setError(null);
    setMarcando(parada.id);
    try {
      await llamarFuncion("marcar-parada", { parada_id: parada.id, estado });
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setMarcando(null);
    }
  }

  async function marcarColegio(d: DestinoRec, deshacer = false) {
    setError(null);
    setMarcando(d.id);
    try {
      await llamarFuncion("marcar-parada", { recorrido_id: id, destino_id: d.id, deshacer });
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setMarcando(null);
    }
  }

  function finalizar() {
    const quedan = paradas.filter((p) => p.estado === "pendiente").length;
    Alert.alert(
      t("Finalizar recorrido"),
      quedan === 1 ? t("Queda 1 alumno pendiente. ¿Finalizar de todas formas?")
        : quedan ? t("Quedan {n} alumnos pendientes. ¿Finalizar de todas formas?", { n: quedan })
        : t("Se dejará de compartir la ubicación."),
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Finalizar"),
          style: "destructive",
          onPress: async () => {
            setError(null);
            // Primero se envían las posiciones guardadas; después se cierra el recorrido.
            await enviarCola().catch(() => {});
            const { error: e } = await supabase.rpc("finalizar_recorrido", { p_recorrido: id });
            if (e) return setError(mensajeError(e));
            await detenerSeguimiento();
            router.replace("/conductor");
          },
        },
      ],
    );
  }

  const pendientes = paradas.filter((p) => p.estado === "pendiente");
  const atendidas = paradas.filter((p) => p.estado !== "pendiente");
  const textoEntregado = tipo === "ida" ? t("Subió ✅") : t("En su hogar ✅");
  const colegiosPendientes = destinos.filter((d) => !d.llegado);
  const hayAtendidos = atendidas.length > 0 || destinos.some((d) => d.llegado);
  // Ida: primero las casas y al final el colegio. Vuelta: primero el colegio y después las casas.
  const colegioPrimero = tipo === "vuelta" ? colegiosPendientes.length > 0 : pendientes.length === 0;

  const tarjetaColegio = (d: DestinoRec, i: number) => {
    const destacado = colegioPrimero && i === 0;
    return (
      <Tarjeta key={d.id} estilo={{ borderColor: destacado ? colores.amarillo : colores.borde, borderWidth: 2, backgroundColor: colores.amarilloSuave }}>
        <View style={[estilos.fila, { gap: 12 }]}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, alignItems: "center", justifyContent: "center" }}>
            <Icono nombre="colegio" tam={26} color={colores.sobreAmarillo} acento="transparent" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", letterSpacing: 1, color: colores.suave }}>
              {(tipo === "ida" ? t("Destino final") : t("Punto de partida")).toUpperCase()}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colores.texto }}>{d.nombre}</Text>
            {d.direccion ? <Text style={estilos.texto}>{d.direccion}</Text> : null}
          </View>
        </View>
        {destacado ? (
          <View style={[estilos.fila, { marginTop: 10 }]}>
            <Boton titulo="🧭 Google Maps" variante="secundario" estilo={{ flex: 1 }} onPress={() => navegarConGoogleMaps(d.lat, d.lng)} />
            <Boton titulo="🚗 Waze" variante="secundario" estilo={{ flex: 1 }} onPress={() => navegarConWaze(d.lat, d.lng)} />
          </View>
        ) : null}
        <Boton titulo={tipo === "ida" ? t("Llegamos al colegio ✅") : t("Salimos del colegio ✅")} variante="exito" grande
          estilo={{ marginTop: 10 }} cargando={marcando === d.id} onPress={() => marcarColegio(d)} />
        <Text style={[estilos.textoSuave, { marginTop: 6 }]}>
          {tipo === "ida" ? t("Las familias de los niños que subieron reciben el aviso de llegada.") : t("Las familias reciben el aviso de que su hijo va camino a casa.")}
        </Text>
      </Tarjeta>
    );
  };

  return (
    <Pantalla titulo={tipo === "ida" ? t("Recorrido de ida") : t("Recorrido de vuelta")}>
      <View style={[estilos.fila, { marginBottom: 12 }]}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colores.verde }} />
        <Text style={estilos.textoSuave}>
          {enCola === 1 ? t("Compartiendo ubicación · 1 posición esperando señal")
            : enCola > 0 ? t("Compartiendo ubicación · {n} posiciones esperando señal", { n: enCola })
            : t("Compartiendo ubicación")}
        </Text>
      </View>
      {error ? <Aviso texto={error} tipo="error" /> : null}

      <MapaConductor recorridoId={id} casas={paradas.map((p) => ({
        id: p.id, numero: p.orden, lat: p.domicilio.lat, lng: p.domicilio.lng, estado: p.estado, avisado: p.avisos.length > 0,
      }))} />

      {tipo === "vuelta" ? colegiosPendientes.map(tarjetaColegio) : null}

      {pendientes.map((p, i) => (
        <Tarjeta key={p.id} estilo={i === 0 && !colegioPrimero ? { borderColor: colores.amarillo, borderWidth: 2 } : undefined}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colores.texto }}>{p.orden}. {p.alumno.nombre}</Text>
          <Text style={estilos.texto}>{p.domicilio.direccion}</Text>
          {p.domicilio.indicaciones ? <Text style={estilos.textoSuave}>{p.domicilio.indicaciones}</Text> : null}
          <Text style={[estilos.textoSuave, { marginTop: 4 }]}>
            {p.a_bordo_por === "familia" ? `${t("✓ Su familia confirmó que subió")} · ` : ""}
            {p.avisos.length ? t("🔔 Apoderado avisado") : t("Aún sin aviso")}
            {p.eta_seg !== null ? ` · ${t("llegada en ~{min} min", { min: Math.max(1, Math.round(p.eta_seg / 60)) })}` : ""}
          </Text>
          {i === 0 && !colegioPrimero ? (
            <View style={estilos.fila}>
              <Boton titulo="🧭 Google Maps" variante="secundario" estilo={{ flex: 1 }} onPress={() => navegarConGoogleMaps(p.domicilio.lat, p.domicilio.lng)} />
              <Boton titulo="🚗 Waze" variante="secundario" estilo={{ flex: 1 }} onPress={() => navegarConWaze(p.domicilio.lat, p.domicilio.lng)} />
            </View>
          ) : null}
          <View style={[estilos.fila, { marginTop: 10 }]}>
            <Boton titulo={textoEntregado} variante="exito" grande estilo={{ flex: 1 }}
              cargando={marcando === p.id} onPress={() => marcar(p, "entregado")} />
            <Boton titulo={t("Ausente")} variante="peligro" grande estilo={{ flex: 1 }}
              deshabilitado={marcando === p.id} onPress={() => marcar(p, "ausente")} />
          </View>
        </Tarjeta>
      ))}

      {pendientes.length === 0 ? <Aviso tipo="exito" texto={t("No quedan alumnos pendientes.")} /> : null}

      {tipo === "ida" ? colegiosPendientes.map(tarjetaColegio) : null}

      {hayAtendidos ? <Text style={estilos.subtitulo}>{t("Atendidos")}</Text> : null}
      {destinos.filter((d) => d.llegado).map((d) => (
        <Tarjeta key={d.id} estilo={{ opacity: 0.75 }}>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <Text style={[estilos.texto, { flex: 1 }]}>🏫 {d.nombre} · {tipo === "ida" ? t("Llegamos ✅") : t("Salimos ✅")}</Text>
            <Boton titulo={t("Deshacer")} variante="texto" onPress={() => marcarColegio(d, true)} />
          </View>
        </Tarjeta>
      ))}
      {atendidas.map((p) => (
        <Tarjeta key={p.id} estilo={{ opacity: 0.75 }}>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <Text style={estilos.texto}>{p.orden}. {p.alumno.nombre} · {etiqueta(p.estado, tipo)}</Text>
            {p.estado !== "no_viaja" ? (
              <Boton titulo={t("Deshacer")} variante="texto" onPress={() => marcar(p, "pendiente")} />
            ) : null}
          </View>
        </Tarjeta>
      ))}

      <Boton titulo={t("Finalizar recorrido")} variante="secundario" onPress={finalizar} estilo={{ marginTop: 16 }} />
    </Pantalla>
  );
}
