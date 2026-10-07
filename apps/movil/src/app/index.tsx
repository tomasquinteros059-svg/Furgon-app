import { Redirect } from "expo-router";
import { Cargando } from "../componentes/ui";
import { useSesion } from "../lib/sesion";

/** Punto de entrada: envía a cada usuario a la sección de su rol. */
export default function Inicio() {
  const { cargando, sesion, perfil } = useSesion();
  if (cargando) return <Cargando />;
  if (!sesion) return <Redirect href="/ingresar" />;
  if (!perfil) return <Redirect href="/sin-perfil" />;
  return <Redirect href={`/${perfil.rol}`} />;
}
