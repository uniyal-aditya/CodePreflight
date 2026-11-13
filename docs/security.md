# Security notes

- Only https://github.com/owner/repo URLs are accepted; owner and name are validated.
- Repo code is never run: no install, build or workflow execution. Git hooks are disabled; scanners get argument lists, never shell strings.
- Secrets are masked before storage, display, reports and AI requests; repo text is sanitised against prompt injection.
- GitHub tokens go to git through environment variables, live in memory only, and are scrubbed from error messages.
- Every audit, finding and report is owner-checked in the API, plus row-level security in Supabase.
- Known gap: GitHub OAuth `repo` scope is broad; a read-only GitHub App is the safer production option.
- Set ALLOWED_ORIGINS to your frontend origin, and use a public-repos-only GITHUB_TOKEN on the server.
