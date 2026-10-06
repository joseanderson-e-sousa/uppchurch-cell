import { NextResponse, type NextRequest } from "next/server";

// Do not consume a one-time token on GET: email scanners often follow links.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const valid = request.nextUrl.searchParams.get("type") === "invite" && token && /^[A-Za-z0-9_-]{20,512}$/.test(token);
  const response = NextResponse.redirect(new URL(valid ? "/auth/convite" : "/auth/convite?erro=convite", request.url));
  response.cookies.set("uppchurch_invite", valid ? token : "", {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax",
    path: "/auth", maxAge: valid ? 600 : 0,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
