// app/api/auth/exchange/route.ts
import { NextRequest, NextResponse } from "next/server";
import { decryptExchangeCode } from "@/lib/exchangeCode";
import { createHash, timingSafeEqual } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { code, code_verifier } = await req.json();
    if (!code || !code_verifier) {
      return NextResponse.json({ error: "missing fields" }, { status: 400, headers: CORS_HEADERS });
    }

    let payload;
    try {
      payload = decryptExchangeCode(code);
    } catch {
      // decryption/auth-tag failure = tampered or malformed code
      return NextResponse.json({ error: "invalid code" }, { status: 400, headers: CORS_HEADERS });
    }

    if (Date.now() > payload.exp) {
      return NextResponse.json({ error: "code expired" }, { status: 400, headers: CORS_HEADERS });
    }

    const computedChallenge = createHash("sha256").update(code_verifier).digest("base64url");
    const expected = Buffer.from(payload.codeChallenge);
    const actual = Buffer.from(computedChallenge);

    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!matches) {
      return NextResponse.json({ error: "verifier mismatch" }, { status: 403, headers: CORS_HEADERS });
    }

    return NextResponse.json({ token: payload.token }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: CORS_HEADERS });
  }
}
