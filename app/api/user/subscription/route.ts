// app/api/user/subscription/route.ts
import { auth } from "@/lib/auth";

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

  return Response.json(
    {
      user: session.user,
      subscription: session.subscription, // null if no row exists — handle that on the client
      fetchedAt: Date.now(),
    },
    { headers: CORS_HEADERS }
  );
}
