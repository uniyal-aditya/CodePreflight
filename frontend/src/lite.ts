/* Lite audit: runs in the browser against public GitHub, OSV and OpenSSF Scorecard APIs. Real data, no backend, no keys.
   It cannot run Trivy or the Git-history scan; those rows are reported as "needs backend", never as clean. */
import { Finding, Report, Sev, SEV, hash, pctOf, getToken } from "./lib";

const GH = "https://api.github.com";
const mk = (rule: string, cat: string, sev: Sev, t: string, file: string, ev: string, fix: string, src: string, conf = "high"): Finding =>
  ({ id: "F-" + hash(`${rule}|${file}|${ev}`), uid: "", cat, sev, conf, t, file, line: null, ev, src, rule, fix, ai: "", st: "open" });

async function gj(u: string) {
  const t = getToken(), r = await fetch(u, { headers: { Accept: "application/vnd.github+json", ...(t ? { Authorization: "Bearer " + t } : {}) } });
  if (r.status === 403 || r.status === 429) throw new Error("GitHub rate limit reached (60 requests per hour without a token). Try again later or use the full backend.");
  if (r.status === 404) throw new Error("Repository not found, or it is private. Private repos need the full backend with GitHub login.");
  if (!r.ok) throw new Error(`GitHub error ${r.status}`);
  return r.json();
}

export function rules(paths: string[]): [Finding[], Record<string, string>] {
  const low = paths.map((p) => p.toLowerCase()), top = low.filter((p) => !p.includes("/")), names = new Set(low.map((p) => p.split("/").pop()!));
  const out: Finding[] = [], cov: Record<string, string> = {};
  const chk = (id: string, ok: boolean, cat: string, sev: Sev, t: string, fix: string) => { cov[id] = ok ? "pass" : "fail"; if (!ok) out.push(mk(id, cat, sev, t, "(repository)", "Not found", fix, "rules")); };
  chk("DOC-README", top.some((n) => n.startsWith("readme")), "Documentation", "medium", "Missing README", "Add install and usage steps.");
  chk("REL-LICENSE", top.some((n) => /^(license|licence|copying)/.test(n)), "Release readiness", "medium", "Missing LICENSE", "Add a licence (not legal advice).");
  chk("HYG-IGNORE", top.includes(".gitignore"), "Engineering hygiene", "low", "Missing .gitignore", "Exclude generated files and .env.");
  chk("HYG-TESTS", low.some((p) => /^tests?\//.test(p) || /\/tests?\//.test(p) || /(_test\.py|\.(test|spec)\.[jt]sx?)$/.test(p) || /(^|\/)(pytest\.ini|jest\.config\.[jt]s)$/.test(p)), "Engineering hygiene", "medium", "No tests detected", "Add a smoke test and run it in CI.");
  chk("HYG-CI", low.some((p) => p.startsWith(".github/workflows/")), "Engineering hygiene", "low", "No CI workflow", "Add a workflow that runs tests on every push.");
  if (names.has("package.json") && !["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].some((n) => names.has(n))) {
    cov["DEP-LOCK"] = "unknown"; // unknown is never counted as pass
    out.push(mk("DEP-LOCK", "Dependencies", "medium", "No lockfile: versions unresolved", "package.json", "No lockfile", "Commit a lockfile so scans can resolve exact versions.", "rules"));
  }
  return [out, cov];
}

type Dep = [string, string, string, string];
async function deps(o: string, n: string, sha: string, blobs: any[]): Promise<Dep[]> {
  const out: Dep[] = [], t = getToken();
  const get = async (f: string) => { const r = t ? await fetch(`${GH}/repos/${o}/${n}/contents/${f}?ref=${sha}`, { headers: { Accept: "application/vnd.github.raw+json", Authorization: "Bearer " + t } }) : await fetch(`https://raw.githubusercontent.com/${o}/${n}/${sha}/${f}`); if (!r.ok) throw new Error("raw"); return r.text(); };
  // monorepos keep manifests in subfolders: take up to 6 of them, never from node_modules
  const files = blobs.filter((b) => /(^|\/)(requirements\.txt|package-lock\.json)$/.test(b.path) && !b.path.includes("node_modules/") && b.size <= 3_000_000).slice(0, 6);
  for (const b of files) {
    const text = await get(b.path);
    if (b.path.endsWith("requirements.txt")) { for (const l of text.split("\n")) { const m = l.match(/^\s*([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)/); if (m) out.push(["PyPI", m[1], m[2], b.path]); } }
    else for (const [k, v] of Object.entries<any>(JSON.parse(text).packages || {})) if (k.startsWith("node_modules/") && v.version) out.push(["npm", k.split("node_modules/").pop()!, v.version, b.path]);
  }
  return out.slice(0, 500);
}
async function osv(ds: Dep[]): Promise<Finding[]> {
  const r = await fetch("https://api.osv.dev/v1/querybatch", { method: "POST", body: JSON.stringify({ queries: ds.map(([e, n, v]) => ({ package: { name: n, ecosystem: e }, version: v })) }) });
  if (!r.ok) throw new Error("osv");
  const res = (await r.json()).results as any[], out: Finding[] = [], MAP: Record<string, Sev> = { CRITICAL: "critical", HIGH: "high", MODERATE: "medium", MEDIUM: "medium", LOW: "low" };
  let detail = 0;
  for (let i = 0; i < ds.length; i++) for (const v of (res[i]?.vulns || []).slice(0, 3)) {
    let sev: Sev = "medium", sum = "";
    if (detail < 8) { detail++; try { const d = await (await fetch(`https://api.osv.dev/v1/vulns/${v.id}`)).json(); sev = MAP[(d.database_specific?.severity || "").toUpperCase()] || "medium"; sum = (d.summary || "").slice(0, 120); } catch { /* keep default */ } }
    out.push(mk(v.id, "Dependencies", sev, `${ds[i][1]} ${ds[i][2]}`, ds[i][3], `${v.id}: ${sum}`, "Upgrade to a patched version listed in the advisory.", "osv", "medium"));
  }
  return out;
}
const RISK: Record<string, [string, Sev]> = { "Dangerous-Workflow": ["Security", "critical"], "Token-Permissions": ["Security", "high"], "Branch-Protection": ["Security", "high"], "Pinned-Dependencies": ["Dependencies", "medium"], "Code-Review": ["Engineering hygiene", "medium"], Maintained: ["Maintenance", "medium"], "Security-Policy": ["Documentation", "low"] };
async function scorecard(o: string, n: string): Promise<Finding[]> {
  const r = await fetch(`https://api.securityscorecards.dev/projects/github.com/${o}/${n}`);
  if (!r.ok) throw new Error("scorecard");
  return ((await r.json()).checks || []).flatMap((c: any) => {
    const k = RISK[c.name]; if (!k || !(c.score >= 0 && c.score < 5)) return []; // -1 = not evaluated, never a pass or fail
    const sev = c.score >= 3 ? SEV[Math.min(SEV.indexOf(k[1]) + 1, 4)] : k[1];
    return [mk(c.name, k[0], sev, `Scorecard: ${c.name} scored ${c.score}/10`, "(repository)", (c.reason || "").slice(0, 140), `See the OpenSSF Scorecard guidance for ${c.name}.`, "scorecard", "medium")];
  });
}

export async function liteAudit(url: string, stage: (n: number) => void): Promise<Report> {
  const m = url.trim().match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error("Enter a valid GitHub URL: https://github.com/owner/repo");
  const [, o, n] = m; stage(0);
  const info = await gj(`${GH}/repos/${o}/${n}`);
  if (info.private && !getToken()) throw new Error("Private repository: sign in with GitHub and click Enable private repos first.");
  stage(1);
  const sha: string = (await gj(`${GH}/repos/${o}/${n}/commits/${info.default_branch}`)).sha; // pin the audit to one commit
  const tree = await gj(`${GH}/repos/${o}/${n}/git/trees/${sha}?recursive=1`);
  const blobs = (tree.tree as any[]).filter((t) => t.type === "blob"), paths = blobs.map((t) => t.path as string);
  stage(2);
  const [fs, cov] = rules(paths); if (tree.truncated) cov.tree = "unknown";
  const ds = await deps(o, n, sha, blobs).catch(() => null);
  const [ov, sc] = await Promise.allSettled([ds && ds.length ? osv(ds) : Promise.resolve([] as Finding[]), info.private ? Promise.reject(new Error("private")) : scorecard(o, n)]);
  cov.osv = ds === null || ov.status === "rejected" ? "failed" : ds.length ? "ran" : "unknown";
  cov.scorecard = info.private ? "not covered (private repo)" : sc.status === "fulfilled" ? "ran" : "unknown";
  cov.trivy = "needs backend"; cov["secrets-history"] = "needs backend";
  stage(3);
  const all = [...fs, ...(ov.status === "fulfilled" ? ov.value : []), ...(sc.status === "fulfilled" ? sc.value : [])];
  const findings = [...new Map(all.map((f) => [f.id, { ...f, uid: f.id }])).values()].sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev));
  stage(4);
  return { id: `${sha}-${Date.now()}`, url: `https://github.com/${o}/${n}`, commit: sha, at: new Date().toISOString(), mode: "lite", findings, coverage: cov, pct: pctOf(cov) };
}
