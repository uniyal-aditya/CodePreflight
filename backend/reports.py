import json, re
from core import ORDER
from pdf import text_to_pdf

LEVEL = {"critical": "error", "high": "error", "medium": "warning", "low": "note", "info": "note"}

def to_sarif(audit, findings):  # SARIF 2.1.0, accepted by GitHub code scanning
    rules = {f["rule_id"]: {"id": f["rule_id"], "shortDescription": {"text": f["title"]}, "help": {"text": f["recommendation"]}} for f in findings}
    res = []
    for f in findings:
        loc = {"artifactLocation": {"uri": f["file_path"]}}
        if f.get("line_number"): loc["region"] = {"startLine": f["line_number"]}
        res.append({"ruleId": f["rule_id"], "level": LEVEL[f["severity"]], "message": {"text": f"{f['title']}: {f['evidence']}"},
                    "locations": [{"physicalLocation": loc}], "partialFingerprints": {"codepreflight/v1": f["fingerprint"]}})
    return {"version": "2.1.0", "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
            "runs": [{"tool": {"driver": {"name": "CodePreflight", "informationUri": "https://github.com/", "rules": list(rules.values())}}, "results": res}]}

def to_markdown(audit, findings):
    fs = sorted(findings, key=lambda f: ORDER.index(f["severity"]))
    L = [f"# CodePreflight report", "", f"- Commit: `{audit['commit_sha']}`", f"- Readiness score: {audit.get('score')}/100", f"- Security risk status: {audit.get('risk')}",
         f"- Scan coverage: {audit.get('coverage_pct', '?')}% (unknown checks are not counted as passing)", "", "## Findings (most severe first)", ""]
    for i, f in enumerate(fs, 1):
        L += [f"{i}. **[{f['severity'].upper()}] {f['title']}** ({f['source']}, `{f['file_path']}`)", f"   - Evidence: {f['evidence']}", f"   - Fix: {f['recommendation']}"]
    L += ["", "## Scan coverage", ""] + [f"- {k}: {v}" for k, v in (audit.get("coverage") or {}).items()]
    return "\n".join(L + ["", "_Automated findings need human review. This is not a guarantee of safety._"])

def to_json(audit, findings): return json.dumps({"schema": "codepreflight/v1", "audit": audit, "findings": findings}, indent=2, default=str)

def to_pdf(audit, findings):
    return text_to_pdf(re.sub(r"[*`_#]", "", to_markdown(audit, findings)))
