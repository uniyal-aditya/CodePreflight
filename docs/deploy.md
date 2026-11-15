# Deploy: Vercel (frontend) + Railway (backend) + your .xyz domain

| Part | Where | Needed for |
|---|---|---|
| Frontend (`frontend/`) | Vercel | Everything |
| Backend (`backend/`, Docker) | Railway | Full scan, AI, chat, history, private repos |
| Database and login | Supabase | Login and history |

The frontend works alone as a Lite scan. Add the backend when you want the full scan.

## 1. Supabase
1. Run `backend/schema.sql` in the SQL Editor. It is safe to run again: it ends with idempotent migrations and `notify pgrst, 'reload schema'`.
2. Authentication > Providers > GitHub: enable, paste the OAuth App's client ID and secret.
3. Authentication > URL Configuration: Site URL `https://yourdomain.xyz`; Redirect URLs `https://yourdomain.xyz/**`, `https://www.yourdomain.xyz/**`, `http://localhost:5173/**`.
4. GitHub > Settings > Developer settings > OAuth Apps: Homepage URL `https://yourdomain.xyz`. The callback stays `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

## 2. Frontend on Vercel
Import the GitHub repo. Root Directory `frontend`, Framework Vite, Build `npm run build`, Output `dist`. Environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only). `frontend/vercel.json` makes URLs such as `/scan` and `/report` work on refresh. Vite reads variables at build time, so redeploy after changing them.

## 3. Backend on Railway
1. New Project > Deploy from GitHub repo. Settings > Source > Root Directory `backend` (it builds the `Dockerfile`).
2. Variables (never paste values into chat or commit them):
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS=https://yourdomain.xyz,https://www.yourdomain.xyz`, `FORWARDED_ALLOW_IPS=*`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, optional `GITHUB_TOKEN` (public-repos-only), `MAX_REPO_MB`, `RATE_LIMIT_PER_HOUR`, `CHAT_LIMIT_PER_HOUR`. Do not set `PORT`: Railway provides it.
3. Settings > Networking > Generate Domain, then open `https://<that-address>/docs`. If the API page loads, it works.
4. Custom domain `api.yourdomain.xyz`: Railway shows a CNAME and a TXT record. Both are required. Add both at gen.xyz > Manage > Manage DNS (the TXT host is `_railway-verify.api`; copy the exact values from Railway). Replace any old `api` CNAME. Keep serverless sleeping off.
5. Set `VITE_API_URL=https://api.yourdomain.xyz` on Vercel and redeploy.

## 4. Your gen.xyz domain for the frontend
Vercel > Project > Settings > Domains > add the domain, then add the records it shows (A for the main domain, CNAME for `www`) at gen.xyz DNS. Delete old A/AAAA records first. DNS can take up to about a day.

## 5. Final check
Open the site, run a scan, press Continue with GitHub, pick a repo from the dropdown, open the chat bubble, press Check again, download the PDF. Run `bash scripts/check-secrets.sh` before every push.

## If something fails
| Symptom | Likely cause |
|---|---|
| Amber note: backend not reachable, Lite scan ran | API asleep or down, `ALLOWED_ORIGINS` missing your exact origin, or a crash. DevTools > Network > the `audits` request shows which |
| "The database is missing a recent update" | Run the latest `backend/schema.sql` in Supabase |
| "The server could not sign in to its database" | Check `SUPABASE_SERVICE_KEY`. The legacy keys are being deprecated by the end of 2026: move to `sb_secret_` and upgrade `supabase-py` |
| 413 "over this server's MB scan limit" | Raise `MAX_REPO_MB` only if your plan has the memory |
| Every visitor shares one rate limit | Set `FORWARDED_ALLOW_IPS=*` on the backend |
| Sign-in redirects wrongly | The domain is missing from Supabase Redirect URLs |
| Refreshing `/report` shows 404 | `frontend/vercel.json` is missing |
| Env changes do nothing on the site | `VITE_*` values are read at build time: redeploy |
| Domain stuck "waiting for DNS" on Railway | TXT record missing or its host is wrong, a duplicate TXT record, or a restrictive CAA record |
