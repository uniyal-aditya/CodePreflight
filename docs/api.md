# API (all routes under /api/v1, JSON, Bearer token = Supabase session)

| Method | Route | Purpose |
|---|---|---|
| POST | /audits | Start an audit `{repository_url, branch?}`; returns `audit_id` |
| GET | /audits/{id} | Status, coverage, findings |
| GET | /audits/compare?old=&new= | Resolved, persistent and new counts (matched by fingerprint) |
| GET | /audits/{id}/report?format=json\|sarif\|md\|pdf | Export |
| GET | /history | The signed-in user's audits |
| POST | /ai/explain | `{finding_ids}` (max 5), grounded explanations |
| POST | /audits/{id}/chat | `{messages}` (last 6 used): questions about one finished scan. The AI sees only that scan's masked results. Limit `CHAT_LIMIT_PER_HOUR` |
| POST | /findings/{id}/accept | Accept a risk `{reason}` (logged) |

Headers: `Authorization: Bearer <supabase access token>`, optional `X-GitHub-Token` (private repos, used per request, never stored).
