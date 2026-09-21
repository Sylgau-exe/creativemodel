// POST /api/enter  { name, email, organization?, lang?, code }
// Checks the shared access code, records the visitor, sets the signed session cookie.
import { sign, cookieHeader, safeEqual, normCode, VISITOR_COOKIE, VISITOR_TTL_MS } from "../lib/auth.js";
import { sql, ensureSchema } from "../lib/db.js";
import { json, readBody, clientIp, secret, clip } from "../lib/http.js";
import { notify } from "../lib/notify.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: "bad_body" }); }

  const name = clip((body.name || "").trim(), 120);
  const email = clip((body.email || "").trim().toLowerCase(), 200);
  const organization = clip((body.organization || "").trim(), 200) || null;
  const lang = body.lang === "fr" ? "fr" : "en";
  const code = normCode(body.code);

  if (!name || !EMAIL.test(email)) return json(res, 400, { error: "fields" });
  if (!process.env.ACCESS_CODE) return json(res, 500, { error: "server_config" });
  if (!safeEqual(code, normCode(process.env.ACCESS_CODE))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return json(res, 401, { error: "code" });
  }

  const ua = clip(req.headers["user-agent"], 300);
  const ip = clientIp(req);
  try {
    await ensureSchema();
    const q = sql();
    const seen = await q`SELECT 1 FROM visitors WHERE lower(email) = ${email} LIMIT 1`;
    if (!seen.length) notify(`New reviewer — ${name}${organization ? " (" + organization + ")" : ""}`, [["Name", name], ["Email", email], ["Organization", organization], ["Language", lang]]).catch(() => {});
    await q`INSERT INTO visitors (name, email, organization, lang, user_agent, ip)
            VALUES (${name}, ${email}, ${organization}, ${lang}, ${ua}, ${ip})
            ON CONFLICT (lower(email)) DO UPDATE SET
              name = EXCLUDED.name,
              organization = COALESCE(EXCLUDED.organization, visitors.organization),
              lang = EXCLUDED.lang,
              user_agent = EXCLUDED.user_agent,
              ip = EXCLUDED.ip,
              last_seen = now()`;
    await q`INSERT INTO visits (email, kind, user_agent, ip) VALUES (${email}, 'enter', ${ua}, ${ip})`;
  } catch (e) {
    console.error("enter: db error", e);
    return json(res, 500, { error: "db" });
  }

  const token = await sign({ n: name, e: email, exp: Date.now() + VISITOR_TTL_MS }, secret());
  return json(res, 200, { ok: true, name }, { "Set-Cookie": cookieHeader(VISITOR_COOKIE, token, VISITOR_TTL_MS / 1000) });
}
