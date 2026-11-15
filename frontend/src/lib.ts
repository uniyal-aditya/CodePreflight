import { createClient } from "@supabase/supabase-js";

export const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const sb = import.meta.env.VITE_SUPABASE_URL ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
export const SEV = ["critical", "high", "medium", "low", "info"] as const;
export type Sev = (typeof SEV)[number];
export const W: Record<Sev, number> = { critical: 60, high: 30, medium: 15, low: 5, info: 0 };
export const CATS: Record<string, number> = { Security: 30, Dependencies: 20, Documentation: 15, "Engineering hygiene": 15, Maintenance: 10, "Release readiness": 10 };
export const SEVC: Record<Sev, string> = { critical: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800", medium: "bg-amber-100 text-amber-800", low: "bg-sky-100 text-sky-800", info: "bg-stone-100 text-stone-600" };

export type Finding = { id: string; uid: string; cat: string; sev: Sev; conf: string; t: string; file: string; line: number | null; ev: string; src: string; rule: string; fix: string; ai: string; st: string };
export type Report = { id: string; url: string; commit: string; at: string; mode: "lite" | "full"; findings: Finding[]; coverage: Record<string, string>; pct: number; sid?: string };

export const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6).toUpperCase(); };
export const pctOf = (c: Record<string, string>) => { const v = Object.values(c); return v.length ? Math.round((100 * v.filter((x) => ["pass", "fail", "ran"].includes(x)).length) / v.length) : 0; };
export const validUrl = (u: string) => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(u.trim());
/** Turns technical server errors into sentences a person can act on. Returns null when it has nothing better to say. */
export function friendlyError(msg: string): string | null {
  if (/PGRST|schema cache|column .* of/i.test(msg)) return "The database is missing a recent update. The site owner needs to run the latest backend/schema.sql in Supabase.";
  if (/Invalid API key|bad_jwt|Invalid JWT/i.test(msg)) return "The server could not sign in to its database. The site owner needs to check the Supabase key.";
  if (/rate limit|Too many/i.test(msg)) return "Too many checks in a short time. Please wait a little and try again.";
  return null;
}
const major = (v: string) => (v.trim().match(/^v?(\d+)/) || [])[1];
/** Same advice as the backend: prefer a fix inside the current major version, and warn when the fix is a major upgrade. */
export function fixAdvice(installed: string, fixed: string[]): string {
  const opts = fixed.map((x) => x.trim()).filter(Boolean);
  if (!opts.length) return "Upgrade to a patched version listed in the advisory.";
  const same = opts.find((x) => major(x) === major(installed));
  return same ? `Upgrade to ${same} (same major version, low risk).` : `Upgrade to ${opts[0]} (a major version change from ${installed}: read the changelog for breaking changes).`;
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WHY: Record<Sev, string> = { critical: "Exploitable immediately and can expose accounts or data.", high: "Serious weakness that should be fixed before release.", medium: "Meaningful risk that should be fixed soon.", low: "Lower impact; improves quality and trust.", info: "For awareness only." };
export const explainLocal = (f: Finding) => `${f.t} was reported by ${f.src} (rule ${f.rule}) in ${f.file}${f.line ? ":" + f.line : ""}. ${WHY[f.sev]} ${f.fix}`;

export function score(F: Finding[], acc: Record<string, string>) {
  const open = F.filter((f) => !acc[f.id]), cs: Record<string, number> = {}; let tot = 0;
  for (const c in CATS) { cs[c] = Math.max(0, 100 - open.filter((f) => f.cat === c).reduce((a, f) => a + W[f.sev], 0)); tot += (cs[c] * CATS[c]) / 100; }
  return { tot: Math.round(tot), cs, top: SEV.slice(0, 4).find((s) => open.some((f) => f.sev === s)) || "low", open };
}

/* ----- full mode: FastAPI backend ----- */
let ghToken: string | null = null; // GitHub token lives in memory only
export const setProviderToken = (t: string | null) => { ghToken = t; };
export const hasToken = () => !!ghToken;
export const getToken = () => ghToken;
export type Repo = { full_name: string; private: boolean };
/** The signed-in user's repositories. With a GitHub token this includes private repos when `repo` access was granted; otherwise it lists their public repos.
 *  repoScope: true/false when GitHub reports the token's scopes, null when unknown. */
export async function listRepos(login?: string): Promise<{ repos: Repo[]; repoScope: boolean | null }> {
  const t = ghToken;
  const u = t ? "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member" : login ? `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed` : null;
  if (!u) return { repos: [], repoScope: null };
  const r = await fetch(u, { headers: { Accept: "application/vnd.github+json", ...(t ? { Authorization: "Bearer " + t } : {}) } });
  if (!r.ok) return { repos: [], repoScope: null };
  const scopes = r.headers.get("x-oauth-scopes");
  const repos = (await r.json()).map((x: any) => ({ full_name: x.full_name, private: !!x.private }));
  return { repos, repoScope: t && scopes !== null ? scopes.split(",").map((x) => x.trim()).includes("repo") : null };
}
async function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const s = sb ? (await sb.auth.getSession()).data.session : null;
  if (s) { h.Authorization = "Bearer " + s.access_token; if (ghToken) h["X-GitHub-Token"] = ghToken; }
  return h;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: await headers() });
  let j: any = null; try { j = await r.json(); } catch { /* non-JSON */ }
  if (!r.ok) { const d = typeof j?.detail === "string" ? j.detail : j?.detail ? "That request was not valid." : ""; throw new Error(friendlyError(d) ?? (d || `Request failed (${r.status})`)); }
  return j as T;
}
const toFinding = (f: any): Finding => ({ id: "F-" + f.fingerprint.slice(0, 6).toUpperCase(), uid: f.id, cat: f.category, sev: f.severity, conf: f.confidence, t: f.title, file: f.file_path, line: f.line_number, ev: f.evidence, src: f.source, rule: f.rule_id, fix: f.recommendation, ai: f.ai ? `${f.ai.explanation} ${(f.ai.steps || []).join(" ")} ${f.ai.priority_reason || ""}` : "", st: f.status });
export const reportFromAudit = (a: any, url: string): Report => ({ id: a.id, sid: a.id, url, commit: a.commit_sha, at: a.completed_at || a.started_at, mode: "full", findings: (a.findings || []).map(toFinding), coverage: a.coverage || {}, pct: a.coverage_pct || 0 });
export async function fullAudit(url: string, stage: (n: number) => void): Promise<Report> {
  const j = await api<{ audit_id: string }>("/api/v1/audits", { method: "POST", body: JSON.stringify({ repository_url: url }) });
  for (let n = 0; n < 200; n++) {
    await sleep(1500); const a = await api<any>(`/api/v1/audits/${j.audit_id}`); stage(Math.min(3, 1 + Math.floor(n / 2)));
    if (a.status === "failed") { const e = a.coverage?.error || ""; throw new Error(friendlyError(e) ?? "Scan failed: " + (e || "unknown error")); }
    if (a.status === "completed") return reportFromAudit(a, url);
  }
  throw new Error("The scan timed out.");
}
