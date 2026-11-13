# Deploy CodePreflight to your .xyz domain (gen.xyz)

You need **two things**. The frontend is mandatory; the backend is optional.

| Part | What it is | Where it can live |
|---|---|---|
| Frontend (`frontend/`) | Static files after `npm run build` | Vercel, Netlify, Cloudflare Pages, or any web host (cPanel, VPS) |
| Backend (`backend/`) | FastAPI + Trivy + git (needs Docker) | A host that runs Docker containers (Render, Railway, Fly.io; check their current free plans) |

**Lite scan needs only the frontend + Supabase.** The full backend adds Trivy, the Git-history scan, server-side AI and private-repo audits. Start with the frontend, add the backend if you have time.

## 1. Prepare the build
1. Fill the root `.env` (see `.env.example`). Only `VITE_*` values reach the browser.
2. Test locally: `cd frontend && npm install && npm run dev`.
3. Production build: `npm run build` creates `frontend/dist/`.

## 2. Host the frontend (pick one)
**Vercel (easiest)**: push the project to GitHub, then Vercel > Add New > Project > import it. Set Root Directory `frontend`, Framework Vite, Build `npm run build`, Output `dist`. Add the `VITE_*` values under Environment Variables, then Deploy. (Vite bakes these in at build time, so redeploy after changing them.)

**Netlify / Cloudflare Pages**: same settings (base `frontend`, build `npm run build`, publish `dist`).

**Your own web host / cPanel**: upload the *contents* of `frontend/dist/` into the web root (usually `public_html`). Nothing else is needed.

## 3. Point your gen.xyz domain at it
1. Log in at gen.xyz, click **Manage** next to your domain. Keep **Use default nameservers**, then open **Manage DNS**.
2. Add the records your host tells you to add:
   - **Vercel**: Project > Settings > Domains > add `yourdomain.xyz`. Vercel shows the exact records on the domain card: an **A** record for the apex (commonly `76.76.21.21`, but use the value on your card) and a **CNAME** for `www` (value on the card). In gen.xyz, leave *Host Name* blank for the apex record.
   - Delete any old A/AAAA records for the apex first, or verification stays stuck.
   - **Own web host**: add an **A** record to the server IP your host gives you.
3. Wait for DNS to propagate (up to about 24 hours; usually much faster). HTTPS is issued automatically on Vercel, Netlify and Cloudflare once DNS is correct.
4. Alternative: if your host gives you nameservers, you can change them in the same **Manage** page instead of adding records.

## 4. Backend (only for the full scan)
1. Create a Docker web service from the `backend/` folder (it has a `Dockerfile`). Port 8000.
2. Set its environment variables from `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GITHUB_TOKEN` (public-repos-only, optional), `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and
   `ALLOWED_ORIGINS=https://yourdomain.xyz,https://www.yourdomain.xyz`
3. Give it a subdomain: in gen.xyz DNS add a **CNAME** with host `api` pointing to the target your backend host shows, then add `api.yourdomain.xyz` as a custom domain on that host.
4. Set `VITE_API_URL=https://api.yourdomain.xyz` in the frontend host's environment variables and redeploy the frontend. It must be `https`, or browsers block it.

## 5. Supabase and GitHub login
1. GitHub > Settings > Developer settings > OAuth Apps: set **Homepage URL** to `https://yourdomain.xyz`. The **callback URL stays** `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
2. Supabase > Authentication > Providers > GitHub: enabled, client ID and secret pasted.
3. Supabase > Authentication > URL Configuration: **Site URL** `https://yourdomain.xyz`; add `https://yourdomain.xyz`, `https://www.yourdomain.xyz` and `http://localhost:5173` to **Redirect URLs**.

## 6. Final check
Open your domain, then: run a scan, click **Continue with GitHub**, pick a repo from the dropdown, rescan, export the PDF, open Scan history.

## If something fails
| Symptom | Likely cause |
|---|---|
| Sign-in redirects to the wrong place or errors | Domain missing from Supabase Redirect URLs / Site URL |
| "Failed to fetch" on scan | `VITE_API_URL` wrong, backend asleep or down, `ALLOWED_ORIGINS` missing your domain, or the API is `http` |
| Domain still shows the old page | DNS not propagated yet, or an old A/AAAA record is still set |
| Env changes do nothing | `VITE_*` are read at build time: rebuild or redeploy |
| Dropdown shows only public repos | Click **Enable private repos** (grants `repo` access; the token is kept in memory only) |
