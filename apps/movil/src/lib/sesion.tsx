import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { registrarParaPush } from "../notificaciones";
import { detenerSeguimiento } from "../ubicacion/seguimiento";
import { supabase } from "./supabase";

export type Rol = "admin" | "conductor" | "apoderado";

export interface Perfil {
  id: string;
  rol: Rol;
  nombre: string;
  empresa_id: string | null;
}

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  recargarPerfil: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase
      .from("perfiles")
      .select("id, rol, nombre, empresa_id")
      .eq("id", s.user.id)
      .maybeSingle();
    setPerfil((data as Perfil | null) ?? null);
    if (data) registrarParaPush().catch((e) => console.warn("push no disponible:", e?.message ?? e));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s);
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") cargarPerfil(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarPerfil]);

  const valor: EstadoSesion = {
    cargando,
    sesion,
    perfil,
    recargarPerfil: () => cargarPerfil(sesion),
    cerrarSesion: async () => {
      await detenerSeguimiento();
      await supabase.auth.signOut();
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const v = useContext(Contexto);
  if (!v) throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  return v;
}
