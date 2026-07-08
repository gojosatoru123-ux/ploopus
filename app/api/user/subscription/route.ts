// app/api/user/subscription/route.ts
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    user: session.user,
    subscription: session.subscription, // null if no row exists — handle that on the client
    fetchedAt: Date.now(),
  });
}
