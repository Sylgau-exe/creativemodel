// End-to-end checks against the local stand-in server and a local Postgres (TEST_PG_URL).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.TEST_PG_URL ??= "postgres://test@localhost:5499/cee?host=/var/tmp/ceepg";
process.env.ACCESS_CODE ??= "ENGINE26";
process.env.ADMIN_PASSWORD ??= "admin-test-pw";
process.env.SESSION_SECRET ??= "0123456789abcdef0123456789abcdef";

const { start } = await import("./server.js");
let base, server;
const cookies = {};
const jar = (name) => Object.entries(cookies).map(([k, v]) => k + "=" + v).join("; ");
function keep(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); cookies[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } }
const post = async (path, body, withCookies = true) => { const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(withCookies ? { cookie: jar() } : {}) }, body: JSON.stringify(body), redirect: "manual" }); keep(r); return r; };
const get = async (path, withCookies = true) => { const r = await fetch(base + path, { headers: withCookies ? { cookie: jar() } : {}, redirect: "manual" }); keep(r); return r; };

before(async () => {
  ({ server, url: base } = await start());
  const { sql, ensureSchema } = await import("../lib/db.js");
  await ensureSchema();
  const q = sql();
  await q`DELETE FROM feedback`; await q`DELETE FROM visits`; await q`DELETE FROM visitors`; await q`DELETE FROM opportunities`;
});
after(() => server.close());

test("public page contains no private data and no prep auto-unlock", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const prep = JSON.parse(readFileSync(new URL("../lib/prep-data.json", import.meta.url), "utf8"));
  assert.equal(prep.portfolio.length, 10);
  assert.equal(prep.gaps.length, 12);
  for (const p of prep.portfolio) assert.ok(!html.includes(p.title), "portfolio title leaked: " + p.title);
  for (const g of prep.gaps) assert.ok(!html.includes(g.gap.en.slice(0, 30)), "gap note leaked");
  assert.ok(!html.includes('location.hash==="#prep"'), "#prep hash unlock must be gone");
  assert.ok(html.includes("/api/prep"), "prep loader present");
  assert.ok(html.includes("/api/feedback"), "feedback panel present");
  assert.ok(html.includes("/opportunity.html"), "Propose a project button present");
  assert.ok(html.includes("snapState"), "snapshot page present (board v13+)");
});

test("project form is gated and the gate keeps ?next=", async () => {
  const r = await get("/opportunity.html", false);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/gate.html?next=%2Fopportunity.html");
  const r2 = await post("/api/opportunity", { title: "x", description: "y" }, false);
  assert.equal(r2.status, 401);
});

test("model is gated: no cookie → redirect to gate", async () => {
  const r = await get("/", false);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/gate.html");
  const r2 = await get("/index.html", false);
  assert.equal(r2.status, 302);
  const g = await get("/gate.html", false);
  assert.equal(g.status, 200);
});

test("gate rejects a wrong code and bad fields", async () => {
  let r = await post("/api/enter", { name: "Ada", email: "ada@example.com", code: "WRONG" });
  assert.equal(r.status, 401);
  r = await post("/api/enter", { name: "", email: "nope", code: "ENGINE26" });
  assert.equal(r.status, 400);
  assert.ok(!cookies.cee_session, "no session cookie yet");
});

test("gate accepts the code (case-insensitive), logs the visitor, sets the session", async () => {
  const r = await post("/api/enter", { name: "Ada Lovelace", email: "Ada@Example.com", organization: "Analytical Engines", code: " engine26 ", lang: "fr" });
  assert.equal(r.status, 200);
  assert.ok(cookies.cee_session, "session cookie set");
  const page = await get("/");
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Creative Export Engine"));
});

test("ping records a page open and returns the name; a second sign-in does not duplicate the visitor", async () => {
  let r = await post("/api/ping", {});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).name, "Ada Lovelace");
  await post("/api/ping", {});
  await post("/api/enter", { name: "Ada L.", email: "ada@example.com", code: "ENGINE26" });
  await post("/api/ping", {});
  const { sql } = await import("../lib/db.js");
  const rows = await sql()`SELECT name, organization, visits FROM visitors`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ada L.");
  assert.equal(rows[0].organization, "Analytical Engines", "organization kept when omitted later");
  assert.equal(rows[0].visits, 3);
});

test("feedback requires a session and is stored with the visitor", async () => {
  let r = await post("/api/feedback", { rating: 4, strongest: "The reserve logic." }, false);
  assert.equal(r.status, 401);
  r = await post("/api/feedback", { rating: 9, strongest: "" });
  assert.equal(r.status, 400, "empty feedback with invalid rating rejected");
  r = await post("/api/feedback", { rating: 4, strongest: "The reserve logic.", weakest: "Office costs", missing: "", lang: "fr", context: "reserve" });
  assert.equal(r.status, 200);
});

test("project sheet is stored with the visitor and listed for the admin", async () => {
  let r = await post("/api/opportunity", { title: "", description: "" });
  assert.equal(r.status, 400);
  r = await post("/api/opportunity", { title: "Big-top × series", description: "One story world, two products.", sector: "live", stage: "discussion", mode: "push", ip: "royalty", needs: ["advance", "capital", "bogus"], size: "$66M", lang: "fr", contact_ok: true });
  assert.equal(r.status, 200);
  const page = await get("/opportunity.html");
  assert.equal(page.status, 200);
});

test("prep data needs the admin password; then the cookie alone works", async () => {
  let r = await post("/api/prep", {}, false);
  assert.equal(r.status, 401, "no visitor session");
  r = await post("/api/prep", {});
  assert.equal(r.status, 401, "visitor without admin");
  r = await post("/api/prep", { password: "nope" });
  assert.equal(r.status, 401);
  r = await post("/api/prep", { password: "admin-test-pw" });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.portfolio.length, 10);
  assert.ok(cookies.cee_admin);
  r = await post("/api/prep", {});
  assert.equal(r.status, 200, "admin cookie suffices");
});

test("admin page data and CSV", async () => {
  delete cookies.cee_admin;
  let r = await get("/api/admin");
  assert.equal(r.status, 401);
  r = await post("/api/admin", { password: "admin-test-pw" });
  assert.equal(r.status, 200);
  r = await get("/api/admin");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.visitors.length, 1);
  assert.equal(d.feedback.length, 1);
  assert.equal(d.feedback[0].rating, 4);
  assert.equal(d.feedback[0].email, "ada@example.com");
  assert.ok(d.visits.length >= 4);
  r = await get("/api/admin?csv=feedback");
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.ok(text.includes("The reserve logic."));
  assert.ok(text.replace(/^\uFEFF/, "").startsWith("at,name,email"));
});

test("admin lists projects and exports them as CSV", async () => {
  const r = await get("/api/admin");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.opportunities.length, 1);
  assert.equal(d.opportunities[0].title, "Big-top × series");
  assert.equal(d.opportunities[0].needs, "advance,capital");
  assert.equal(d.opportunities[0].email, "ada@example.com");
  const c = await get("/api/admin?csv=opportunities");
  assert.equal(c.status, 200);
  assert.match(await c.text(), /Big-top/);
});

test("tampered session cookie is rejected", async () => {
  const saved = cookies.cee_session;
  cookies.cee_session = saved.slice(0, -3) + "AAA";
  const r = await get("/");
  assert.equal(r.status, 302);
  cookies.cee_session = saved;
});
