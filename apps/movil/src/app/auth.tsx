// Dirección de vuelta de «Entrar con Google» (furgonapp://auth#access_token=…).
// Normalmente la sesión la toma lib/google.ts. Pero si Android cerró la app mientras estaba en
// Google (pasa en teléfonos con poca memoria), la app se abre de nuevo aquí: se toma la sesión de
// la dirección y se vuelve al inicio.
import * as Linking from "expo-linking";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Aviso, Boton, Cargando, Pantalla } from "../componentes/ui";
import { sesionDesdeUrl } from "../lib/google";
import { t } from "../lib/idioma";
import { mensajeError } from "../lib/supabase";
import { router } from "expo-router";

export default function VueltaDeGoogle() {
  const url = Linking.useLinkingURL();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const inicial = url ?? (await Linking.getInitialURL());
      try {
        if (inicial) await sesionDesdeUrl(inicial);
      } catch (e) {
        if (vigente) setError(mensajeError(e));
        return;
      }
      if (vigente) setListo(true);
    })();
    return () => { vigente = false; };
  }, [url]);

  if (error) {
    return (
      <Pantalla titulo={t("No se pudo entrar con Google")}>
        <Aviso tipo="error" texto={error} />
        <Boton titulo={t("Volver")} onPress={() => router.replace("/")} />
      </Pantalla>
    );
  }
  return listo ? <Redirect href="/" /> : <Cargando />;
}
