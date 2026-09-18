// Splits the board source into a public page (no private data) + a server-side prep dataset.
// Usage: node scripts/split-board.js
// Input : scripts/board-source.html (the claude.ai artifact, as published)
// Output: public/index.html (public build, with prep-mode loader) and lib/prep-data.json (private, served only by /api/prep)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "scripts/board-source.html"), "utf8");
const lines = src.split("\n");

const idx = (re, from = 0) => { const i = lines.findIndex((l, k) => k >= from && re.test(l)); if (i < 0) throw new Error("not found: " + re); return i; };

const qaStart = idx(/^const QA = \[/);
const pfHeader = idx(/^\/\/ ---------- Portfolio v2/);
const pfStart = idx(/^const PORTFOLIO = \[/, pfHeader);
const renderStart = idx(/^\/\/ ---------- rendering ----------/, pfStart);

// QA block: from "const QA = [" to the line before the portfolio header (ends with "];")
const qaBlock = lines.slice(qaStart, pfHeader).join("\n");
const pfConsts = lines.slice(pfHeader, pfStart).join("\n");
const pfBlock = lines.slice(pfStart, renderStart).join("\n");

// Evaluate the data with the same helpers the page defines.
const ctx = { B: (en, fr) => ({ en, fr }) };
vm.createContext(ctx);
vm.runInContext(qaBlock + "\n" + pfConsts + "\n" + pfBlock + "\nthis.__QA=QA; this.__PF=PORTFOLIO;", ctx);
const QA = ctx.__QA, PORTFOLIO = ctx.__PF;

const gaps = QA.map((it, i) => (it.gap ? { i, gap: it.gap } : null)).filter(Boolean);
const publicQA = QA.map(({ gap, ...rest }) => rest);

fs.writeFileSync(path.join(root, "lib/prep-data.json"), JSON.stringify({ gaps, portfolio: PORTFOLIO }, null, 1));

// Public page: replace the QA block and the PORTFOLIO block.
const out = [
  ...lines.slice(0, qaStart),
  "const QA = " + JSON.stringify(publicQA) + ";",
  "// Private notes (\"to decide\") and the opportunity portfolio are not in this build.",
  "// They are loaded from /api/prep after the admin password (Shift+P).",
  ...lines.slice(pfHeader, pfStart),
  "let PORTFOLIO = [];",
  "let PREP_LOADED = false;",
  ...lines.slice(renderStart),
].join("\n");

fs.writeFileSync(path.join(root, "public/index.html"), out);

// Safety check: nothing private left in the public page.
const leaks = [];
for (const g of gaps) if (out.includes(g.gap.en.slice(0, 40))) leaks.push("gap: " + g.gap.en.slice(0, 40));
for (const p of PORTFOLIO) if (out.includes(p.title)) leaks.push("portfolio: " + p.title);
if (leaks.length) { console.error("LEAK CHECK FAILED:\n" + leaks.join("\n")); process.exit(1); }
console.log(`ok — QA items: ${QA.length}, private notes: ${gaps.length}, portfolio sheets: ${PORTFOLIO.length}`);
console.log(`public/index.html: ${(out.length / 1024).toFixed(0)} KB · lib/prep-data.json: ${(fs.statSync(path.join(root, "lib/prep-data.json")).size / 1024).toFixed(0)} KB`);
