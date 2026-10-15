// Firma de AWS (ejemplo oficial de la documentación de Signature V4) y lectura de CompareFaces.
import { describe, expect, it } from "vitest";
import { firmarAws, leerCompareFaces } from "../supabase/functions/_shared/core/aws.ts";

describe("AWS", () => {
  it("firma igual que el ejemplo oficial de Signature V4 (IAM ListUsers)", async () => {
    const h = await firmarAws({
      metodo: "GET", url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08", servicio: "iam",
      cred: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1" },
      encabezados: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" }, cuerpo: "", fecha: "20150830T123600Z",
    });
    expect(h.Authorization).toBe("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, "
      + "SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7");
  });

  it("lee el resultado de CompareFaces", () => {
    expect(leerCompareFaces(true, { FaceMatches: [{ Similarity: 99.12 }] })).toEqual({ resultado: "coincide", similitud: 99.1 });
    expect(leerCompareFaces(true, { FaceMatches: [{ Similarity: 80 }] })).toMatchObject({ resultado: "dudoso" });
    expect(leerCompareFaces(true, { FaceMatches: [], UnmatchedFaces: [{}] })).toEqual({ resultado: "no_coincide", similitud: 0 });
    expect(leerCompareFaces(false, { __type: "InvalidParameterException", Message: "There are no faces in the image. Should be at least 1." }))
      .toMatchObject({ resultado: "sin_rostro" });
    expect(leerCompareFaces(false, { __type: "AccessDeniedException", Message: "nope" })).toMatchObject({ resultado: "error" });
  });
});
