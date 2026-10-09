// Perfil de familia compartido (dúo): la mamá comparte a sus hijos con el papá, o al revés.
// Cada uno entra con su propia cuenta y ambos reciben la alarma, siguen el furgón en vivo,
// confirman avisos y marcan «hoy no viaja». También sirve para abuelos u otro cuidador.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, View } from "react-native";
import { Text } from "../../componentes/icono";
import { Aviso, Boton, Campo, colores, estilos, Pantalla, Tarjeta } from "../../componentes/ui";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

interface Vinculo { alumno_id: string; alumno: string; apoderado_id: string; apoderado: string; parentesco: string | null; soy_yo: boolean; lo_invite: boolean }
// Se guardan en español (dato); en pantalla se muestran traducidos.
const PARENTESCOS = ["Papá", "Mamá", "Abuelo/a", "Otro"] as const; // i18n-ignorar
/** «Ana y Pedro» / «Ana and Pedro». */
const unirNombres = (nombres: string[]) => nombres.length ? nombres.reduce((a, b) => t("{a} y {b}", { a, b })) : "";

export default function Familia() {
  const { recargarPerfil } = useSesion();
  const [familia, setFamilia] = useState<Vinculo[]>([]);
  const [parentesco, setParentesco] = useState<string>("Papá"); // i18n-ignorar
  const [elegidos, setElegidos] = useState<Set<string> | null>(null); // null = todos
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("mi_familia");
    if (error) setMsg({ ok: false, txt: mensajeError(error) }); else setFamilia((data as Vinculo[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const hijos = [...new Map(familia.map((v) => [v.alumno_id, v.alumno])).entries()];

  async function compartir() {
    setMsg(null);
    const lista = elegidos ? [...elegidos] : null;
    if (lista && lista.length === 0) return setMsg({ ok: false, txt: t("Elige al menos un hijo/a.") });
    const { data, error } = await supabase.rpc("compartir_familia", { p_alumnos: lista, p_parentesco: parentesco === "Otro" ? null : parentesco });
    if (error) return setMsg({ ok: false, txt: mensajeError(error) });
    const nombres = hijos.filter(([id]) => !lista || lista.includes(id)).map(([, n]) => n.split(" ")[0]);
    await Share.share({
      message: t("Hola. Te comparto a {nombres} en la app «Furgón Escolar» para que también recibas los avisos del furgón y lo sigas en vivo.\n1) Descarga la app.\n2) Si no tienes cuenta, toca «Crear cuenta» y escribe este código: {codigo}\n   Si ya tienes cuenta, ve a «Familia» → «Tengo un código».\nEl código sirve una vez y vence en 7 días.", { nombres: unirNombres(nombres), codigo: String(data) }),
    });
    setMsg({ ok: true, txt: t("Código {codigo} listo. Cuando lo use, aparecerá aquí.", { codigo: String(data) }) });
  }

  async function unirse() {
    setMsg(null);
    const { data, error } = await supabase.rpc("unirse_familia", { p_codigo: codigo });
    if (error) return setMsg({ ok: false, txt: mensajeError(error) });
    setCodigo("");
    setMsg({ ok: true, txt: t("Listo: ahora también recibes los avisos de {nombres}.", { nombres: unirNombres((data as string[]) ?? []) }) });
    await recargarPerfil();
    cargar();
  }

  function quitar(v: Vinculo) {
    const yo = v.soy_yo;
    Alert.alert(yo ? t("¿Dejar de recibir los avisos de {alumno}?", { alumno: v.alumno }) : t("¿Dejar de compartir a {alumno} con {apoderado}?", { alumno: v.alumno, apoderado: v.apoderado }),
      yo ? t("Ya no verás a este hijo/a en tu app.") : t("Ya no recibirá los avisos ni verá el furgón."), [
        { text: t("Cancelar"), style: "cancel" },
        { text: yo ? t("Salir de la familia") : t("Dejar de compartir"), style: "destructive", onPress: async () => {
          const { error } = await supabase.rpc("dejar_de_compartir", { p_alumno: v.alumno_id, p_apoderado: v.apoderado_id });
          setMsg(error ? { ok: false, txt: mensajeError(error) } : { ok: true, txt: t("Listo.") });
          cargar();
        } },
      ]);
  }

  return (
    <Pantalla titulo={t("Familia")} accion={<Boton titulo={t("Volver")} variante="texto" onPress={() => router.back()} />}>
      <Text style={estilos.textoSuave}>
        {t("Comparte a tus hijos con el papá o la mamá (o un abuelo/a). Cada uno entra con su propia cuenta y ambos reciben la alarma, las llamadas, siguen el furgón en vivo y pueden marcar «Ya subió» y «hoy no viaja».")}
      </Text>
      {msg ? <Aviso tipo={msg.ok ? "exito" : "error"} texto={msg.txt} /> : null}

      {hijos.map(([id, nombre]) => (
        <Tarjeta key={id}>
          <Text style={estilos.subtitulo}>{nombre}</Text>
          {familia.filter((v) => v.alumno_id === id).map((v) => (
            <View key={v.apoderado_id} style={[estilos.fila, { justifyContent: "space-between", paddingVertical: 4 }]}>
              <Text style={[estilos.texto, { flex: 1 }]}>
                {v.soy_yo ? t("👤 Tú") : `👥 ${v.apoderado}`}{v.parentesco && !v.soy_yo ? ` · ${t(v.parentesco)}` : ""}
              </Text>
              {v.soy_yo || v.lo_invite ? (
                <Boton titulo={v.soy_yo ? t("Salir de la familia") : t("Quitar")} variante="texto" onPress={() => quitar(v)} />
              ) : null}
            </View>
          ))}
        </Tarjeta>
      ))}

      {hijos.length ? (
        <Tarjeta estilo={{ borderColor: colores.amarillo, borderWidth: 2 }}>
          <Text style={estilos.subtitulo}>{t("👨‍👩‍👧 Compartir con…")}</Text>
          <View style={[estilos.fila, { flexWrap: "wrap" }]}>
            {PARENTESCOS.map((p) => (
              <Boton key={p} titulo={t(p)} variante={parentesco === p ? "primario" : "secundario"} estilo={{ minHeight: 40, paddingHorizontal: 14 }} onPress={() => setParentesco(p)} />
            ))}
          </View>
          {hijos.length > 1 ? (
            <>
              <Text style={estilos.etiqueta}>{t("¿A quiénes?")}</Text>
              <View style={[estilos.fila, { flexWrap: "wrap" }]}>
                {hijos.map(([id, nombre]) => {
                  const marcado = !elegidos || elegidos.has(id);
                  return (
                    <Boton key={id} titulo={`${marcado ? "✓ " : ""}${nombre.split(" ")[0]}`} variante={marcado ? "exito" : "secundario"}
                      estilo={{ minHeight: 40, paddingHorizontal: 14 }}
                      onPress={() => {
                        const s = new Set(elegidos ?? hijos.map(([x]) => x));
                        if (s.has(id)) s.delete(id); else s.add(id);
                        setElegidos(s);
                      }} />
                  );
                })}
              </View>
            </>
          ) : null}
          <Boton titulo={t("Compartir por WhatsApp u otra app")} onPress={compartir} />
          <Text style={estilos.textoSuave}>{t("Se crea un código de un solo uso que vence en 7 días.")}</Text>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Text style={estilos.subtitulo}>{t("Tengo un código de la familia")}</Text>
        <Text style={estilos.textoSuave}>{t("Si te compartieron a los hijos, escribe aquí el código que te enviaron.")}</Text>
        <Campo etiqueta={t("Código")} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" placeholder="F1A2B3C4" />
        <Boton titulo={t("Unirme")} variante="secundario" deshabilitado={codigo.trim().length < 6} onPress={unirse} />
      </Tarjeta>
    </Pantalla>
  );
}
