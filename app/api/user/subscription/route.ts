// app/api/user/subscription/route.ts
import { auth } from "@/lib/auth";
import { signLicense } from "@/lib/license";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  
  const payload = {
    user: session.user,
    subscription: session.subscription,
    deviceId: req.nextUrl.searchParams.get("deviceid"),
    fetchedAt: Date.now(),
  };
  const { message, signature } = signLicense(payload);

  return Response.json({ message, signature, deviceId: req.nextUrl.searchParams.get("deviceid")}, { headers: CORS_HEADERS });
}
