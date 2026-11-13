# Architecture

Lite mode: Browser (React) -> GitHub / OSV / Scorecard public APIs (no backend).
Full mode: Browser (React) -> FastAPI -> GitHub API (pin commit SHA) -> shallow clone in a temp dir (never executed)
-> scanners: Trivy, OSV, OpenSSF Scorecard, Git-history secret scan (last 100 commits), custom rules -> normalised findings (masked, fingerprinted)
-> scoring -> Supabase Postgres -> reports (JSON, SARIF, Markdown, PDF) and the AI explainer.

Rules: scanners are the source of truth; the AI only explains. Repository content is untrusted input.
Failed or missing scanners are reported as failed or unknown, never as clean.

| Module | File |
|---|---|
| API, auth, rate limit, orchestration | backend/main.py |
| Rules, scoring, masking, URL validation | backend/core.py |
| Trivy, OSV, Scorecard adapters | backend/scanners.py |
| AI explainer (OpenAI-compatible, grounded) | backend/ai.py |
| Reports and PDF | backend/reports.py, backend/pdf.py |
| Database schema and RLS | backend/schema.sql |
