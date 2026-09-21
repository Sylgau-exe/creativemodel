# Rebuilding the public page from the claude.ai board

1. Download the current board HTML from the artifact (https://claude.ai/artifact/VABmSSFTRSB6sd2G4sc2ZB) to `scripts/board-source.html`.
2. `node scripts/split-board.cjs` → writes `public/index.html` (public build, no private data) and `lib/prep-data.json` (private, served by /api/prep only).
3. `python3 scripts/patch-public.py` → adds the prep-mode password loader, the feedback panel and the visit ping to `public/index.html`.
4. `npm test` → runs the local checks (gate, log, feedback, prep lock, leak check).

`scripts/board-source.html` contains the private data — it is git-ignored. Only `lib/prep-data.json` (read server-side) carries it in the repo, and the repo is private.
