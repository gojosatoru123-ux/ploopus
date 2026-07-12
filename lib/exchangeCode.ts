// lib/exchangeCode.ts
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const SECRET = Buffer.from(process.env.PKCE_EXCHANGE_SECRET!, "hex"); // 32 bytes

interface ExchangePayload {
  token: string;
  codeChallenge: string;
  exp: number;
}

export function encryptExchangeCode(payload: ExchangePayload): string {
  const iv = randomBytes(12); // GCM standard nonce size
  const cipher = createCipheriv("aes-256-gcm", SECRET, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // iv + authTag + ciphertext, all packed into one base64url string
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export function decryptExchangeCode(code: string): ExchangePayload {
  const buf = Buffer.from(code, "base64url");

  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", SECRET, iv);
  decipher.setAuthTag(authTag); // throws if tampered — this IS the integrity check

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
