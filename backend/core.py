"""Pure logic: no network, no database. Fully unit-testable."""
import re, hashlib

URL_RE = re.compile(r"^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$")
WEIGHTS = {"Security": 30, "Dependencies": 20, "Documentation": 15, "Engineering hygiene": 15, "Maintenance": 10, "Release readiness": 10}
DEDUCT = {"critical": 60, "high": 30, "medium": 15, "low": 5, "info": 0}
ORDER = ["critical", "high", "medium", "low", "info"]
KNOWN = {"pass", "fail", "ran"}  # anything else (unknown, failed, not covered) is NOT counted as covered

def parse_repo_url(url: str):
    m = URL_RE.match((url or "").strip())
    if not m or m.group(1) in (".", "..") or m.group(2) in (".", ".."): return None
    return m.group(1), m.group(2)

def mask(s: str) -> str:  # never store, show or send a full secret
    return s[:4] + "*" * 12 + s[-3:] if len(s) > 8 else "*" * len(s)

_INJ = re.compile(r"(?i)(ignore (all|previous|prior)|system prompt|you are now|disregard)")
def sanitize(text: str) -> str:  # repository text is data, never instructions
    return _INJ.sub("[removed]", text)[:500]

def finding(code, cat, sev, title, file, ev, rec, src, rule, conf="high", line=None):
    fp = hashlib.sha256(f"{rule}|{file}|{ev}".encode()).hexdigest()[:16]  # matches findings across rescans
    return dict(code=code, category=cat, severity=sev, title=title, file_path=file, line_number=line, evidence=sanitize(ev),
                recommendation=rec, source=src, rule_id=rule, confidence=conf, fingerprint=fp)

def rules(paths):
    """Custom repository checks. Returns (findings, coverage). Each check is pass, fail or unknown."""
    low = {p.lower() for p in paths}
    names = {p.split("/")[-1] for p in low}
    top = {p for p in low if "/" not in p}
    out, cov = [], {}
    def chk(rid, ok, cat, sev, title, rec, ev="Not found"):
        cov[rid] = "pass" if ok else "fail"
        if not ok: out.append(finding(rid, cat, sev, title, "(repository)", ev, rec, "rules", rid))
    chk("DOC-README", any(n.startswith("readme") for n in top), "Documentation", "medium", "Missing README", "Add install and usage steps.")
    chk("REL-LICENSE", any(n.startswith(("license", "licence", "copying")) for n in top), "Release readiness", "medium", "Missing LICENSE", "Add a licence (not legal advice).")
    chk("HYG-IGNORE", ".gitignore" in top, "Engineering hygiene", "low", "Missing .gitignore", "Exclude generated files and .env.")
    tests = any(p.startswith(("tests/", "test/")) or "/tests/" in p or "/test/" in p or p.endswith(("_test.py", ".test.js", ".spec.js", ".test.ts")) or n_ in ("pytest.ini", "jest.config.js") for p in low for n_ in [p.split("/")[-1]])
    chk("HYG-TESTS", tests, "Engineering hygiene", "medium", "No tests detected", "Add a smoke test and run it in CI.")
    chk("HYG-CI", any(p.startswith(".github/workflows/") for p in low), "Engineering hygiene", "low", "No CI workflow", "Add a workflow that runs tests on every push.")
    if "package.json" in names and not names & {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}:
        cov["DEP-LOCK"] = "unknown"  # unknown is never counted as pass
        out.append(finding("DEP-LOCK", "Dependencies", "medium", "No lockfile: versions unresolved", "package.json", "No lockfile", "Commit a lockfile so scans can resolve exact versions.", "rules", "DEP-LOCK"))
    return out, cov

def score(fs):
    o = [f for f in fs if f.get("status", "open") == "open"]
    cats = {c: max(0, 100 - sum(DEDUCT[f["severity"]] for f in o if f["category"] == c)) for c in WEIGHTS}
    risk = next((s for s in ORDER[:4] if any(f["severity"] == s for f in o)), "low")
    return {"score": round(sum(cats[c] * w / 100 for c, w in WEIGHTS.items())), "categories": cats, "risk": risk}

def coverage_pct(cov):
    v = [x for x in cov.values() if isinstance(x, str)]
    return round(100 * sum(x in KNOWN for x in v) / len(v)) if v else 0
