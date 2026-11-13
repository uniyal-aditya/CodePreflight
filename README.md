# CodePreflight — Know Before You Ship

AI-assisted GitHub repository auditing and release-readiness. Evidence-backed findings, a transparent score, and a rescan that proves your fixes worked.
Built by Team Limitless Arise for CodeSprint 2026.

## How it works
1. Connect a GitHub URL (sign in with GitHub for private repos).
2. The API pins the audit to a commit SHA and statically inspects a shallow copy. Nothing from the repo is executed.
3. Trivy, OSV, OpenSSF Scorecard and custom rules produce findings.
4. Findings are normalised, masked and scored.
5. The AI explains verified findings only. Guards reject invented versions or line numbers.
6. Fix, rescan, compare, export (JSON, SARIF, Markdown, PDF). Signed-in users also get a scan history page.

## Structure
```
frontend/   React + TypeScript + Vite + Tailwind + TanStack Query (src/App.tsx, src/lib.ts)
frontend-vanilla/   the earlier plain HTML/CSS/JS version (optional, can be deleted)
backend/    main.py (API) core.py (rules, score) scanners.py ai.py reports.py pdf.py schema.sql tests/
```

## Run it (all steps, in order)
1. **Quick start, no keys (Lite scan):** `cd frontend && npm install && npm run dev`, open http://localhost:5173, paste a public GitHub URL. It runs in the browser against the GitHub, OSV and OpenSSF Scorecard APIs. Trivy and the Git-history scan show as "needs backend".
2. **GitHub login (Supabase):** create a GitHub OAuth App (callback `https://YOUR-PROJECT.supabase.co/auth/v1/callback`); in Supabase enable Authentication > Providers > GitHub and add `http://localhost:5173` (and your domain) under URL Configuration > Redirect URLs. The single **Continue with GitHub** button signs in or registers.
3. **Env:** `cp .env.example .env` at the project root (the only env file). Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for login. Restart `npm run dev`.
4. **Repo picker:** after login a dropdown lists your repos next to the URL field (public by default; **Enable private repos** adds private ones and lets the Lite scan read them).
5. **Full scan (optional):** run `backend/schema.sql` in Supabase, fill the backend values and `AI_API_KEY` in `.env`, then `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`, and set `VITE_API_URL=http://localhost:8000`. Or `docker compose up --build` (http://localhost:8080).
6. **Go live on your .xyz domain:** follow `docs/deploy.md`.

## Known limitations
| Limitation | Handling |
|---|---|
| Scanners miss things | Several engines, plus a coverage panel |
| False positives | Confidence, masked evidence, accept-risk needs a reason |
| Missing lockfiles | Marked unknown, never pass |
| Secrets in Git history | Last 100 commits scanned by pattern (medium confidence); older history listed as not covered |
| Binaries, runtime behaviour | Reported as not covered |
| Private repos and Scorecard | Scorecard is skipped for private repos |
| GitHub OAuth `repo` scope is broad | Planned: GitHub App with read-only permissions |

Findings need human review. A clean report is not a guarantee of safety.
