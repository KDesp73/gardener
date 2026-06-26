import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "No dashboard password configured" },
      { status: 500 },
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const response = NextResponse.json({ ok: true });
  response.cookies.set("gardener-auth", hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
