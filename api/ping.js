// POST /api/ping — called once per page load by a signed-in visitor; records a visit.
import { sql, ensureSchema } from "../lib/db.js";
import { json, clientIp, visitor, clip } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const v = await visitor(req);
  if (!v) return json(res, 401, { error: "session" });
  try {
    await ensureSchema();
    const q = sql();
    await q`INSERT INTO visits (email, kind, user_agent, ip) VALUES (${v.e}, 'page', ${clip(req.headers["user-agent"], 300)}, ${clientIp(req)})`;
    await q`UPDATE visitors SET last_seen = now(), visits = visits + 1 WHERE lower(email) = lower(${v.e})`;
  } catch (e) {
    console.error("ping: db error", e);
  }
  return json(res, 200, { ok: true, name: v.n });
}
