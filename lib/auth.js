// Signed cookies (HMAC-SHA256) — works in Vercel Edge middleware and in Node functions.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function key(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return body + "." + b64u(mac);
}

export async function verify(token, secret) {
  if (!token || typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await key(secret), unb64u(mac), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { return null; }
  if (!payload || (payload.exp && Date.now() > payload.exp)) return null;
  return payload;
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export const VISITOR_COOKIE = "cee_session";
export const ADMIN_COOKIE = "cee_admin";
export const VISITOR_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
export const ADMIN_TTL_MS = 12 * 3600 * 1000;        // 12 hours

export function cookieHeader(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

// Constant-time-ish comparison for short secrets.
export function safeEqual(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function normCode(s) { return String(s ?? "").trim().toUpperCase(); }
