import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { navegarConGoogleMaps } from "../../../componentes/mapa";
import { MapaConductor } from "../../../componentes/MapaConductor";
import { Aviso, Boton, colores, estilos, Pantalla, Tarjeta } from "../../../componentes/ui";
import { llamarFuncion, mensajeError, supabase } from "../../../lib/supabase";
import { detenerSeguimiento, enviarCola, iniciarSeguimiento, pendientesEnCola, recorridoActivo } from "../../../ubicacion/seguimiento";

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

const ETIQUETA: Record<EstadoParada, string> = {
  pendiente: "Pendiente",
  entregado: "En su hogar ✅",
  ausente: "Ausente",
  no_viaja: "Hoy no viaja",
};

export default function RecorridoConductor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tipo, setTipo] = useState<"ida" | "vuelta">("vuelta");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [enCola, setEnCola] = useState(0);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: rec }, { data }] = await Promise.all([
      supabase.from("recorridos").select("tipo, estado").eq("id", id).single(),
      supabase
        .from("recorrido_alumnos")
        .select("id, orden, estado, eta_seg, alumno:alumnos(nombre), domicilio:domicilios(direccion, indicaciones, lat, lng), avisos(id), a_bordo_por")
        .eq("recorrido_id", id)
        .order("orden"),
    ]);
    if (rec) setTipo(rec.tipo);
    if (rec && rec.estado !== "activo") {
      await detenerSeguimiento();
      router.replace("/conductor");
      return;
    }
    setParadas((data as unknown as Parada[]) ?? []);
    setEnCola(await pendientesEnCola());
  }, [id]);

  useEffect(() => {
    // Si la app se reabrió y el GPS no estaba corriendo para este recorrido, se reanuda.
    if (recorridoActivo() !== id) iniciarSeguimiento(id).catch(() => {});
    cargar();
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

  function finalizar() {
    const quedan = paradas.filter((p) => p.estado === "pendiente").length;
    Alert.alert(
      "Finalizar recorrido",
      quedan ? `Quedan ${quedan} alumno(s) pendientes. ¿Finalizar de todas formas?` : "Se dejará de compartir la ubicación.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: async () => {
            await supabase.rpc("finalizar_recorrido", { p_recorrido: id });
            await detenerSeguimiento();
            router.replace("/conductor");
          },
        },
      ],
    );
  }

  const pendientes = paradas.filter((p) => p.estado === "pendiente");
  const atendidas = paradas.filter((p) => p.estado !== "pendiente");
  const textoEntregado = tipo === "ida" ? "Subió ✅" : "En su hogar ✅";

  return (
    <Pantalla titulo={tipo === "ida" ? "Recorrido de ida" : "Recorrido de vuelta"}>
      <View style={[estilos.fila, { marginBottom: 12 }]}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colores.verde }} />
        <Text style={estilos.textoSuave}>
          Compartiendo ubicación{enCola > 0 ? ` · ${enCola} posiciones esperando señal` : ""}
        </Text>
      </View>
      {error ? <Aviso texto={error} tipo="error" /> : null}

      <MapaConductor recorridoId={id} casas={paradas.map((p) => ({
        id: p.id, numero: p.orden, lat: p.domicilio.lat, lng: p.domicilio.lng, estado: p.estado, avisado: p.avisos.length > 0,
      }))} />

      {pendientes.map((p, i) => (
        <Tarjeta key={p.id} estilo={i === 0 ? { borderColor: colores.amarillo, borderWidth: 2 } : undefined}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colores.texto }}>{p.orden}. {p.alumno.nombre}</Text>
          <Text style={estilos.texto}>{p.domicilio.direccion}</Text>
          {p.domicilio.indicaciones ? <Text style={estilos.textoSuave}>{p.domicilio.indicaciones}</Text> : null}
          <Text style={[estilos.textoSuave, { marginTop: 4 }]}>
            {p.a_bordo_por === "familia" ? "✓ Su familia confirmó que subió · " : ""}
            {p.avisos.length ? "🔔 Apoderado avisado" : "Aún sin aviso"}
            {p.eta_seg !== null ? ` · llegada en ~${Math.max(1, Math.round(p.eta_seg / 60))} min` : ""}
          </Text>
          {i === 0 ? (
            <Boton titulo="🧭 Navegar con Google Maps" variante="secundario" onPress={() => navegarConGoogleMaps(p.domicilio.lat, p.domicilio.lng)} />
          ) : null}
          <View style={[estilos.fila, { marginTop: 10 }]}>
            <Boton titulo={textoEntregado} variante="exito" grande estilo={{ flex: 2 }}
              cargando={marcando === p.id} onPress={() => marcar(p, "entregado")} />
            <Boton titulo="Ausente" variante="peligro" grande estilo={{ flex: 1 }}
              deshabilitado={marcando === p.id} onPress={() => marcar(p, "ausente")} />
          </View>
        </Tarjeta>
      ))}

      {pendientes.length === 0 ? <Aviso tipo="exito" texto="No quedan alumnos pendientes." /> : null}

      {atendidas.length ? <Text style={estilos.subtitulo}>Atendidos</Text> : null}
      {atendidas.map((p) => (
        <Tarjeta key={p.id} estilo={{ opacity: 0.75 }}>
          <View style={[estilos.fila, { justifyContent: "space-between" }]}>
            <Text style={estilos.texto}>{p.orden}. {p.alumno.nombre} · {ETIQUETA[p.estado]}</Text>
            {p.estado !== "no_viaja" ? (
              <Boton titulo="Deshacer" variante="texto" onPress={() => marcar(p, "pendiente")} />
            ) : null}
          </View>
        </Tarjeta>
      ))}

      <Boton titulo="Finalizar recorrido" variante="secundario" onPress={finalizar} estilo={{ marginTop: 16 }} />
    </Pantalla>
  );
}
