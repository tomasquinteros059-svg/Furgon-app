import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { olvidarDispositivo, registrarParaPush } from "../notificaciones";
import { detenerSeguimiento } from "../ubicacion/seguimiento";
import { supabase } from "./supabase";
import { idioma, sincronizarIdioma } from "../i18n";

export type Rol = "admin" | "conductor" | "apoderado";

export interface Perfil {
  id: string;
  rol: Rol;
  nombre: string;
  empresa_id: string | null;
  /** Conductora que también administra (dueña del furgón). */
  puede_administrar: boolean;
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
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, rol, nombre, empresa_id, puede_administrar, idioma")
      .eq("id", s.user.id)
      .maybeSingle();
    if (error) return; // sin conexión: se mantiene lo que había
    setPerfil((data as Perfil | null) ?? null);
    if (data) registrarParaPush().catch((e) => console.warn("push no disponible:", e?.message ?? e));
    // El servidor usa el idioma del perfil para avisos, notificaciones y llamadas.
    if (data && (data as { idioma?: string }).idioma !== idioma()) sincronizarIdioma().catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        // Sesión y perfil cambian juntos (si no, se ve un instante «Cuenta sin perfil»). Las
        // consultas van fuera del callback, como recomienda supabase-js.
        setTimeout(async () => {
          await cargarPerfil(s);
          setSesion(s);
        }, 0);
      } else {
        setSesion(s);
      }
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
      await olvidarDispositivo().catch(() => {});
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
