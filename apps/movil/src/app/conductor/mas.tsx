// Pestaña «Más» de la tía (diseño oct. 2026): tarjeta con su foto y datos, su licencia y, en listas
// agrupadas, cobros, familias por conectar, perfil, apariencia, idioma, privacidad y la cuenta.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Avatar } from "../../componentes/avatar";
import { Icono, Text } from "../../componentes/icono";
import { PantallaTia } from "../../componentes/pantalla-tia";
import { URL_PRIVACIDAD, URL_TERMINOS } from "../../componentes/privacidad";
import { SelectorTema } from "../../componentes/tema";
import { Aviso, Boton, colores, FilaGrupo, GrupoMenu } from "../../componentes/ui";
import { SelectorIdioma } from "../../i18n";
import { CONSEJOS_CERRADOS, guardar, leer, NUEVOS_VISTOS_HASTA } from "../../lib/avisos-inicio";
import { aFecha, type EstadoLic, textoLicencia } from "../../lib/licencia";
import { type Documento, documentosConProblema } from "../../lib/documentos";
import { useSesion } from "../../lib/sesion";
import { supabase } from "../../lib/supabase";
import { formatearTelefono } from "../../lib/core";
import { t } from "../../lib/idioma";

export default function MasTia() {
  const { perfil, cerrarSesion } = useSesion();
  const [licencia, setLicencia] = useState<EstadoLic | null>(null);
  const [datos, setDatos] = useState<{ telefono: string | null; comunas: string | null } | null>(null);
  const [porConectar, setPorConectar] = useState(0);
  const [docsPendientes, setDocsPendientes] = useState(0);
  const [enRecorrido, setEnRecorrido] = useState(false);
  const [avisosCerrados, setAvisosCerrados] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.rpc("estado_licencias").then(({ data }) =>
      setLicencia(((data as (EstadoLic & { conductor_id: string })[]) ?? []).find((x) => x.conductor_id === perfil?.id) ?? null));
    supabase.rpc("estado_documentos").then(({ data }) => setDocsPendientes(documentosConProblema(
      ((data as Documento[]) ?? []).filter((d) => d.de === "furgon" || d.conductor_id === perfil?.id)).length));
    supabase.from("perfiles").select("telefono, comunas").eq("id", perfil?.id ?? "").maybeSingle().then(({ data }) => setDatos(data));
    supabase.rpc("mis_conexiones").then(({ data }) =>
      setPorConectar(((data as { estado: string; iniciada_por: string }[] | null) ?? [])
        .filter((x) => x.estado === "pendiente" && x.iniciada_por === "apoderado").length));
    supabase.from("recorridos").select("id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? "")
      .then(({ data }) => setEnRecorrido((data ?? []).length > 0));
    setAvisosCerrados(leer(CONSEJOS_CERRADOS) === "1" || !!leer(NUEVOS_VISTOS_HASTA));
  }, [perfil?.id]));

  const conFecha = licencia?.vence_en && (licencia.estado === "vigente" || licencia.estado === "por_vencer");
  const textoLic = conFecha
    ? (licencia!.dias_restantes === 1
      ? t("Vence el {fecha} · en 1 día", { fecha: aFecha(licencia!.vence_en!) })
      : t("Vence el {fecha} · en {dias} días", { fecha: aFecha(licencia!.vence_en!), dias: licencia!.dias_restantes ?? 0 }))
    : licencia ? textoLicencia(licencia).txt : t("Sube tu licencia de conducir");
  const licenciaMal = !!licencia && licencia.estado !== "vigente";

  return (
    <PantallaTia>
      {/* Tarjeta con su foto y datos: se toca para editarlos. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Mi perfil")} onPress={() => router.push("/perfil")}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 18, backgroundColor: colores.superficie, borderWidth: 2, borderColor: colores.borde, borderRadius: 30, padding: 20, marginBottom: 16, opacity: pressed ? 0.85 : 1 })}>
        <Avatar nombre={perfil?.nombre ?? ""} foto={perfil?.foto} tam={76} letras={1} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colores.texto }}>{perfil?.nombre}</Text>
          {datos?.telefono ? <Text style={{ fontSize: 16, color: colores.suave }}>{formatearTelefono(datos.telefono)}</Text> : null}
          {datos?.comunas ? <Text style={{ fontSize: 16, color: colores.suave }}>{datos.comunas}</Text> : null}
        </View>
      </Pressable>

      {/* Licencia de conducir. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Mi licencia de conducir")} onPress={() => router.push("/conductor/licencia")}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: colores.superficie, borderWidth: 2, borderColor: licenciaMal ? colores.rojo : colores.borde, borderRadius: 30, padding: 20, marginBottom: 16, opacity: pressed ? 0.85 : 1 })}>
        <Icono nombre="licencia" tam={30} color={colores.texto} acento="transparent" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colores.texto }}>{t("Mi licencia de conducir")}</Text>
          <Text style={{ fontSize: 15, color: licenciaMal ? colores.rojo : colores.suave }}>{textoLic}</Text>
        </View>
        <Text style={{ fontSize: 22, color: colores.suave }}>›</Text>
      </Pressable>

      <GrupoMenu>
        <FilaGrupo titulo={t("Documentos del furgón")} icono="furgon" punto={docsPendientes > 0}
          detalle={docsPendientes ? (docsPendientes === 1 ? t("1 documento por revisar") : t("{n} documentos por revisar", { n: docsPendientes })) : t("Todo al día")}
          onPress={() => router.push("/conductor/documentos")} />
      </GrupoMenu>

      {enRecorrido && perfil?.puede_administrar ? (
        <Aviso texto={t("Administrar: disponible cuando termines el recorrido (no se administra manejando).")} />
      ) : null}
      <GrupoMenu>
        {perfil?.puede_administrar && !enRecorrido ? (
          <FilaGrupo titulo={t("Cobros mensuales")} icono="billetera" onPress={() => router.push("/conductor/administrar/cobros")} />
        ) : null}
        <FilaGrupo titulo={porConectar ? t("Familias por conectar ({n})", { n: porConectar }) : t("Familias por conectar")} icono="enlace"
          punto={porConectar > 0} onPress={() => router.push("/conductor/conexiones")} />
        {perfil?.puede_administrar && !enRecorrido ? (
          <FilaGrupo titulo={t("Resumen de administración")} icono="admin" onPress={() => router.push("/conductor/administrar")} />
        ) : null}
        <FilaGrupo titulo={t("Mi perfil")} icono="persona" onPress={() => router.push("/perfil")} />
      </GrupoMenu>

      <GrupoMenu>
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
        <FilaGrupo titulo={t("Salir")} icono="salir" peligro onPress={cerrarSesion} />
      </GrupoMenu>

      {avisosCerrados ? (
        <Boton titulo={t("Volver a mostrar los avisos")} variante="texto" onPress={() => {
          guardar(CONSEJOS_CERRADOS, null); guardar(NUEVOS_VISTOS_HASTA, null); setAvisosCerrados(false);
        }} />
      ) : null}
    </PantallaTia>
  );
}
