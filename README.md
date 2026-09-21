# Creative Export Engine — private preview

The interactive model (Prezi-style board, guided tour, Q&A, EN/FR) shared with reviewers behind an access code, with a visitor log, a feedback box and an admin page.

## How it works

| URL | What | Who |
|---|---|---|
| `/` | The model. Served only with a valid session cookie; otherwise redirects to the gate. | Reviewers |
| `/gate.html` | Name, email, organization (optional) + the shared access code. Sets a 30-day signed cookie and logs the visitor. | Reviewers |
| **Snapshot** (opens first) | The model on one linear page: who it is for, the problem, the three pieces, the money loop, the one condition, example projects, owner, risks. Buttons into the tour, the board and the Q&A. | Reviewers |
| **Your thoughts** button on the model | Rating /5 + three short questions, saved with the reviewer's name and email. | Reviewers |
| **Propose a project** → `/opportunity.html` | A first look at an export opportunity (~10 fields, EN/FR). Gated by the same code (the gate honours `?next=`). Listed on the admin page with CSV. | Reviewers |
| **Shift+P** on the model | Prep mode (stakeholder lens, "to decide" notes, opportunity portfolio). Asks for the admin password; the private data is fetched from `/api/prep` and is **not** in the page source. | Sylvain |
| `/admin.html` | Who signed in, how often, recent activity, all feedback, CSV downloads. Admin password. | Sylvain |

Stack: static HTML + Vercel serverless functions (`api/`) + Vercel Edge Middleware (`middleware.js`) + Neon Postgres. Tables are created automatically on first use.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (set automatically when you add the Neon integration from the Vercel Storage tab) |
| `ACCESS_CODE` | The code you give reviewers, e.g. `ENGINE26` (case-insensitive) |
| `ADMIN_PASSWORD` | Unlocks `/admin.html` and prep mode |
| `SESSION_SECRET` | 32+ random characters; signs the cookies. Changing it signs everyone out. |
| `RESEND_API_KEY` (optional) | Resend API key. With `NOTIFY_TO`, the site emails you on every new reviewer sign-in, every comment and every project sheet (`[CEE]` subject, link to the admin page). |
| `NOTIFY_TO` (optional) | Where the notifications go (comma-separated allowed). |
| `NOTIFY_FROM` (optional) | Sender, e.g. `Creative Export Engine <hello@yourdomain.ca>` — needs a verified domain in Resend. The default `onboarding@resend.dev` only delivers to the Resend account's own address. |

## Updating the model

When the board changes on claude.ai, download its HTML to `scripts/board-source.html` (git-ignored) and run `npm run build:page`. See `scripts/README.md`. Then commit `public/index.html` and `lib/prep-data.json`.

## Versions

- 1.0.0 — gate, visitor log, feedback, prep mode, admin (board v12).
- 1.3.1 (2026-09-21, later) — board v14: "Why a new mechanism" opener, "Why not EDC?" comparison, sector-by-sector table, loan-not-equity wording.
- 1.3.0 (2026-09-21) — board v13 (Snapshot front page, office → Conseil order, "Who would own it", example projects); `/opportunity.html` project form + admin listing/CSV; optional email notifications (Resend). `scripts/split-board.js` renamed `.cjs` so it runs under `"type": "module"`.

## Local checks

`npm test` runs the end-to-end suite against a local Postgres (`TEST_PG_URL`). `node test/server.js` serves the site locally on port 3456 with the same env vars as production.
