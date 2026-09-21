// Optional email notifications through Resend (https://resend.com).
// Active only when RESEND_API_KEY and NOTIFY_TO are set on Vercel; otherwise a silent no-op.
// NOTIFY_FROM is optional (needs a verified domain in Resend); the default sender only delivers to the Resend account's own address.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function notify(subject, lines) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_TO;
  if (!key || !to) return false;
  const from = process.env.NOTIFY_FROM || "Creative Export Engine <onboarding@resend.dev>";
  const base = process.env.SITE_URL || "https://creativemodel.vercel.app";
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1826">` +
    lines.map(([k, v]) => v ? `<p style="margin:0 0 8px"><b>${esc(k)}</b><br>${esc(v).replace(/\n/g, "<br>")}</p>` : "").join("") +
    `<p style="margin:16px 0 0;color:#6B8194">Admin: <a href="${base}/admin.html">${base}/admin.html</a></p></div>`;
  const text = lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nAdmin: ${base}/admin.html`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(/[,;]\s*/), subject: "[CEE] " + subject, html, text }),
    });
    if (!r.ok) console.error("notify: resend " + r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("notify: error", e); return false; }
}
