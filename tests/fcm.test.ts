// Envío directo por Firebase: el mensaje lleva los nombres que entiende expo-notifications en
// Android y la firma de la cuenta de servicio es válida.
import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cuerpoFcm, jwtCuentaServicio, leerCuentaServicio } from "../supabase/functions/_shared/fcm.ts";

describe("FCM directo", () => {
  it("arma un mensaje solo con datos, con canal de alarma, sonido y botones de llamada", () => {
    const c = cuerpoFcm({ token: "fcm:abc123", titulo: "Furgón a 5 min", cuerpo: "Sofía, prepárate", data: { tipo: "llamada", avisoId: "a1" },
      canal: "aviso-furgon", sonido: "alarma.wav", categoria: "llamada-furgon", ttl: 30 });
    expect(c).toEqual({
      message: {
        token: "abc123",
        data: { title: "Furgón a 5 min", message: "Sofía, prepárate", body: JSON.stringify({ tipo: "llamada", avisoId: "a1" }),
          channelId: "aviso-furgon", sound: "alarma.wav", categoryId: "llamada-furgon" },
        android: { priority: "HIGH", ttl: "30s" },
      },
    });
    // Todos los valores de data deben ser texto (FCM lo exige).
    expect(Object.values(c.message.data).every((v) => typeof v === "string")).toBe(true);
  });

  it("firma el JWT de la cuenta de servicio con RS256", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const cuenta = leerCuentaServicio(JSON.stringify({ project_id: "furgon", client_email: "envios@furgon.iam.gserviceaccount.com", private_key: pem }))!;
    const jwt = await jwtCuentaServicio(cuenta, 1_800_000_000);
    const [cab, carga, firma] = jwt.split(".");
    const datos = JSON.parse(Buffer.from(carga, "base64url").toString());
    expect(datos).toMatchObject({ iss: "envios@furgon.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token", iat: 1_800_000_000, exp: 1_800_003_600 });
    const v = createVerify("RSA-SHA256"); v.update(`${cab}.${carga}`);
    expect(v.verify(publicKey, Buffer.from(firma, "base64url"))).toBe(true);
  });

  it("ignora una cuenta de servicio incompleta o mal pegada", () => {
    expect(leerCuentaServicio(undefined)).toBeNull();
    expect(leerCuentaServicio("{no es json")).toBeNull();
    expect(leerCuentaServicio(JSON.stringify({ project_id: "x" }))).toBeNull();
  });
});
