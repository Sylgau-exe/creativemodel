# Creative Export Engine — private preview

The interactive model (Prezi-style board, guided tour, Q&A, EN/FR) shared with reviewers behind an access code, with a visitor log, a feedback box and an admin page.

## How it works

| URL | What | Who |
|---|---|---|
| `/` | The model. Served only with a valid session cookie; otherwise redirects to the gate. | Reviewers |
| `/gate.html` | Name, email, organization (optional) + the shared access code. Sets a 30-day signed cookie and logs the visitor. | Reviewers |
| **Your thoughts** button on the model | Rating /5 + three short questions, saved with the reviewer's name and email. | Reviewers |
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

## Updating the model

When the board changes on claude.ai, download its HTML to `scripts/board-source.html` (git-ignored) and run `npm run build:page`. See `scripts/README.md`. Then commit `public/index.html` and `lib/prep-data.json`.

## Local checks

`npm test` runs the end-to-end suite against a local Postgres (`TEST_PG_URL`). `node test/server.js` serves the site locally on port 3456 with the same env vars as production.
