import { auth } from "@/lib/auth"; // Your server-side auth instance
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  // Fetch session server-side using the request headers
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use the session token (which is the basis for the bearer token)
  // or regenerate/retrieve it via your specific bearer setup.
  const token = session.session.token;

  return NextResponse.json({ token });
}
