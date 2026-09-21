// POST /api/admin { password }  → sets the admin cookie
// GET  /api/admin                → visitors, visits, feedback (admin cookie required)
// GET  /api/admin?csv=visitors|feedback|opportunities → CSV download
import { sign, cookieHeader, safeEqual, ADMIN_COOKIE, ADMIN_TTL_MS } from "../lib/auth.js";
import { sql, ensureSchema } from "../lib/db.js";
import { json, readBody, admin, secret } from "../lib/http.js";

function csv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => { const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const b = await readBody(req);
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) return json(res, 500, { error: "server_config" });
    if (!b.password || !safeEqual(String(b.password), pw)) {
      await new Promise((r) => setTimeout(r, 600));
      return json(res, 401, { error: "password" });
    }
    const token = await sign({ a: 1, exp: Date.now() + ADMIN_TTL_MS }, secret());
    return json(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(ADMIN_COOKIE, token, ADMIN_TTL_MS / 1000) });
  }
  if (req.method !== "GET") return json(res, 405, { error: "method" });
  if (!(await admin(req))) return json(res, 401, { error: "admin" });

  try {
    await ensureSchema();
    const q = sql();
    const url = new URL(req.url, "http://x");
    const which = url.searchParams.get("csv");
    if (which === "visitors" || which === "feedback" || which === "opportunities") {
      const rows = which === "visitors"
        ? await q`SELECT name, email, organization, lang, visits, first_seen, last_seen FROM visitors ORDER BY last_seen DESC`
        : which === "feedback"
        ? await q`SELECT at, name, email, rating, strongest, weakest, missing, lang, context FROM feedback ORDER BY at DESC`
        : await q`SELECT at, name, email, company, role, title, sector, stage, mode, description, customer, size, timing, ip, needs, more, phone, contact_ok, lang FROM opportunities ORDER BY at DESC`;
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${which}.csv"`);
      res.setHeader("Cache-Control", "no-store");
      return res.end("﻿" + csv(rows));
    }
    const visitors = await q`SELECT id, name, email, organization, lang, visits, first_seen, last_seen FROM visitors ORDER BY last_seen DESC`;
    const visits = await q`SELECT email, at, kind FROM visits ORDER BY at DESC LIMIT 500`;
    const feedback = await q`SELECT id, at, name, email, rating, strongest, weakest, missing, lang, context FROM feedback ORDER BY at DESC`;
    const opportunities = await q`SELECT id, at, name, email, company, role, title, sector, stage, mode, description, customer, size, timing, ip, needs, more, phone, contact_ok, lang FROM opportunities ORDER BY at DESC`;
    return json(res, 200, { visitors, visits, feedback, opportunities });
  } catch (e) {
    console.error("admin: db error", e);
    return json(res, 500, { error: "db" });
  }
}
