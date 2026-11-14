import { Report, SEV, score } from "./lib";
import { textToPdf } from "./pdf";

const LEVEL = { critical: "error", high: "error", medium: "warning", low: "note", info: "note" } as const;
const advisory = (id: string) => /^CVE-\d{4}-\d+$/.test(id) ? `https://nvd.nist.gov/vuln/detail/${id}` : /^GHSA-[\w-]+$/.test(id) ? `https://github.com/advisories/${id}` : "";
export function toMarkdown(r: Report, acc: Record<string, string>) {
  const s = score(r.findings, acc), fs = [...r.findings].sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev));
  const counts = SEV.filter((x) => fs.some((f) => f.sev === x)).map((x) => `${fs.filter((f) => f.sev === x).length} ${x}`).join(", ") || "none reported";
  return ["# CodePreflight report", "", `- Repository: ${r.url}`, `- Commit: ${r.commit}`, `- Scan type: ${r.mode === "full" ? "full (backend)" : "lite (in browser)"}`, `- Readiness score: ${s.tot}/100`, `- Security risk status: ${s.top}`, `- Scan coverage: ${r.pct}% (unknown checks are not counted as passing)`, `- Findings: ${counts}`, "", "## Findings (most severe first)", "",
    ...fs.flatMap((f, i) => [`${i + 1}. [${f.sev.toUpperCase()}] ${f.t} (${f.src}, ${f.file})`, `   - Evidence: ${f.ev}`, `   - Fix: ${f.fix}`, ...(advisory(f.rule) ? [`   - Advisory: ${advisory(f.rule)}`] : [])]), "", "## Scan coverage", "", ...Object.entries(r.coverage).map(([k, v]) => `- ${k}: ${v}`), "- Not covered: Git history beyond the last 100 commits, binary and container artefacts, runtime behaviour", "", "Automated findings need human review. This is not a guarantee of safety."].join("\n");
}
export const toSarif = (r: Report) => ({ version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{ tool: { driver: { name: "CodePreflight", rules: r.findings.map((f) => ({ id: f.rule, shortDescription: { text: f.t }, help: { text: f.fix } })) } },
  results: r.findings.map((f) => ({ ruleId: f.rule, level: LEVEL[f.sev], message: { text: `${f.t}: ${f.ev}` }, locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, ...(f.line ? { region: { startLine: f.line } } : {}) } }], partialFingerprints: { "codepreflight/v1": f.id } })) }] });
export function exportReport(r: Report, acc: Record<string, string>, fmt: "json" | "sarif" | "md" | "pdf") {
  const blob = fmt === "pdf" ? textToPdf(toMarkdown(r, acc)) : new Blob([fmt === "md" ? toMarkdown(r, acc) : JSON.stringify(fmt === "sarif" ? toSarif(r) : { schema: "codepreflight/v1", report: r }, null, 2)], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `codepreflight.${fmt}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
