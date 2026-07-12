// app/api/user/subscription/route.ts
import { auth } from "@/lib/auth";
import { signLicense } from "@/lib/license";
import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const deviceId = req.nextUrl.searchParams.get("deviceid");
  
  if (!deviceId) {
    return NextResponse.json({ error: "missing deviceid" }, { status: 400, headers: CORS_HEADERS });
  }
  
  const payload = {
    user: session.user,
    subscription: session.subscription,
    deviceId: deviceId,
    fetchedAt: Date.now(),
  };
  const { message, signature } = signLicense(payload);

  return NextResponse.json({ message, signature, deviceId}, { headers: CORS_HEADERS });
}
