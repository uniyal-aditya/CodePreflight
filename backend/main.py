"""CodePreflight API. Run: uvicorn main:app --reload
Security: repo content is untrusted and never executed; scanners get argument lists (no shell);
secrets are masked before storage/AI; GitHub tokens live in memory only; every audit is owner-checked."""
import os, time, base64, logging, subprocess, tempfile, httpx
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client
import core, scanners, ai, reports
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # the one shared .env at the project root

app = FastAPI(title="CodePreflight")
ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    """Without this, a crash returns a 500 with no CORS headers, and the browser reports it as a generic network error."""
    logging.getLogger("codepreflight").exception("Unhandled error on %s", request.url.path)
    origin = request.headers.get("origin", "")
    return JSONResponse({"detail": f"Server error ({type(exc).__name__}). Check the backend logs."}, status_code=500, headers={"Access-Control-Allow-Origin": origin, "Vary": "Origin"} if origin in ORIGINS else {})
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
GH, HITS = "https://api.github.com", defaultdict(list)
MAX_KB = int(os.getenv("MAX_REPO_MB", "200")) * 1000  # GitHub reports repo size in KB (includes full history)

class AuditIn(BaseModel):
    repository_url: str
    branch: str | None = None
    profile: str = "standard"

class ExplainIn(BaseModel):
    finding_ids: list[str]

def hdr(tok=None):  # the server GITHUB_TOKEN must be a PUBLIC-repos-only token (rate limits only)
    t = tok or os.getenv("GITHUB_TOKEN")
    return {"Accept": "application/vnd.github+json", **({"Authorization": f"Bearer {t}"} if t else {})}

def current_user(authorization):
    if not authorization or not authorization.startswith("Bearer "): return None
    try: return db.auth.get_user(authorization[7:]).user.id
    except Exception: raise HTTPException(401, "Invalid or expired session")

def own(audit_id, uid):  # the service key bypasses RLS, so ownership is enforced here too
    a = db.table("audits").select("*").eq("id", audit_id).single().execute().data
    if a.get("user_id") and a["user_id"] != uid: raise HTTPException(404, "Audit not found")
    return a

def limit(ip, n=int(os.getenv("RATE_LIMIT_PER_HOUR", "10")), per=3600):  # audits per client IP per hour; raise it for demos
    now = time.time(); HITS[ip] = [t for t in HITS[ip] if now - t < per]
    if len(HITS[ip]) >= n: raise HTTPException(429, "Too many audits. Try again later.")
    HITS[ip].append(now)

def run_audit(audit_id, owner, name, sha, tok, private):
    cov = {}
    try:
        with httpx.Client(headers=hdr(tok), timeout=30) as c:
            tree = c.get(f"{GH}/repos/{owner}/{name}/git/trees/{sha}?recursive=1").json()
        if tree.get("truncated"): cov["tree"] = "unknown"  # partial file list is reported, not hidden
        paths = {t["path"] for t in tree.get("tree", []) if t["type"] == "blob"}
        if len(paths) > 5000: raise ValueError("Repository too large for this scan profile")
        fs, c2 = core.rules(paths); cov.update(c2)
        env = {**os.environ}
        if tok:  # token goes through the environment: never in argv, the URL, logs or the database
            b = base64.b64encode(f"x-access-token:{tok}".encode()).decode()
            env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0=f"AUTHORIZATION: basic {b}")
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "clone", "--depth", "100", f"https://github.com/{owner}/{name}.git", d], check=True, timeout=120, capture_output=True, env=env)
            t, cov["trivy"] = scanners.trivy(d)
            o, cov["osv"] = scanners.osv(d)
            h, cov["secrets-history"] = scanners.history(d)  # last 100 commits
        s, cov["scorecard"] = ([], "not covered (private repo)") if private else scanners.scorecard(owner, name)
        seen = {f["title"].split()[0] for f in t if f["category"] == "Dependencies"}  # avoid double-reporting the same package
        fs += t + [f for f in o if f["title"].split()[0] not in seen] + s + h
        uniq = {f["fingerprint"]: f for f in fs}; fs = list(uniq.values())
        for f in fs: f.update(audit_id=audit_id, status="open")
        for i in range(0, len(fs), 100): db.table("findings").insert(fs[i:i + 100]).execute()
        sc = core.score(fs); cov["_pct"] = core.coverage_pct({k: v for k, v in cov.items() if k != "_pct"})
        db.table("audits").update({"status": "completed", "score": sc["score"], "risk": sc["risk"], "coverage": cov, "completed_at": datetime.now(timezone.utc).isoformat()}).eq("id", audit_id).execute()
    except Exception as e:  # a failed scan is recorded as failed, never as clean
        msg = str(e).replace(tok, "***") if tok else str(e)
        db.table("audits").update({"status": "failed", "coverage": {"error": msg[:200]}}).eq("id", audit_id).execute()

@app.post("/api/v1/audits")
def create(a: AuditIn, bg: BackgroundTasks, request: Request, authorization: str | None = Header(None), x_github_token: str | None = Header(None)):
    limit(request.client.host)
    uid = current_user(authorization); tok = x_github_token if uid else None  # a GitHub token is only honoured for a verified user
    p = core.parse_repo_url(a.repository_url)
    if not p: raise HTTPException(400, "Only https://github.com/owner/repo URLs are accepted")
    owner, name = p
    r = httpx.get(f"{GH}/repos/{owner}/{name}", headers=hdr(tok), timeout=15)
    if r.status_code != 200: raise HTTPException(404, "Repository not found or your account has no access" if tok else "Repository not found. If it is private, sign in with GitHub first.")
    info = r.json()
    if info.get("private") and not tok: raise HTTPException(403, "Private repository: sign in with GitHub")
    if info.get("size", 0) > MAX_KB: raise HTTPException(413, f"This repository is about {info['size'] // 1000} MB, over this server's {MAX_KB // 1000} MB scan limit (the MAX_REPO_MB variable).")
    branch = a.branch or info["default_branch"]
    sha = httpx.get(f"{GH}/repos/{owner}/{name}/commits/{branch}", headers=hdr(tok), timeout=15).json()["sha"]  # pin the audit to a commit
    repo = db.table("repositories").upsert({"owner": owner, "name": name, "url": f"https://github.com/{owner}/{name}", "default_branch": branch}, on_conflict="url").execute().data[0]
    aud = db.table("audits").insert({"repository_id": repo["id"], "commit_sha": sha, "profile": a.profile, "user_id": uid, "is_private": bool(info.get("private"))}).execute().data[0]
    bg.add_task(run_audit, aud["id"], owner, name, sha, tok, bool(info.get("private")))
    return {"audit_id": aud["id"], "commit_sha": sha, "status": "queued"}

@app.get("/api/v1/audits/compare")  # declared BEFORE /{audit_id}, otherwise "compare" would be read as an id
def compare(old: str, new: str, authorization: str | None = Header(None)):
    uid = current_user(authorization); own(old, uid); own(new, uid)
    g = lambda i: {f["fingerprint"] for f in db.table("findings").select("fingerprint").eq("audit_id", i).execute().data}
    o, n = g(old), g(new)
    return {"resolved": len(o - n), "persistent": len(o & n), "new": len(n - o)}

@app.get("/api/v1/audits/{audit_id}")
def get(audit_id: str, authorization: str | None = Header(None)):
    a = own(audit_id, current_user(authorization))
    fs = db.table("findings").select("*").eq("audit_id", audit_id).execute().data
    cov = {k: v for k, v in (a.get("coverage") or {}).items() if k != "_pct"}
    return {**a, "coverage": cov, "coverage_pct": (a.get("coverage") or {}).get("_pct", 0), "findings": fs}

@app.get("/api/v1/audits/{audit_id}/report")
def report(audit_id: str, format: str = "json", authorization: str | None = Header(None)):
    d = get(audit_id, authorization); fs = d.pop("findings")
    if format == "sarif": return Response(__import__("json").dumps(reports.to_sarif(d, fs)), media_type="application/sarif+json", headers={"Content-Disposition": "attachment; filename=codepreflight.sarif"})
    if format == "pdf": return Response(reports.to_pdf(d, fs), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=codepreflight.pdf"})
    if format == "md": return Response(reports.to_markdown(d, fs), media_type="text/markdown", headers={"Content-Disposition": "attachment; filename=codepreflight.md"})
    return Response(reports.to_json(d, fs), media_type="application/json", headers={"Content-Disposition": "attachment; filename=codepreflight.json"})

@app.get("/api/v1/history")
def history(authorization: str | None = Header(None)):
    uid = current_user(authorization)
    if not uid: raise HTTPException(401, "Sign in to see your scan history")
    return db.table("audits").select("id,commit_sha,score,risk,status,started_at,repositories(owner,name)").eq("user_id", uid).order("started_at", desc=True).limit(50).execute().data

@app.post("/api/v1/ai/explain")
def explain(body: ExplainIn, authorization: str | None = Header(None)):
    uid, out = current_user(authorization), []
    for fid in body.finding_ids[:5]:
        f = db.table("findings").select("*").eq("id", fid).single().execute().data
        own(f["audit_id"], uid)
        if f.get("ai"): out.append(f["ai"]); continue  # cached: saves free-tier quota
        r = ai.explain(f)  # only redacted fields reach the provider
        if not r.get("fallback"): db.table("findings").update({"ai": r}).eq("id", fid).execute()
        out.append(r)
    return out

@app.post("/api/v1/findings/{finding_id}/accept")
def accept(finding_id: str, body: dict, authorization: str | None = Header(None)):  # auditable suppression: reason required
    uid = current_user(authorization)
    own(db.table("findings").select("audit_id").eq("id", finding_id).single().execute().data["audit_id"], uid)
    if len(body.get("reason", "")) < 5: raise HTTPException(400, "A reason is required")
    db.table("findings").update({"status": "accepted"}).eq("id", finding_id).execute()
    db.table("finding_status_history").insert({"finding_id": finding_id, "status": "accepted", "reason": body["reason"], "changed_by": uid}).execute()
    return {"ok": True}
