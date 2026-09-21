// POST /api/opportunity — a project sheet ("Propose a project") from a signed-in visitor.
// A first look, not an application: ~10 short fields, stored in `opportunities`, listed on the admin page.
import { sql, ensureSchema } from "../lib/db.js";
import { json, readBody, visitor, clip } from "../lib/http.js";
import { notify } from "../lib/notify.js";

const SECTORS = ["live", "film", "game", "imm", "evt", "other"];
const STAGES = ["idea", "discussion", "live"];
const MODES = ["push", "pull", "unsure"];
const IP = ["own", "shared", "licence", "royalty", "buyout", "unclear"];
const NEEDS = ["qualify", "advance", "capital", "contract", "intro"];

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const v = await visitor(req);
  if (!v) return json(res, 401, { error: "session" });
  const b = await readBody(req);
  const pick = (val, list) => (list.includes(val) ? val : null);
  const title = clip((b.title || "").trim(), 200);
  const description = clip((b.description || "").trim(), 4000);
  if (!title || !description) return json(res, 400, { error: "fields" });
  const needs = Array.isArray(b.needs) ? b.needs.filter((n) => NEEDS.includes(n)).slice(0, 5) : [];
  const row = {
    name: v.n, email: v.e, lang: b.lang === "fr" ? "fr" : "en",
    title, company: clip((b.company || "").trim(), 200) || null, role: clip((b.role || "").trim(), 200) || null,
    sector: pick(b.sector, SECTORS), stage: pick(b.stage, STAGES), description,
    mode: pick(b.mode, MODES), customer: clip((b.customer || "").trim(), 400) || null,
    size: clip((b.size || "").trim(), 200) || null, timing: clip((b.timing || "").trim(), 200) || null,
    ip: pick(b.ip, IP), needs: needs.join(","), more: clip((b.more || "").trim(), 4000) || null,
    phone: clip((b.phone || "").trim(), 60) || null, contact_ok: b.contact_ok === false ? false : true,
  };
  try {
    await ensureSchema();
    await sql()`INSERT INTO opportunities (name, email, lang, title, company, role, sector, stage, description, mode, customer, size, timing, ip, needs, more, phone, contact_ok)
      VALUES (${row.name}, ${row.email}, ${row.lang}, ${row.title}, ${row.company}, ${row.role}, ${row.sector}, ${row.stage}, ${row.description}, ${row.mode}, ${row.customer}, ${row.size}, ${row.timing}, ${row.ip}, ${row.needs}, ${row.more}, ${row.phone}, ${row.contact_ok})`;
  } catch (e) {
    console.error("opportunity: db error", e);
    return json(res, 500, { error: "db" });
  }
  notify(`Project proposed — ${row.title} (${row.name})`, [
    ["From", `${row.name} <${row.email}>${row.company ? " · " + row.company : ""}${row.role ? " · " + row.role : ""}`],
    ["Sector · stage · mode", [row.sector, row.stage, row.mode].filter(Boolean).join(" · ")],
    ["Description", row.description], ["Customer / market", row.customer], ["Size", row.size], ["Timing", row.timing],
    ["Where the IP sits", row.ip], ["Needs", row.needs], ["More", row.more], ["Phone", row.phone],
  ]).catch(() => {});
  return json(res, 200, { ok: true });
}
