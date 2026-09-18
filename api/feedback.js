// POST /api/feedback  { rating?, strongest?, weakest?, missing?, lang?, context? } — from a signed-in visitor.
import { sql, ensureSchema } from "../lib/db.js";
import { json, readBody, visitor, clip } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const v = await visitor(req);
  if (!v) return json(res, 401, { error: "session" });
  const b = await readBody(req);
  const rating = Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 ? b.rating : null;
  const strongest = clip((b.strongest || "").trim(), 4000) || null;
  const weakest = clip((b.weakest || "").trim(), 4000) || null;
  const missing = clip((b.missing || "").trim(), 4000) || null;
  if (!rating && !strongest && !weakest && !missing) return json(res, 400, { error: "empty" });
  try {
    await ensureSchema();
    await sql()`INSERT INTO feedback (name, email, rating, strongest, weakest, missing, lang, context)
                VALUES (${v.n}, ${v.e}, ${rating}, ${strongest}, ${weakest}, ${missing}, ${b.lang === "fr" ? "fr" : "en"}, ${clip(b.context, 40)})`;
  } catch (e) {
    console.error("feedback: db error", e);
    return json(res, 500, { error: "db" });
  }
  return json(res, 200, { ok: true });
}
