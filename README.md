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

## Run it
**Quick start, no keys needed (Lite scan):** `cd frontend && npm install && npm run dev`, open http://localhost:5173 and paste a public GitHub URL. Lite mode runs in the browser against the public GitHub, OSV and OpenSSF Scorecard APIs (real data; GitHub allows 60 requests per hour without a token). Trivy and the Git-history secret scan are listed as "needs backend", never as clean. History is kept in your browser.

**Full scan (backend):**
1. Run `backend/schema.sql` in the Supabase SQL editor.
2. `cp .env.example .env` at the project root and fill it in. This is the only env file: the backend, the frontend (`VITE_` values only) and Docker all read it. For AI, put a Groq key in `AI_API_KEY` (or point `AI_BASE_URL` and `AI_MODEL` at any OpenAI-compatible API).
3. GitHub sign-in / sign-up (Supabase Auth): in GitHub, Settings > Developer settings > OAuth Apps, create an app with callback URL `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. In Supabase, Authentication > Providers > GitHub: enable it and paste the client ID and secret. Under Authentication > URL Configuration, add `http://localhost:5173` (and your deployed URL) to the redirect URLs. The single "Continue with GitHub" button both signs in and registers: the first sign-in creates the account. Sign-in asks only for `read:user user:email`; the "Enable private repos" button re-authorises with `repo` access when needed.
4. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
5. Frontend as above. Setting `VITE_API_URL` switches the UI from Lite to Full.
6. Or everything in Docker: `docker compose up --build`, then open http://localhost:8080

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
