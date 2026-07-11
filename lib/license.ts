// lib/license.ts
import { createPrivateKey, sign } from "crypto";

// Fixed 16-byte ASN.1 prefix for wrapping a raw 32-byte Ed25519 seed
// into the DER format Node's crypto module expects.
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function loadPrivateKey() {
  const seedHex = process.env.LICENSE_SIGNING_PRIVATE_KEY_HEX;
  if (!seedHex || seedHex.length !== 64) {
    throw new Error("LICENSE_SIGNING_PRIVATE_KEY_HEX must be a 64-character hex string");
  }
  const seed = Buffer.from(seedHex, "hex");
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, seed]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function signLicense(payload: object): { message: string; signature: string } {
  const message = JSON.stringify(payload);
  const privateKey = loadPrivateKey();
  const signature = sign(null, Buffer.from(message), privateKey).toString("base64");
  return { message, signature };
}
