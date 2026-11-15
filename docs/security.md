# Security notes

- Only https://github.com/owner/repo URLs are accepted; owner and name are validated.
- Repo code is never run: no install, build or workflow execution. Git hooks are disabled; scanners get argument lists, never shell strings.
- Secrets are masked before storage, display, reports and AI requests; repo text is sanitised against prompt injection.
- GitHub tokens go to git through environment variables, live in memory only, and are scrubbed from error messages.
- Every audit, finding and report is owner-checked in the API, plus row-level security in Supabase.
- Known gap: GitHub OAuth `repo` scope is broad; a read-only GitHub App is the safer production option.
- Set ALLOWED_ORIGINS to your frontend origin, and use a public-repos-only GITHUB_TOKEN on the server.
- Chat and explanations send only masked, sanitised scan results to the AI. Ids and references not found in the scan are removed from answers.
- Gitleaks and pattern results are masked before they leave the scanner; documentation example keys are ignored and test-file matches are downgraded.
- Run `bash scripts/check-secrets.sh` before pushing. Never put the Supabase service key, the AI key or a GitHub secret in a `VITE_` variable.
- Server errors return a readable message with CORS headers and log the details on the server.
