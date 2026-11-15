# Architecture

Lite mode: Browser (React) -> GitHub, OSV and OpenSSF Scorecard public APIs. No backend.
Full mode: Browser -> FastAPI -> GitHub API (pin the commit SHA) -> shallow clone, last 100 commits, in a temp folder (never executed)
-> checkers: Trivy, Gitleaks (pattern scan fallback), OSV, OpenSSF Scorecard (public repos), custom rules
-> findings in one shape (secrets masked, repo text sanitised, stable fingerprint) -> scoring -> Supabase Postgres
-> reports (JSON, SARIF, Markdown, PDF), AI explanations and repository chat.

Rules: the checkers are the source of truth and the AI only explains. Repository content is untrusted input.
Failed or missing checkers are reported as failed or unknown, never as clean.

| Module | File |
|---|---|
| API, auth, rate limits, orchestration, chat endpoint | backend/main.py |
| Rules, scoring, masking, URL validation, fix advice | backend/core.py |
| Trivy, Gitleaks, OSV, Scorecard, Git-history patterns | backend/scanners.py |
| AI explainer and chat (grounded, guarded, with fallback) | backend/ai.py |
| Reports and PDF | backend/reports.py, backend/pdf.py |
| Database schema and row-level security | backend/schema.sql |
| Pages, shared state, router, Lite scan engine, exporters | frontend/src |
