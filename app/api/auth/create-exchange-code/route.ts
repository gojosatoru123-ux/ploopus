// app/api/auth/create-exchange-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { encryptExchangeCode } from "@/lib/exchangeCode";

export async function POST(req: NextRequest) {
  const { token, codeChallenge } = await req.json();

  if (!token || !codeChallenge) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const code = encryptExchangeCode({
    token,
    codeChallenge,
    exp: Date.now() + 60_000, // 60-second window
  });

  return NextResponse.json({ code });
}
