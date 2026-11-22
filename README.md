# CodePreflight — Know Before You Ship

A preflight check for GitHub projects. Paste a repository link and CodePreflight looks for leaked keys, tools with known security holes, unsafe settings and missing basics. It shows the proof for every finding, explains it in plain words, helps you fix it, and checks again to prove the fix worked.

Built by Team Limitless Arise for CodeSprint 2026.

## What you can do
- **Check any public repo** in seconds, or your own private repos after signing in with GitHub (one button signs in and registers).
- **Read results two ways:** a Simple view with a traffic-light verdict and "fix these first" cards, or a Technical view with every finding, rule and piece of evidence.
- **Ask the AI** questions about a finished scan from the chat bubble. It only sees the scan's results.
- **Check again** and see what was fixed, what is still open and what is new.
- **Download** the report as PDF, Markdown, JSON or SARIF.
- **Learn** the words: a searchable glossary and a health checklist.

## Pages
`/` Home · `/scan` Scan · `/report` Report · `/history` History · `/how-it-works` · `/learn` · `/about`

## The checkers
| Checker | Finds |
|---|---|
| Trivy | Secrets, vulnerable packages, unsafe settings in files |
| Gitleaks | Secrets in the last 100 commits of Git history (built-in pattern scan is the fallback) |
| OSV | Known holes for pinned dependency versions (`requirements.txt`, `package-lock.json`, also in subfolders) |
| OpenSSF Scorecard | Project security practices (public repos with a stored Scorecard result) |
| Custom rules | README, licence, tests, CI, `.gitignore`, lockfile |

Failed or missing checkers are reported as `failed` or `unknown`, never as clean. Your code is read, never run.

## Two scan modes
- **Full scan (backend):** everything above, AI explanations, chat, history in your account, private repos.
- **Lite scan (in your browser):** repository checks, OSV and Scorecard through their public APIs. No backend or keys needed. If the backend is unreachable the site falls back to Lite and says so.

## Project layout
```
frontend/   React + TypeScript + Vite + Tailwind
  src/pages/        Home, Scan, Report, History, HowItWorks, Learn, About, NotFound
  src/              router, state, Layout, ui (mascot, slideshow), Chat, lite scan engine, exporters
backend/    FastAPI (main.py) · core.py rules and scoring · scanners.py · ai.py · reports.py · pdf.py · schema.sql · tests/
docs/       architecture, api, scoring, security, deploy, demo-script
scripts/    check-secrets.sh
```

## Run it locally
1. **Lite scan, no keys:** `cd frontend && npm install && npm run dev`, open http://localhost:5173.
2. **GitHub login:** create a GitHub OAuth App (callback `https://YOUR-PROJECT.supabase.co/auth/v1/callback`), enable GitHub under Supabase Authentication > Providers, add `http://localhost:5173` to Authentication > URL Configuration > Redirect URLs.
3. **One env file:** `cp .env.example .env` at the project root. The backend, the frontend (`VITE_` values only) and Docker all read it.
4. **Full scan:** run `backend/schema.sql` in the Supabase SQL editor, then `cd backend && pip install -r requirements.txt && uvicorn main:app --reload` and set `VITE_API_URL=http://localhost:8000`. Trivy and Gitleaks must be installed locally for those rows to run, otherwise they show as unknown.
5. **Everything in Docker:** `docker compose up --build`, then open http://localhost:8080.

Going live: see [docs/deploy.md](docs/deploy.md). Presenting it: see [docs/demo-script.md](docs/demo-script.md).

## Environment variables (root `.env`)
| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | backend | Database access. The service key is a backend-only secret. |
| `ALLOWED_ORIGINS` | backend | Browser origins allowed to call the API |
| `GITHUB_TOKEN` | backend | Optional, public-repos-only token for rate limits |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | backend | AI explainer and chat (Adaption, or any OpenAI-compatible API) |
| `MAX_REPO_MB`, `RATE_LIMIT_PER_HOUR`, `CHAT_LIMIT_PER_HOUR`, `FORWARDED_ALLOW_IPS` | backend | Limits and proxy settings |
| `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend | Public values baked into the build (anon key only) |

## Tests
`python -m pytest -q backend/tests` (needs only pytest). The CI workflow also builds the frontend. Run `bash scripts/check-secrets.sh` before pushing.

## Known limitations
| Limitation | Handling |
|---|---|
| Scanners miss things, and some report false alarms | Several checkers, a coverage list, confidence on every finding, and accepting a risk needs a logged reason |
| Missing lockfiles | Dependency checks are marked unknown, never pass |
| Git history beyond the last 100 commits, binaries, runtime behaviour | Listed as not covered |
| Very large repositories | Skipped above `MAX_REPO_MB` (default 200) |
| AI can be wrong | It only explains scanner findings, invented references are removed, versions it adds are flagged |
| GitHub OAuth `repo` scope is broad | Requested only when you press Enable private repos. A read-only GitHub App is the safer option for production |
| Scorecard has no result for many small repos | Shown as unknown |

Findings need human review. A clean report is not a guarantee of safety.

## Roadmap (not built yet)
Pull-request checks, SBOM export, scheduled scans, README badge, scanning older Git history and binaries.

## Team
Aditya Uniyal · Aditya Singh · Prince Bisht · Akshat Arya · Harshit Gupta

## PR change integrity (new)

Open **Analyse PR** (`/pr`) and paste a GitHub pull request link. CodePreflight checks whether the change weakens the tests, CI, security controls, permissions or agent instructions that are supposed to validate it, then reports PASS / REVIEW / BLOCK with evidence. The older repository scan stays available as **Repo scan**.

- Deterministic static rules; no model decides a verdict; the pull request is read, never run.
- Advisory only: it does not block merges on GitHub.
- Details, rules and limitations: `docs/pr-integrity.md`. Try `GET /api/v2/demo/unsafe` for a labelled synthetic example.
