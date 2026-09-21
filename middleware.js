// Vercel Edge Middleware: the model page is served only with a valid visitor session; otherwise the gate is shown.
import { verify, readCookie, VISITOR_COOKIE } from "./lib/auth.js";

export const config = { matcher: ["/", "/index.html", "/opportunity.html"] };

export default async function middleware(request) {
  const secret = process.env.SESSION_SECRET || "";
  const session = await verify(readCookie(request.headers.get("cookie"), VISITOR_COOKIE), secret);
  if (session && secret.length >= 16) return; // continue to the static page
  const url = new URL(request.url);
  const next = url.pathname === "/opportunity.html" ? "?next=" + encodeURIComponent(url.pathname + url.search) : url.search;
  url.pathname = "/gate.html";
  return new Response(null, { status: 302, headers: { Location: url.pathname + next, "Cache-Control": "no-store" } });
}
