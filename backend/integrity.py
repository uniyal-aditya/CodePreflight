"""PR change-integrity engine (rules v0.1).

Pure and deterministic: no network, no model calls, and it never executes repository code.
Input is a PR snapshot (see `analyze`); output is findings with evidence plus a verdict.
PR text (title, body, diffs) is untrusted DATA: it can raise findings but can never change policy.
"""
import re, unicodedata, base64, difflib
import yaml

RULES_VERSION = "0.1"
MODULES = ["tests", "ci", "security_controls", "permissions", "agent_instructions", "scope"]
REQUIRED = MODULES[:5]  # scope is optional: it only runs when the owner configures it

# ---------------------------------------------------------------- URL + path classification
_PR_PATH = re.compile(r"^/([A-Za-z0-9_.-]{1,100})/([A-Za-z0-9_.-]{1,100})/pull/([1-9][0-9]{0,8})/?$")

def parse_pr_url(url):
    """Strict: https://github.com/{owner}/{repo}/pull/{n}; no port, userinfo, query or fragment."""
    from urllib.parse import urlparse
    try:
        u = urlparse((url or "").strip())
        if u.scheme != "https" or u.netloc != "github.com" or u.query or u.fragment or u.params: return None
        m = _PR_PATH.match(u.path)
    except ValueError:
        return None
    if not m or set(m.group(1)) <= {"."} or set(m.group(2)) <= {"."}: return None  # reject '.', '..', '...'
    return m.group(1), m.group(2), int(m.group(3))

TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|spec|e2e)/|(^|/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$|Tests?\.java$")
WORKFLOW = re.compile(r"^\.github/workflows/[^/]+\.ya?ml$")
AGENT_PATH = re.compile(r"(^|/)(AGENTS|CLAUDE|GEMINI|CODEX)\.md$|^\.claude/|^\.cursor/rules/|(^|/)\.cursorrules$|^\.github/copilot-instructions\.md$|^\.github/instructions/", re.I)
SEC_CONFIG = re.compile(r"(^|/)(\.trivyignore|\.gitleaksignore|\.gitleaks\.toml|\.semgrepignore|\.snyk|trivy\.ya?ml|\.pre-commit-config\.ya?ml)$")
COV_CONFIG = re.compile(r"(^|/)(\.coveragerc|setup\.cfg|pyproject\.toml|jest\.config\.[cm]?[jt]s|package\.json|codecov\.ya?ml)$")

def is_test(p): return bool(TEST_PATH.search(p))
def needs_content(p): return bool(is_test(p) or WORKFLOW.match(p) or AGENT_PATH.search(p) or SEC_CONFIG.search(p) or COV_CONFIG.search(p))

# ---------------------------------------------------------------- evidence helpers
_SECRET = re.compile(r"AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{30,}")

def _clip(s, n=240):
    s = _SECRET.sub("[redacted-secret]", str(s or "")).replace("\r", "")
    return s if len(s) <= n else s[:n] + "…"

def _f(module, rule, sev, conf, path, reason, before="", after="", line=None, invariant=""):
    return {"module": module, "rule_id": rule, "severity": sev, "confidence": conf, "file": path, "line": line,
            "before": _clip(before), "after": _clip(after), "reason": reason, "invariant": invariant}

def _lines(s): return (s or "").splitlines()

def added_lines(base, head):
    """Lines of `head` (stripped, non-empty) not present anywhere in `base`, with 1-based line numbers."""
    b = {l.strip() for l in _lines(base)}
    return [(i + 1, l.strip()) for i, l in enumerate(_lines(head)) if l.strip() and l.strip() not in b]

def _known(f):
    """False when needed file content is missing for a reason other than the file being added/removed."""
    st, b, h = f.get("status"), f.get("base"), f.get("head")
    if st == "added": return h is not None
    if st == "removed": return b is not None
    return b is not None and h is not None

def _yaml(text):
    try:
        d = yaml.safe_load(text or "")
        return (d if isinstance(d, dict) else {}), True
    except yaml.YAMLError:
        return None, False

# ---------------------------------------------------------------- tests module
SKIP_RE = re.compile(r"@pytest\.mark\.(skip|skipif|xfail)|\bpytest\.(skip|xfail)\(|@unittest\.skip|\b(describe|it|test)\.(skip|todo)\b|\bx(describe|it|test)\(|@Disabled|@Ignore\b|\bt\.Skip\(|#\[ignore\]")
DEF_RE = re.compile(r"^\s*(async\s+)?def\s+test_\w+|^\s*(it|test)\(|^\s*func\s+Test\w+|@Test\b", re.M)
ASSERT_RE = re.compile(r"\bassert\w*\b|\bexpect\(|assert_eq!|\.Equal\(")
SPEC_RE = re.compile(r"assert\w*[^#\n]*?(==|\bis\b)|assertEquals?|toBe\(|toEqual\(|toStrictEqual\(|status_code\s*==\s*\d{3}|\.status\(\d{3}\)|assert_eq!")
WEAK_RE = re.compile(r"assert\w*[^#\n]*?(\bin\s*[\(\[\{]|>=|<=|!=|\bis not None\b)|assert\s+True\b|assertTrue\(True|toBeTruthy|toBeDefined|not\.toBeNull|expect\(true\)|status_code\s*(<|>|!=|\bin\b)")
COV_NUM = re.compile(r"(?:fail[_-]under|\"(?:branches|lines|functions|statements)\")\s*[=:]\s*(\d+)")

def _first_new(base, head, rx):
    for n, l in added_lines(base, head):
        if rx.search(l): return n, l
    return None, ""

def check_tests(files, out):
    added_tests = [f for f in files if f["status"] == "added" and is_test(f["path"])]
    for f in files:
        p, st, b, h = f["path"], f["status"], f.get("base"), f.get("head")
        if st == "removed" and is_test(p):
            repl = bool(added_tests)
            out.append(_f("tests", "TEST-001", "medium" if repl else "high", "medium" if repl else "high", p,
                          "Test file deleted" + (" (other test files were added; check the replacement covers the same behaviour)." if repl else " with no replacement test added."),
                          before=f"(file existed, {len(_lines(b))} lines)", after="(deleted)", invariant="Existing tests must keep exercising the behaviour they covered."))
            continue
        if st == "renamed" and is_test(f.get("previous_path", "")) and not is_test(p):
            out.append(_f("tests", "TEST-001", "medium", "medium", p, "Test file renamed to a path that is no longer recognised as a test.", before=f["previous_path"], after=p))
        if COV_CONFIG.search(p) and _known(f) and st == "modified":
            bn, hn = [int(x) for x in COV_NUM.findall(b)], [int(x) for x in COV_NUM.findall(h)]
            if bn and (not hn or min(hn) < min(bn)):
                out.append(_f("tests", "TEST-006", "high", "high", p, "Coverage threshold lowered or removed.", before=f"thresholds {bn}", after=f"thresholds {hn or 'none'}", invariant="Coverage enforcement must not be weakened."))
        if not is_test(p) or st not in ("modified", "added") or not _known(f): continue
        if len(SKIP_RE.findall(h or "")) > len(SKIP_RE.findall(b or "")):
            n, l = _first_new(b, h, SKIP_RE)
            out.append(_f("tests", "TEST-002", "high", "high", p, "A skip/xfail/disable marker was added to a test.", after=l, line=n, invariant="Tests must not be silently disabled."))
        if st == "modified":
            if len(DEF_RE.findall(h)) < len(DEF_RE.findall(b)):
                out.append(_f("tests", "TEST-003", "medium", "medium", p, "Number of test cases decreased.", before=f"{len(DEF_RE.findall(b))} tests", after=f"{len(DEF_RE.findall(h))} tests"))
            if len(ASSERT_RE.findall(h)) < len(ASSERT_RE.findall(b)):
                out.append(_f("tests", "TEST-005", "medium", "medium", p, "Number of assertions decreased.", before=f"{len(ASSERT_RE.findall(b))} assertions", after=f"{len(ASSERT_RE.findall(h))} assertions"))
            bl, hl = _lines(b), _lines(h)
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, bl, hl, autojunk=False).get_opcodes():
                if tag != "replace": continue
                for k in range(min(i2 - i1, j2 - j1)):
                    old, new = bl[i1 + k], hl[j1 + k]
                    if SPEC_RE.search(old) and not WEAK_RE.search(old) and WEAK_RE.search(new):
                        out.append(_f("tests", "TEST-004", "high", "high", p, "A specific assertion was replaced by a broader one that accepts more outcomes.",
                                      before=old.strip(), after=new.strip(), line=j1 + k + 1, invariant="The test must still fail for the behaviour it originally rejected."))

# ---------------------------------------------------------------- workflow helpers
TEST_CMD = re.compile(r"\b(pytest|unittest|jest|vitest|mocha|npm (run )?test|yarn test|pnpm test|go test|cargo test|mvn( \S+)* test|gradle test|rspec|phpunit|dotnet test|tox)\b", re.I)
LINT_CMD = re.compile(r"\b(ruff|flake8|pylint|eslint|mypy|tsc|typecheck|npm run (lint|typecheck))\b", re.I)
SEC_CMD = re.compile(r"trivy|gitleaks|semgrep|codeql|osv-scanner|snyk|bandit|detect-secrets|trufflehog|npm audit|pip-audit|dependency-review|scorecard", re.I)
TEST_NAME = re.compile(r"^(run |execute )?(unit |integration )?tests?$", re.I)
BYPASS = re.compile(r"(\|\||;)\s*(true|:|exit\s+0)\s*$|\|\|\s*(true|:|exit\s+0)\b", re.M)
NOOP = re.compile(r"^\s*(echo|true|:|exit\s+0)\b")
EXIT_ZERO = re.compile(r"--exit-code[ =]0\b|--exit-zero|--no-fail|exit-code=0")

def _kind(st):
    cmd = f"{st.get('uses', '')} {st.get('run', '')}"
    if SEC_CMD.search(cmd) or SEC_CMD.search(str(st.get("name", ""))) and st.get("uses"): return "security"
    if TEST_CMD.search(cmd) or (st.get("run") and TEST_NAME.match(str(st.get("name", "")).strip())): return "test"
    if LINT_CMD.search(cmd): return "lint"
    return None

def _steps(doc):
    return [(jid, st, job) for jid, job in (doc.get("jobs") or {}).items() if isinstance(job, dict)
            for st in (job.get("steps") or []) if isinstance(st, dict)]

def _norm(st): return re.sub(r"@.*$", "", str(st.get("uses", ""))), " ".join(str(st.get("run", "")).split())

def _match(st, cands):
    """Find the same step in `cands` [(jid, step, job)] by id, name, or normalised uses/run."""
    n = _norm(st)
    for c in cands:
        s = c[1]
        if (st.get("id") and st.get("id") == s.get("id")) or (st.get("name") and st.get("name") == s.get("name")) or (n != ("", "") and n == _norm(s)) or (n[0] and n[0] == _norm(s)[0]):
            return c
    return None

def _truthy(v): return str(v).strip().lower() in ("true", "1", "yes")
def _false_if(v): return str(v).strip().lower().replace(" ", "") in ("false", "${{false}}")
def _mod(kind): return "security_controls" if kind == "security" else "ci"
def _label(st): return str(st.get("name") or st.get("uses") or str(st.get("run", ""))[:50])

def check_workflows(files, out, cov):
    for f in files:
        p = f["path"]
        if not WORKFLOW.match(p): continue
        if not _known(f): 
            for m in ("ci", "security_controls", "permissions"): cov[m] = "unknown"
            continue
        bd, bok = _yaml(f.get("base")) if f.get("base") is not None else ({}, True)
        hd, hok = _yaml(f.get("head")) if f.get("head") is not None else ({}, True)
        if not (bok and hok):
            for m in ("ci", "security_controls", "permissions"): cov[m] = "unknown"
            out.append(_f("ci", "CI-000", "medium", "high", p, "Workflow YAML could not be parsed; its integrity could not be verified.")); continue
        bs, hs = _steps(bd), _steps(hd)
        # removed / neutralised verification steps
        for jid, st, job in bs:
            k = _kind(st)
            if not k: continue
            m = _match(st, hs)
            if not m:
                same_kind = any(_kind(s) == k for _, s, _ in hs)
                sev, conf = ("medium", "medium") if same_kind else ("high", "high")
                rule = "SEC-001" if k == "security" else "CI-003"
                out.append(_f(_mod(k), rule, sev, conf, p, f"{k.capitalize()} step removed from the workflow" + ("" if not same_kind else " (another step of the same kind remains; verify it is equivalent)") + ".",
                              before=_label(st), after="(removed)", invariant=f"The {k} check must still run on every PR."))
            else:
                run = str(m[1].get("run", ""))
                if run.strip() and all(NOOP.match(l) for l in run.splitlines() if l.strip()) and not all(NOOP.match(l) for l in str(st.get("run", "")).splitlines() if l.strip()):
                    out.append(_f(_mod(k), "CI-004", "high", "high", p, "Verification command replaced by a no-op.", before=str(st.get("run", "")), after=run))
        # bypasses introduced on verification steps
        for jid, st, job in hs:
            k = _kind(st)
            if not k: continue
            m = _match(st, bs); old = m[1] if m else {}
            if _truthy(st.get("continue-on-error")) and not _truthy(old.get("continue-on-error")):
                out.append(_f(_mod(k), "CI-001", "high" if m else "medium", "high" if m else "medium", p, f"continue-on-error enabled on a {k} step: failures no longer fail the job.", before=_label(old) if m else "(new step)", after=f"{_label(st)} (continue-on-error: true)", invariant="A failing check must fail the pipeline."))
            hb, bb = BYPASS.search(str(st.get("run", ""))), BYPASS.search(str(old.get("run", "")))
            if hb and not bb:
                out.append(_f(_mod(k), "CI-002", "high", "high", p, f"Exit status of a {k} command is masked ('{hb.group(0).strip()}').", before=str(old.get("run", "")) if m else "(new step)", after=str(st.get("run", ""))))
            if _false_if(st.get("if", "")) and not _false_if(old.get("if", "")) or _false_if(job.get("if", "")) and not (m and _false_if(m[2].get("if", ""))):
                out.append(_f(_mod(k), "CI-005", "high", "high", p, f"A {k} step/job is disabled with an always-false condition.", after=f"if: {st.get('if') or job.get('if')}"))
            if k == "security":
                wz = str((st.get("with") or {}).get("exit-code", "")) in ("0",) or EXIT_ZERO.search(str(st.get("run", "")))
                bz = str(((old.get("with") or {}) if m else {}).get("exit-code", "")) in ("0",) or EXIT_ZERO.search(str(old.get("run", "")))
                if wz and not bz:
                    out.append(_f("security_controls", "SEC-003", "high", "high", p, "Security scanner configured to exit successfully even when it finds issues.", after=_label(st), invariant="Security findings must be able to fail the check."))
        check_permissions(p, bd, hd, out)

# ---------------------------------------------------------------- permissions
HIGH_SCOPES = {"contents", "actions", "id-token", "packages", "deployments", "*"}

def _perm_map(doc):
    m = {}
    def add(scope, p):
        if p == "write-all": m[(scope, "*")] = "write-all"
        elif isinstance(p, dict): m.update({(scope, str(k)): str(v) for k, v in p.items()})
    add("workflow", doc.get("permissions"))
    for jid, job in (doc.get("jobs") or {}).items():
        if isinstance(job, dict): add(f"job {jid}", job.get("permissions"))
    return m

def _triggers(doc):
    on = doc.get("on", doc.get(True))  # PyYAML (YAML 1.1) parses the bare key `on` as True
    return {on} if isinstance(on, str) else set(on) if isinstance(on, (list, dict)) else set()

def _head_ref_checkout(doc):
    return any("checkout" in str(st.get("uses", "")) and "pull_request.head" in str((st.get("with") or {}).get("ref", "")) for _, st, _ in _steps(doc))

def check_permissions(p, bd, hd, out):
    bm, hm = _perm_map(bd), _perm_map(hd)
    for (scope, name), v in hm.items():
        old = bm.get((scope, name))
        if v == "write-all" and old != "write-all":
            out.append(_f("permissions", "PERM-001", "high", "high", p, f"{scope}: permissions set to write-all.", before=str(old or "(none)"), after="write-all", invariant="Workflows must request least privilege."))
        elif v == "write" and old != "write":
            hi = name in HIGH_SCOPES
            out.append(_f("permissions", "PERM-002", "high" if hi else "medium", "high", p, f"{scope}: '{name}' permission raised to write" + (" (sensitive scope)." if hi else "."), before=f"{name}: {old or '(unset)'}", after=f"{name}: write"))
    if any(s == "workflow" for s, _ in bm) and not any(s == "workflow" for s, _ in hm):
        out.append(_f("permissions", "PERM-003", "medium", "low", p, "Explicit workflow-level permissions block removed; the token falls back to repository defaults."))
    if "pull_request_target" in _triggers(hd) and "pull_request_target" not in _triggers(bd):
        out.append(_f("permissions", "PERM-004", "high", "medium", p, "pull_request_target trigger added: it runs with repository secrets and a write token.", after="on: pull_request_target"))
    if _head_ref_checkout(hd) and not _head_ref_checkout(bd):
        out.append(_f("permissions", "PERM-005", "critical", "high", p, "Workflow checks out the PR head ref; combined with privileged triggers this can run untrusted code with secrets.", after="actions/checkout with ref: …pull_request.head…"))

# ---------------------------------------------------------------- security-control config
def check_security_configs(files, out):
    for f in files:
        p = f["path"]
        if not SEC_CONFIG.search(p) or not _known(f): continue
        if f["status"] == "removed":
            out.append(_f("security_controls", "SEC-006", "high", "medium", p, "Security configuration file deleted.", before="(existed)", after="(deleted)")); continue
        if f["status"] != "modified": continue
        if p.endswith("pre-commit-config.yaml") or p.endswith("pre-commit-config.yml"):
            ids = lambda t: set(re.findall(r"id:\s*([\w.-]+)", t or ""))
            gone = {i for i in ids(f["base"]) - ids(f["head"]) if SEC_CMD.search(i)}
            if gone: out.append(_f("security_controls", "SEC-004", "high", "high", p, "Security pre-commit hook removed.", before=", ".join(sorted(gone)), after="(removed)"))
        else:
            new = [(n, l) for n, l in added_lines(f["base"], f["head"]) if not l.startswith("#")]
            if new:
                out.append(_f("security_controls", "SEC-002", "medium", "medium", p, f"Scanner ignore/allow list widened ({len(new)} new entr{'y' if len(new) == 1 else 'ies'}); confirm each exclusion is justified.", after="\n".join(l for _, l in new[:5]), line=new[0][0]))

# ---------------------------------------------------------------- agent instructions + injection phrases
_AGENT_RULES = [
    ("AGT-001", "high", re.compile(r"\b(ignore|skip|disable|bypass|suppress|never run|do not run|don'?t run)\b.{0,40}\b(security|scan\w*|tests?|lint\w*|ci|checks?|review|findings?)\b", re.I), "Instruction tells the agent to ignore, skip or suppress security/test/review checks."),
    ("AGT-002", "high", re.compile(r"\b(print|reveal|output|echo|send|upload|commit|post|exfiltrat\w*)\b.{0,40}\b(secrets?|tokens?|api[_ -]?keys?|passwords?|credentials?|\.env)\b", re.I), "Instruction asks the agent to reveal, send or commit secrets."),
    ("AGT-003", "high", re.compile(r"ignore (all |any )?(previous|prior|above) instructions|\b(trust|obey|follow|execute)\b.{0,40}\b(repository|repo|pr|comment|issue|file)s?\b.{0,30}\b(instructions?|commands?)\b", re.I), "Instruction expands trust in untrusted content or overrides earlier instructions."),
    ("AGT-004", "high", re.compile(r"auto-?merge|merge without|without (human )?(review|approval)|skip (code )?review|force[- ]push", re.I), "Instruction bypasses human review/approval."),
]

_NEGATED = re.compile(r"\b(never|don'?t|do not|must not|should not|shall not|avoid|not)\s+(\w+\s+){0,2}?(ignore|skip|disable|bypass|suppress)\b", re.I)

def check_agent_files(files, out):
    for f in files:
        p = f["path"]
        if not AGENT_PATH.search(p) or f["status"] == "removed": continue
        if not _known(f): continue
        hit = False
        for n, line in added_lines(f.get("base"), f.get("head")):
            for rid, sev, rx, why in _AGENT_RULES:
                text = _NEGATED.sub("", line) if rid == "AGT-001" else line  # "never skip tests" is the opposite of a bypass
                if rx.search(text):
                    hit = True
                    out.append(_f("agent_instructions", rid, sev, "medium", p, why, after=line, line=n, invariant="Agent instructions must not weaken verification or governance."))
        if not hit:
            out.append(_f("agent_instructions", "AGT-000", "low", "low", p, "Agent instruction file changed; no policy-relevant pattern matched. Review the diff.", after=f"{len(added_lines(f.get('base'), f.get('head')))} changed line(s)"))

# ---------------------------------------------------------------- scope
def _glob(g):
    out, i = "", 0
    while i < len(g):
        if g[i:i + 3] == "**/": out += "(?:.*/)?"; i += 3
        elif g[i:i + 2] == "**": out += ".*"; i += 2
        elif g[i] == "*": out += "[^/]*"; i += 1
        elif g[i] == "?": out += "[^/]"; i += 1
        else: out += re.escape(g[i]); i += 1
    return re.compile("^" + out + "$")

def check_scope(files, policy, out):
    allowed = [_glob(g) for g in policy.get("allowed_paths", [])]
    protected = [_glob(g) for g in policy.get("protected_paths", [])]
    if not allowed and not protected: return "not_configured"
    for f in files:
        paths = [f["path"]] + ([f["previous_path"]] if f.get("previous_path") else [])
        for p in paths:
            if any(r.match(p) for r in protected):
                out.append(_f("scope", "SCOPE-001", "high", "high", p, "Protected path modified.", invariant="Protected paths change only with explicit approval.")); break
            if allowed and not any(r.match(p) for r in allowed):
                out.append(_f("scope", "SCOPE-002", "medium", "high", p, "File changed outside the declared task scope.", invariant="Changes must stay within the declared scope.")); break
    return "ran"

# ---------------------------------------------------------------- prompt-injection indicators
_HIDDEN = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\U000e0000-\U000e007f]")
_BIDI = re.compile("[\u202a-\u202e\u2066-\u2069\U000e0000-\U000e007f]")
_INJ = [
    ("override-instructions", "high", re.compile(r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?)")),
    ("role-hijack", "medium", re.compile(r"\byou are now\b|\bnew instructions?\s*:|<\|?(system|im_start)\|?>|\[/?inst\]|\bsystem prompt\b")),
    ("secret-exfiltration", "high", re.compile(r"(print|reveal|show|output|send|leak|exfiltrate)\s+(all\s+|the\s+|your\s+|any\s+)?(secrets?|tokens?|api[ _-]?keys?|passwords?|credentials?|environment variables)")),
    ("policy-tampering", "medium", re.compile(r"(mark|report|approve|set)\s+(this|the|it|all)\b.{0,30}\b(safe|passed?|verified|clean)\b|(disable|skip|turn off)\s+(the\s+)?(integrity|security)\s+(checks?|scan\w*|verification)")),
]

def _norm_text(s): return re.sub(r"\s+", " ", _HIDDEN.sub("", unicodedata.normalize("NFKC", s or ""))).lower()

def scan_injection(sources):
    """sources: {label: text}. Returns indicators; they flag text for human review and never alter policy."""
    out = []
    for label, text in sources.items():
        text = (text or "")[:20000]
        if _BIDI.search(text):
            out.append({"source": label, "indicator": "hidden-characters", "confidence": "medium", "excerpt": "(bidi/tag control characters present)"})
        variants = [(_norm_text(text), "")]
        for tok in re.findall(r"[A-Za-z0-9+/]{32,}={0,2}", text)[:10]:
            try: variants.append((_norm_text(base64.b64decode(tok, validate=True).decode("utf-8")), "encoded-"))
            except Exception: pass
        for t, prefix in variants:
            for name, conf, rx in _INJ:
                m = rx.search(t)
                if m:
                    out.append({"source": label, "indicator": prefix + name, "confidence": "medium" if prefix else conf, "excerpt": _clip(t[max(0, m.start() - 30):m.end() + 50], 160)})
    seen, uniq = set(), []
    for i in out:
        k = (i["source"], i["indicator"])
        if k not in seen: seen.add(k); uniq.append(i)
    return uniq

# ---------------------------------------------------------------- verdict
_SEV = {"critical": 0, "high": 1, "medium": 2, "low": 3}

def _verdict(findings, cov, indicators):
    blocking = [f for f in findings if f["severity"] == "critical" or (f["severity"] == "high" and f["confidence"] == "high")]
    unknown = [m for m in REQUIRED if cov.get(m) in ("unknown", "failed")]
    review = [f for f in findings if f not in blocking and f["severity"] in ("critical", "high", "medium")]
    ind = [i for i in indicators if i["confidence"] in ("medium", "high")]
    if blocking: return "REJECTED", "BLOCK"
    if unknown: return "NOT_VERIFIABLE", "REVIEW"
    if review or ind: return "CONDITIONALLY_SAFE", "REVIEW"
    return "VERIFIED_SAFE", "PASS"

def analyze(pr, policy=None):
    """pr: {title, body, head_ref, base_sha, head_sha, files:[{path,status,previous_path?,base,head,patch}], files_truncated?}"""
    policy = policy or {}
    files = pr.get("files", [])
    findings, cov = [], {m: "ran" for m in REQUIRED}
    check_tests(files, findings); check_workflows(files, findings, cov); check_security_configs(files, findings)
    check_agent_files(files, findings)
    cov["scope"] = check_scope(files, policy, findings)
    for f in files:  # relevant files whose content could not be fetched make their modules unverifiable
        if needs_content(f["path"]) and not _known(f):
            for m in (("tests",) if is_test(f["path"]) else ("agent_instructions",) if AGENT_PATH.search(f["path"]) else ("security_controls",) if SEC_CONFIG.search(f["path"]) else ("tests",)):
                cov[m] = "unknown"
    if pr.get("files_truncated"): cov.update({m: "unknown" for m in REQUIRED})
    sources = {"pr title": pr.get("title"), "pr body": pr.get("body"), "branch name": pr.get("head_ref")}
    for f in files:
        txt = "\n".join(l[1:] for l in (f.get("patch") or "").splitlines() if l.startswith("+") and not l.startswith("+++"))
        if txt: sources["diff: " + f["path"]] = txt
    indicators = scan_injection(sources)
    findings.sort(key=lambda f: (_SEV[f["severity"]], f["module"], f["file"]))
    verdict, outcome = _verdict(findings, cov, indicators)
    mods = {}
    for m in MODULES:
        fs = [f for f in findings if f["module"] == m]
        st = cov.get(m)
        status = "not_configured" if st == "not_configured" else "unknown" if st in ("unknown", "failed") else \
                 "block" if any(f["severity"] == "critical" or (f["severity"] == "high" and f["confidence"] == "high") for f in fs) else \
                 "review" if any(f["severity"] in ("high", "medium") for f in fs) else "pass"
        mods[m] = {"status": status, "findings": len(fs)}
    return {"verdict": verdict, "outcome": outcome, "enforcement": "advisory", "rules_version": RULES_VERSION,
            "analysis": {"base_sha": pr.get("base_sha"), "head_sha": pr.get("head_sha"), "files_analysed": len(files)},
            "modules": mods, "coverage": cov, "findings": findings, "injection_indicators": indicators,
            "note": "Advisory result from deterministic static rules over the PR diff and base/head file contents. It is not a security certification; nothing here blocks a merge on GitHub."}
