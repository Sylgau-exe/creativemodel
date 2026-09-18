// POST /api/prep  { password? } — returns the private prep data (to-decide notes + opportunity portfolio).
// Requires the admin password, or a still-valid admin cookie from an earlier unlock. Visitor session required too.
import { sign, cookieHeader, safeEqual, ADMIN_COOKIE, ADMIN_TTL_MS } from "../lib/auth.js";
import { json, readBody, visitor, admin, secret } from "../lib/http.js";

import PREP from "../lib/prep-data.json" with { type: "json" };
let cached = null;
const prepData = () => (cached ??= JSON.stringify(PREP));

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!(await visitor(req))) return json(res, 401, { error: "session" });
  const headers = {};
  if (!(await admin(req))) {
    const b = await readBody(req);
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) return json(res, 500, { error: "server_config" });
    if (!b.password || !safeEqual(String(b.password), pw)) {
      await new Promise((r) => setTimeout(r, 600));
      return json(res, 401, { error: "password" });
    }
    headers["Set-Cookie"] = cookieHeader(ADMIN_COOKIE, await sign({ a: 1, exp: Date.now() + ADMIN_TTL_MS }, secret()), ADMIN_TTL_MS / 1000);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(prepData());
}
