import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createSecretToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function hashesMatch(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, "utf8");
  const actual = Buffer.from(actualHash, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
