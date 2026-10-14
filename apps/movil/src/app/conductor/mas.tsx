// Pestaña «Más» de la tía: todo lo que no se usa a diario (perfil, cobros, familias, licencia,
// apariencia, idioma, cuenta).
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Avatar } from "../../componentes/avatar";
import { Icono, Text } from "../../componentes/icono";
import { EnlacePrivacidad } from "../../componentes/privacidad";
import { SelectorTema } from "../../componentes/tema";
import { Aviso, Boton, colores, estilos, FilaMenu, Pantalla, Tarjeta } from "../../componentes/ui";
import { SelectorIdioma } from "../../i18n";
import { CONSEJOS_CERRADOS, guardar, leer, NUEVOS_VISTOS_HASTA } from "../../lib/avisos-inicio";
import { type EstadoLic, textoLicencia } from "../../lib/licencia";
import { useSesion } from "../../lib/sesion";
import { supabase } from "../../lib/supabase";
import { t } from "../../lib/idioma";

export default function MasTia() {
  const { perfil, cerrarSesion } = useSesion();
  const [licencia, setLicencia] = useState<EstadoLic | null>(null);
  const [porConectar, setPorConectar] = useState(0);
  const [enRecorrido, setEnRecorrido] = useState(false);
  const [avisosCerrados, setAvisosCerrados] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.rpc("estado_licencias").then(({ data }) =>
      setLicencia(((data as (EstadoLic & { conductor_id: string })[]) ?? []).find((x) => x.conductor_id === perfil?.id) ?? null));
    supabase.rpc("mis_conexiones").then(({ data }) =>
      setPorConectar(((data as { estado: string; iniciada_por: string }[] | null) ?? [])
        .filter((x) => x.estado === "pendiente" && x.iniciada_por === "apoderado").length));
    supabase.from("recorridos").select("id").eq("estado", "activo").eq("conductor_id", perfil?.id ?? "")
      .then(({ data }) => setEnRecorrido((data ?? []).length > 0));
    setAvisosCerrados(leer(CONSEJOS_CERRADOS) === "1" || !!leer(NUEVOS_VISTOS_HASTA));
  }, [perfil?.id]));

  const icono = (n: Parameters<typeof Icono>[0]["nombre"]) => <Icono nombre={n} tam={26} color={colores.texto} />;

  return (
    <Pantalla titulo={t("Más")}>
      <FilaMenu titulo={perfil?.nombre ?? ""} detalle={t("Mi perfil y foto")} onPress={() => router.push("/perfil")}
        izquierda={<Avatar nombre={perfil?.nombre ?? ""} foto={perfil?.foto} tam={48} />} />
      {perfil?.puede_administrar ? (
        enRecorrido ? (
          <Aviso texto={t("Administrar: disponible cuando termines el recorrido (no se administra manejando).")} />
        ) : (
          <>
            <FilaMenu titulo={t("Cobros")} detalle={t("Lo que te deben este mes")} izquierda={icono("tarjeta")} onPress={() => router.push("/conductor/administrar/cobros")} />
            <FilaMenu titulo={t("Resumen de administración")} detalle={t("Alumnos, rutas, cobros y consultas")} izquierda={icono("admin")} onPress={() => router.push("/conductor/administrar")} />
          </>
        )
      ) : null}
      <FilaMenu titulo={porConectar ? t("Familias por conectar ({n})", { n: porConectar }) : t("Conectar con familias")}
        detalle={porConectar ? t("Hay familias esperando tu respuesta") : t("Busca familias o deja que te encuentren")}
        izquierda={icono("conexion")} punto={porConectar > 0} onPress={() => router.push("/conductor/conexiones")} />
      <FilaMenu titulo={t("Mi licencia")} detalle={licencia ? textoLicencia(licencia).txt : t("Sube tu licencia de conducir")}
        izquierda={icono("licencia")} punto={!!licencia && licencia.estado !== "vigente"} onPress={() => router.push("/conductor/licencia")} />
      {avisosCerrados ? (
        <Boton titulo={t("Volver a mostrar los avisos")} variante="texto" onPress={() => {
          guardar(CONSEJOS_CERRADOS, null); guardar(NUEVOS_VISTOS_HASTA, null); setAvisosCerrados(false);
        }} />
      ) : null}
      <Text style={[estilos.subtitulo, { marginTop: 10 }]}>{t("Apariencia")}</Text>
      <Tarjeta><SelectorTema /></Tarjeta>
      <Tarjeta><SelectorIdioma /></Tarjeta>
      <EnlacePrivacidad />
      <Boton titulo={t("Eliminar mi cuenta")} variante="texto" onPress={() => router.push("/eliminar-cuenta")} />
      <Boton titulo={t("Salir")} variante="contornoPeligro" onPress={cerrarSesion} />
    </Pantalla>
  );
}
