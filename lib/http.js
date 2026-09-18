// Small helpers shared by the API routes (Vercel Node runtime).
import { verify, readCookie, VISITOR_COOKIE, ADMIN_COOKIE } from "./auth.js";

export function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function clientIp(req) {
  const h = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "";
  return String(h).split(",")[0].trim().slice(0, 64) || null;
}

export function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short (16+ characters)");
  return s;
}

export async function visitor(req) {
  const p = await verify(readCookie(req.headers.cookie, VISITOR_COOKIE), secret());
  return p && p.e ? p : null;
}

export async function admin(req) {
  const p = await verify(readCookie(req.headers.cookie, ADMIN_COOKIE), secret());
  return p && p.a === 1 ? p : null;
}

export const clip = (s, n) => (s == null ? null : String(s).slice(0, n));
