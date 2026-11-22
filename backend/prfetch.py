"""Fetch a PR snapshot from the GitHub REST API (read-only). Everything returned is untrusted data."""
from urllib.parse import quote
import integrity

MAX_FILES, MAX_CONTENT_FETCHES, MAX_BYTES = 3000, 80, 200_000

class PRFetchError(Exception):
    def __init__(self, status, msg): super().__init__(msg); self.status, self.msg = status, msg

def _get(c, url, **kw):
    r = c.get(url, **kw)
    if r.status_code in (403, 429) and r.headers.get("x-ratelimit-remaining") == "0":
        raise PRFetchError(503, "GitHub API rate limit reached. Sign in with GitHub or try again later.")
    return r

def _pull(c, o, r, n):
    x = _get(c, f"/repos/{o}/{r}/pulls/{n}")
    if x.status_code == 404: raise PRFetchError(404, "Pull request not found, or your account has no access to it.")
    if x.status_code != 200: raise PRFetchError(502, "GitHub returned an unexpected response.")
    return x.json()

def _content(c, o, r, path, sha):
    x = _get(c, f"/repos/{o}/{r}/contents/{quote(path)}", params={"ref": sha}, headers={"Accept": "application/vnd.github.raw+json"})
    if x.status_code != 200 or len(x.content) > MAX_BYTES: return None  # None = unknown, which keeps the verdict from being PASS
    return x.text

def fetch_pr(c, owner, repo, number):
    """`c` is an httpx.Client with base_url and auth headers set. Raises PRFetchError with a user-safe message."""
    pr = _pull(c, owner, repo, number)
    head_sha, base_tip = pr["head"]["sha"], pr["base"]["sha"]
    cmp_ = _get(c, f"/repos/{owner}/{repo}/compare/{base_tip}...{head_sha}", params={"per_page": 1})
    base_sha = (cmp_.json().get("merge_base_commit") or {}).get("sha") if cmp_.status_code == 200 else None
    if not base_sha: raise PRFetchError(502, "Could not determine the merge base for this pull request.")
    files, page = [], 1
    while page <= MAX_FILES // 100:
        x = _get(c, f"/repos/{owner}/{repo}/pulls/{number}/files", params={"per_page": 100, "page": page})
        if x.status_code != 200: raise PRFetchError(502, "Could not list the pull request's files.")
        batch = x.json(); files += batch
        if len(batch) < 100: break
        page += 1
    truncated = pr.get("changed_files", len(files)) > len(files)
    out, fetches = [], 0
    for f in files:
        d = {"path": f["filename"], "status": {"changed": "modified"}.get(f["status"], f["status"]), "patch": f.get("patch"), "base": None, "head": None}
        if f.get("previous_filename"): d["previous_path"] = f["previous_filename"]
        if integrity.needs_content(d["path"]) or integrity.needs_content(d.get("previous_path", "")):
            if fetches + 2 > MAX_CONTENT_FETCHES: d["base"] = d["head"] = None; d["status"] = d["status"]; d["_skipped"] = True
            else:
                if d["status"] in ("modified", "removed", "renamed"): d["base"] = _content(c, owner, repo, d.get("previous_path", d["path"]), base_sha); fetches += 1
                if d["status"] in ("modified", "added", "renamed"): d["head"] = _content(c, owner, repo, d["path"], head_sha); fetches += 1
        out.append(d)
    if _pull(c, owner, repo, number)["head"]["sha"] != head_sha:  # PR moved while we were reading it: refuse to report on a mixed snapshot
        raise PRFetchError(409, "The pull request changed while it was being analysed. Run the analysis again.")
    return {"title": pr.get("title"), "body": pr.get("body"), "head_ref": pr["head"].get("ref"), "state": pr.get("state"),
            "base_sha": base_sha, "head_sha": head_sha, "files": out, "files_truncated": truncated}


# ---------------- listing + approval helpers (pure, unit-tested; main.py does the HTTP) ----------------
import re as _re
_REPO_API = _re.compile(r"^https://api\.github\.com/repos/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$")

def parse_search_items(items):
    """GitHub search results -> safe list rows. Anything that does not parse as a normal github.com PR is dropped."""
    out = []
    for i in items or []:
        m = _REPO_API.match(str(i.get("repository_url", "")))
        n = i.get("number")
        if not m or not isinstance(n, int) or n < 1 or i.get("pull_request") is None: continue
        url = f"https://github.com/{m.group(1)}/{m.group(2)}/pull/{n}"
        if integrity.parse_pr_url(url) is None: continue
        out.append({"url": url, "repo": f"{m.group(1)}/{m.group(2)}", "number": n, "title": str(i.get("title", ""))[:200],
                    "author": str((i.get("user") or {}).get("login", ""))[:60], "updated_at": i.get("updated_at"), "draft": bool(i.get("draft"))})
    return out

def approval_gate(res, head_sha, acknowledged):
    """Decide whether an approval may be sent. Returns (ok, http_status, message). Never trusts a verdict from the browser."""
    if res.get("demo"): return False, 400, "Demo results cannot be approved."
    if res["analysis"]["head_sha"] != head_sha: return False, 409, "The pull request changed since it was checked. Check it again before approving."
    if res["outcome"] == "BLOCK": return False, 403, "CodePreflight found blocking problems with this change, so approving it here is disabled. Fix them or review it on GitHub."
    if res["outcome"] == "REVIEW" and not acknowledged: return False, 400, "Confirm that you reviewed the findings before approving."
    if res["outcome"] not in ("PASS", "REVIEW"): return False, 400, "This result cannot be approved."
    return True, 200, ""

def review_body(res, comment=None):
    head = (
        f"Approved from CodePreflight after an integrity check: {res['outcome']} ({res['verdict']}), "
        f"rules v{res['rules_version']}, commit {res['analysis']['head_sha'][:10]}. Advisory static analysis, not a security certification."
    )
    c = " ".join((comment or "").split())[:500]
    return head + (f"\n\n{c}" if c else "")
