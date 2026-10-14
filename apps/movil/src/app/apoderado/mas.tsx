// Pestaña «Más» de la familia (diseño oct. 2026): código para sumar al papá o la mamá, su furgón,
// sus hijos y, en listas agrupadas, perfil, apariencia, idioma, privacidad y la cuenta.
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, TextInput, View } from "react-native";
import { Avatar } from "../../componentes/avatar";
import { Icono, Text } from "../../componentes/icono";
import { PantallaFamilia } from "../../componentes/pantalla-familia";
import { URL_PRIVACIDAD, URL_TERMINOS } from "../../componentes/privacidad";
import { SelectorTema } from "../../componentes/tema";
import { Aviso, Boton, colores, estilos, FilaGrupo, GrupoMenu } from "../../componentes/ui";
import { SelectorIdioma } from "../../i18n";
import { misConexiones } from "../../lib/conexiones";
import { useSesion } from "../../lib/sesion";
import { mensajeError, supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

interface Hijo { id: string; nombre: string; domicilios: { direccion: string }[] | null }

export default function MasFamilia() {
  const { perfil, sesion, cerrarSesion } = useSesion();
  const sinProteger = !!sesion?.user.is_anonymous;
  const [hijos, setHijos] = useState<Hijo[]>([]);
  const [tia, setTia] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from("alumnos").select("id, nombre, domicilios(direccion)").eq("activo", true).order("nombre")
      .then(({ data }) => setHijos((data as unknown as Hijo[]) ?? []));
    misConexiones().then((c) => {
      setTia(c.find((x) => x.estado === "aceptada")?.otro_nombre ?? null);
      setEsperando(c.some((x) => x.estado === "pendiente"));
    }).catch(() => {});
  }, []));

  async function crearCodigo() {
    setError(null); setCreando(true);
    const { data, error } = await supabase.rpc("compartir_familia", { p_alumnos: null, p_parentesco: null });
    setCreando(false);
    if (error) return setError(mensajeError(error));
    setCodigo(String(data)); setCopiado(false);
  }

  async function copiar() {
    if (!codigo) return;
    await Clipboard.setStringAsync(codigo);
    setCopiado(true);
  }

  function buscar() {
    router.push({ pathname: "/apoderado/conectar", params: busqueda.trim() ? { q: busqueda.trim() } : {} });
  }

  function salir() {
    if (!sinProteger) return cerrarSesion();
    Alert.alert(t("¿Salir sin proteger tu cuenta?"), t("Entraste con un código: si sales ahora, no podrás volver a entrar. Protégela primero con tu correo."), [
      { text: t("Proteger mi cuenta"), onPress: () => router.push("/apoderado/proteger-cuenta") },
      { text: t("Salir igual"), style: "destructive", onPress: cerrarSesion },
    ]);
  }

  const tarjeta = () => ({ backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 30, padding: 20, marginBottom: 16 }) as const;
  const tituloTarjeta = (icono: Parameters<typeof Icono>[0]["nombre"], texto: string) => (
    <View style={[estilos.fila, { gap: 12, marginBottom: 6 }]}>
      <Icono nombre={icono} tam={26} color={colores.texto} acento="transparent" />
      <Text style={{ fontSize: 22, fontWeight: "700", color: colores.texto }}>{texto}</Text>
    </View>
  );

  return (
    <PantallaFamilia>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {sinProteger ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/apoderado/proteger-cuenta")}>
          <Aviso tipo="error" texto={t("Entraste con un código. Toca aquí para proteger tu cuenta con tu correo.")} />
        </Pressable>
      ) : null}

      {/* Código para sumar al papá, la mamá u otro cuidador. */}
      {hijos.length ? (
        <View style={tarjeta()}>
          {tituloTarjeta("enlace", t("Código de familia"))}
          <Text style={{ fontSize: 17, color: colores.suave, lineHeight: 25, marginBottom: 14 }}>{t("Compártelo con el papá o la mamá para conectarse a la misma cuenta.")}</Text>
          <View style={[estilos.fila, { justifyContent: "space-between", borderWidth: 2, borderStyle: "dashed", borderColor: colores.borde, backgroundColor: colores.crema, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18 }]}>
            <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: 4, color: codigo ? colores.texto : colores.suave, flexShrink: 1 }}>{codigo ?? "••••••"}</Text>
            <Pressable accessibilityRole="button" onPress={codigo ? copiar : crearCodigo} disabled={creando}
              style={({ pressed }) => ({ backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.amarilloHondo, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, opacity: pressed || creando ? 0.7 : 1 })}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colores.sobreAmarillo }}>{codigo ? (copiado ? t("¡Copiado!") : t("Copiar")) : t("Crear código")}</Text>
            </Pressable>
          </View>
          {codigo ? <Text style={{ fontSize: 14, color: colores.suave, marginTop: 8 }}>{t("Sirve una vez y vence en 7 días.")}</Text> : null}
          <Boton titulo={t("Ver quién más recibe los avisos")} variante="texto" onPress={() => router.push("/apoderado/familia")} />
        </View>
      ) : null}

      {/* Su furgón: con quién está conectada y buscar otra tía. */}
      <View style={tarjeta()}>
        {tituloTarjeta("lupa", t("Mi furgón"))}
        <Text style={{ fontSize: 17, color: colores.suave, marginBottom: 14 }}>
          {tia ? t("Conectado con {nombre}", { nombre: tia }) : esperando ? t("Esperando que la tía acepte") : t("Aún no te conectas con tu furgón")}
        </Text>
        <View style={[estilos.fila, { gap: 10 }]}>
          <TextInput value={busqueda} onChangeText={setBusqueda} onSubmitEditing={buscar} returnKeyType="search"
            placeholder={t("Buscar tía por nombre o comuna")} placeholderTextColor={colores.suave} accessibilityLabel={t("Buscar tía por nombre o comuna")}
            style={[estilos.input, { flex: 1, marginBottom: 0, borderRadius: 999, paddingHorizontal: 20, backgroundColor: colores.crema }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("Buscar")} onPress={buscar}
            style={({ pressed }) => ({ width: 54, height: 54, borderRadius: 27, backgroundColor: colores.amarillo, borderWidth: 2, borderColor: colores.borde, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
            <Icono nombre="lupa" tam={26} color={colores.sobreAmarillo} acento="transparent" />
          </Pressable>
        </View>
      </View>

      {/* Sus hijos. */}
      <View style={tarjeta()}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colores.texto, marginBottom: 14 }}>{t("Mis hijos")}</Text>
        {hijos.map((h) => (
          <View key={h.id} style={[estilos.fila, { gap: 14, backgroundColor: colores.crema, borderWidth: 2, borderColor: colores.amarilloSuave, borderRadius: 24, padding: 14, marginBottom: 12 }]}>
            <Avatar nombre={h.nombre} tam={50} letras={1} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{h.nombre}</Text>
              {h.domicilios?.[0] ? (
                <View style={[estilos.fila, { gap: 6 }]}>
                  <Icono nombre="pin" tam={17} color={colores.suave} acento="transparent" />
                  <Text numberOfLines={1} style={{ fontSize: 15, color: colores.suave, flex: 1 }}>{h.domicilios[0].direccion}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={() => router.push(perfil?.empresa_id ? "/apoderado/nuevo-alumno" : "/apoderado/conectar")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 2, borderStyle: "dashed", borderColor: colores.borde, borderRadius: 999, paddingVertical: 16, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 22, color: colores.texto }}>+</Text>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colores.texto }}>{hijos.length ? t("Registrar otro hijo") : t("Registrar a mi hijo")}</Text>
        </Pressable>
      </View>

      <GrupoMenu>
        <FilaGrupo titulo={t("Mi perfil")} icono="persona" onPress={() => router.push("/perfil")} />
        <FilaGrupo titulo={t("Apariencia")} icono="sol"><SelectorTema /></FilaGrupo>
        <FilaGrupo titulo={t("Idioma")} icono="globo"><SelectorIdioma /></FilaGrupo>
        {URL_PRIVACIDAD ? (
          <FilaGrupo titulo={t("Privacidad")} icono="escudo">
            <Boton titulo={t("Política de privacidad")} variante="texto" onPress={() => Linking.openURL(URL_PRIVACIDAD!)} />
            {URL_TERMINOS ? <Boton titulo={t("Términos y condiciones")} variante="texto" onPress={() => Linking.openURL(URL_TERMINOS!)} /> : null}
          </FilaGrupo>
        ) : null}
      </GrupoMenu>

      <GrupoMenu>
        <FilaGrupo titulo={t("Eliminar cuenta")} icono="basura" peligro onPress={() => router.push("/eliminar-cuenta")} />
        <FilaGrupo titulo={t("Salir")} icono="salir" peligro onPress={salir} />
      </GrupoMenu>
    </PantallaFamilia>
  );
}
