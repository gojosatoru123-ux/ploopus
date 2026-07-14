// app/api/auth/get-desktop-github-token/route.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await auth.api.getAccessToken({
    body: { providerId: "github" },
    headers: await headers(),
  });

  if (!result?.accessToken) {
    return NextResponse.json({ error: "github not linked" }, { status: 404 });
  }

  return NextResponse.json({ token: result.accessToken });
}
