"""Scanner adapters. Every adapter returns (findings, status). Static inspection only: nothing from the repo is executed."""
import os, re, json, subprocess
from core import finding, DEDUCT, ORDER, fix_advice

def trivy(path):
    try:
        r = subprocess.run(["trivy", "fs", "--scanners", "vuln,secret,misconfig", "--format", "json", "--quiet", path], capture_output=True, text=True, timeout=180)
        data = json.loads(r.stdout or "{}")
    except FileNotFoundError: return [], "unknown"  # tool missing: unknown, never clean
    except (subprocess.TimeoutExpired, json.JSONDecodeError): return [], "failed"
    out, sv = [], lambda s: s.lower() if s.lower() in DEDUCT else "low"
    for res in data.get("Results", []):
        for v in res.get("Vulnerabilities") or []:
            out.append(finding(v["VulnerabilityID"], "Dependencies", sv(v["Severity"]), f'{v["PkgName"]} {v["InstalledVersion"]}', res["Target"], v.get("Title", ""), fix_advice(v["InstalledVersion"], v.get("FixedVersion", "")), "trivy", v["VulnerabilityID"]))
        for s in res.get("Secrets") or []:
            from core import mask
            out.append(finding(s["RuleID"], "Security", "critical", s["Title"], res["Target"], mask(s.get("Match", "secret")), "Rotate the credential, move it to a secret store, purge Git history.", "trivy", s["RuleID"], line=s.get("StartLine")))
        for m in res.get("Misconfigurations") or []:
            out.append(finding(m["ID"], "Security", sv(m["Severity"]), m["Title"], res["Target"], m.get("Message", ""), m.get("Resolution", ""), "trivy", m["ID"]))
    return out, "ran"

SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "dist", "build", "__pycache__"}

def _deps(path):
    """Pinned dependencies from requirements.txt and package-lock.json files anywhere in the repo (monorepos keep them in subfolders)."""
    out = []
    def safe(p): return os.path.isfile(p) and not os.path.islink(p) and os.path.getsize(p) < 5_000_000  # no symlink escapes
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = os.path.relpath(root, path)
        if rel_root != "." and rel_root.count(os.sep) >= 4: dirs[:] = []  # depth limit
        for name in files:
            full, rel = os.path.join(root, name), (name if rel_root == "." else f"{rel_root}/{name}")
            if name == "requirements.txt" and safe(full):
                for line in open(full, errors="ignore"):
                    m = re.match(r"^\s*([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)", line)
                    if m: out.append(("PyPI", m[1], m[2], rel))
            elif name == "package-lock.json" and safe(full):
                try: pk = json.load(open(full)).get("packages", {})
                except ValueError: pk = {}
                for k, v in list(pk.items())[:2000]:
                    if k.startswith("node_modules/") and v.get("version"): out.append(("npm", k.split("node_modules/")[-1], v["version"], rel))
    return out[:1000]

def osv(path):
    import httpx  # imported lazily so the other scanners and the tests need no HTTP library
    deps = _deps(path)
    if not deps: return [], "unknown"  # no resolvable versions: not a clean result
    SEV = {"CRITICAL": "critical", "HIGH": "high", "MODERATE": "medium", "MEDIUM": "medium", "LOW": "low"}
    out, detail = [], 0
    try:
        for i in range(0, len(deps), 500):
            chunk = deps[i:i + 500]
            res = httpx.post("https://api.osv.dev/v1/querybatch", json={"queries": [{"package": {"name": n, "ecosystem": e}, "version": v} for e, n, v, _ in chunk]}, timeout=30).json()["results"]
            for (e, n, v, f), r in zip(chunk, res):
                for vuln in (r.get("vulns") or [])[:3]:
                    sev, summ, rec = "medium", "", "Upgrade to a patched version listed in the advisory."
                    if detail < 15:
                        detail += 1
                        d = httpx.get(f"https://api.osv.dev/v1/vulns/{vuln['id']}", timeout=15).json()
                        sev = SEV.get((d.get("database_specific") or {}).get("severity", "").upper(), "medium"); summ = d.get("summary", "")[:120]
                        fixed = [e["fixed"] for a in d.get("affected", []) if (a.get("package") or {}).get("name") == n for r_ in a.get("ranges", []) for e in r_.get("events", []) if "fixed" in e]
                        if fixed: rec = fix_advice(v, ",".join(fixed))
                    out.append(finding(vuln["id"], "Dependencies", sev, f"{n} {v}", f, f"{vuln['id']}: {summ}", rec, "osv", vuln["id"], conf="high" if detail <= 15 else "medium"))
    except (httpx.HTTPError, KeyError, ValueError): return out, "failed"
    return out, "ran"

RISK = {"Dangerous-Workflow": ("Security", "critical"), "Token-Permissions": ("Security", "high"), "Branch-Protection": ("Security", "high"),
        "Pinned-Dependencies": ("Dependencies", "medium"), "Code-Review": ("Engineering hygiene", "medium"), "Maintained": ("Maintenance", "medium"), "Security-Policy": ("Documentation", "low")}

def scorecard(owner, name):  # public repos only; uses Scorecard's public REST API, so no binary is needed
    import httpx
    try: r = httpx.get(f"https://api.securityscorecards.dev/projects/github.com/{owner}/{name}", timeout=20)
    except httpx.HTTPError: return [], "failed"
    if r.status_code == 404: return [], "unknown"  # Scorecard has no stored result for this repo: not a pass, not a fail
    if r.status_code != 200: return [], "failed"
    out = []
    for c in r.json().get("checks", []):
        if c["name"] not in RISK or not 0 <= c["score"] < 5: continue  # -1 means could not be evaluated
        cat, sev = RISK[c["name"]]
        if c["score"] >= 3: sev = ORDER[min(ORDER.index(sev) + 1, 4)]
        out.append(finding(c["name"], cat, sev, f'Scorecard: {c["name"]} scored {c["score"]}/10', "(repository)", (c.get("reason") or "")[:140], f'See the OpenSSF Scorecard guidance for {c["name"]}.', "scorecard", c["name"], conf="medium"))
    return out, "ran"

HIST = {"aws-access-key-id": r"\bAKIA[0-9A-Z]{16}\b", "github-token": r"\bgh[pousr]_[A-Za-z0-9]{36,}\b", "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
        "slack-token": r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b", "google-api-key": r"\bAIza[0-9A-Za-z_\-]{35}\b"}

FIXTURE = re.compile(r"(^|/)(tests?|__tests__|fixtures?|mocks?|examples?|samples?|docs?)(/|$)|(_test|\.test|\.spec)\.")

def history(path, max_commits=100, max_bytes=20_000_000):
    """Secrets that were committed in the last N commits, even if they were later removed. Pattern based, so confidence is medium."""
    from core import mask
    try:  # read-only git log of an untrusted repo: external diff and textconv drivers are disabled
        r = subprocess.run(["git", "-C", path, "log", "-p", "--no-color", "--no-ext-diff", "--no-textconv", "-n", str(max_commits), "--format=commit %H"],
                           capture_output=True, text=True, errors="replace", timeout=120)
    except FileNotFoundError: return [], "unknown"
    except subprocess.TimeoutExpired: return [], "failed"
    if r.returncode != 0: return [], "failed"
    out, cur, file, seen = [], "", "", set()
    for line in r.stdout[:max_bytes].splitlines():
        if line.startswith("commit "): cur = line[7:14]; continue
        if line.startswith("+++ b/"): file = line[6:]; continue
        if not line.startswith("+") or line.startswith("+++"): continue
        for rid, rx in HIST.items():
            m = re.search(rx, line)
            if m and (rid, file, m.group()) not in seen and len(out) < 50:
                seen.add((rid, file, m.group()))
                val = m.group()
                if "EXAMPLE" in val.upper(): continue  # documentation keys such as AWS's AKIA...EXAMPLE are public and harmless
                fixture = bool(FIXTURE.search(file.lower()))
                out.append(finding(rid, "Security", "low" if fixture else "critical", f"Secret in Git history: {rid}" + (" (test or docs file)" if fixture else ""), file, f"commit {cur}: {mask(val)}",
                                   "Revoke and rotate the credential. Deleting it from current files is not enough, it stays in history." + (" If this is a fake value used in a test, no action is needed." if fixture else ""),
                                   "git-history", rid + "-history", conf="low" if fixture else "medium"))
    return out, "ran"
