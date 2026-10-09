// Idioma de la app: Automático (el del teléfono), Español o English. Igual que el tema: `t()` lee
// siempre el idioma actual y, al cambiarlo, el proveedor vuelve a dibujar la app completa.
// El idioma también se guarda en el perfil, para que avisos, notificaciones y llamadas lleguen
// en el idioma de cada persona.
import Storage from "expo-sqlite/kv-store";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { type Idioma, NOMBRE_IDIOMA, type PreferenciaIdioma } from "../../../idiomas/index.ts";
import { Text } from "./componentes/icono";
import { colores } from "./componentes/tema";
import { fijarIdioma, idioma, idiomaSistema, t } from "./lib/idioma";
import { supabase } from "./lib/supabase";

export { idioma, locale, t } from "./lib/idioma";

/** Guarda el idioma en el perfil (si hay sesión) para los avisos que manda el servidor. */
export async function sincronizarIdioma(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (uid) await supabase.from("perfiles").update({ idioma: idioma() }).eq("id", uid);
}

const CLAVE = "idioma";
const Contexto = createContext<{ preferencia: PreferenciaIdioma; cambiar: (p: PreferenciaIdioma) => void } | null>(null);

export function ProveedorIdioma({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaIdioma>("sistema");
  useEffect(() => {
    Storage.getItem(CLAVE).then((v) => { if (v === "sistema" || v === "es" || v === "en") setPreferencia(v); }).catch(() => {});
  }, []);
  const actual: Idioma = preferencia === "sistema" ? idiomaSistema() : preferencia;
  fijarIdioma(actual);
  const cambiar = (p: PreferenciaIdioma) => {
    setPreferencia(p);
    fijarIdioma(p === "sistema" ? idiomaSistema() : p);
    Storage.setItem(CLAVE, p).catch(() => {});
    sincronizarIdioma().catch(() => {});
  };
  return (
    <Contexto.Provider value={{ preferencia, cambiar }}>
      {/* La clave obliga a redibujar todo en el idioma nuevo. */}
      <View key={actual} style={{ flex: 1 }}>{children}</View>
    </Contexto.Provider>
  );
}

export function useIdioma() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useIdioma debe usarse dentro de ProveedorIdioma");
  return v;
}

/** Selector Automático · Español · English. */
export function SelectorIdioma() {
  const { preferencia, cambiar } = useIdioma();
  const opciones: [PreferenciaIdioma, string][] = [["sistema", t("Automático")], ["es", NOMBRE_IDIOMA.es], ["en", NOMBRE_IDIOMA.en]];
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colores.texto }}>{t("Idioma")}</Text>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colores.borde, borderRadius: 12, padding: 3, gap: 3, backgroundColor: colores.superficie2 }}>
        {opciones.map(([v, nombre]) => {
          const activo = preferencia === v;
          return (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: activo }} onPress={() => cambiar(v)}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: activo ? colores.amarillo : "transparent" }}>
              <Text style={{ fontWeight: "700", color: activo ? colores.sobreAmarillo : colores.suave }}>{nombre}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
