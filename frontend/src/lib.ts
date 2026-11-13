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
async function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const s = sb ? (await sb.auth.getSession()).data.session : null;
  if (s) { h.Authorization = "Bearer " + s.access_token; if (ghToken) h["X-GitHub-Token"] = ghToken; }
  return h;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: await headers() });
  let j: any = null; try { j = await r.json(); } catch { /* non-JSON */ }
  if (!r.ok) throw new Error(j?.detail || `Request failed (${r.status})`);
  return j as T;
}
const toFinding = (f: any): Finding => ({ id: "F-" + f.fingerprint.slice(0, 6).toUpperCase(), uid: f.id, cat: f.category, sev: f.severity, conf: f.confidence, t: f.title, file: f.file_path, line: f.line_number, ev: f.evidence, src: f.source, rule: f.rule_id, fix: f.recommendation, ai: f.ai ? `${f.ai.explanation} ${(f.ai.steps || []).join(" ")} ${f.ai.priority_reason || ""}` : "", st: f.status });
export const reportFromAudit = (a: any, url: string): Report => ({ id: a.id, sid: a.id, url, commit: a.commit_sha, at: a.completed_at || a.started_at, mode: "full", findings: (a.findings || []).map(toFinding), coverage: a.coverage || {}, pct: a.coverage_pct || 0 });
export async function fullAudit(url: string, stage: (n: number) => void): Promise<Report> {
  const j = await api<{ audit_id: string }>("/api/v1/audits", { method: "POST", body: JSON.stringify({ repository_url: url }) });
  for (let n = 0; n < 200; n++) {
    await sleep(1500); const a = await api<any>(`/api/v1/audits/${j.audit_id}`); stage(Math.min(3, 1 + Math.floor(n / 2)));
    if (a.status === "failed") throw new Error("Scan failed: " + (a.coverage?.error || "unknown error"));
    if (a.status === "completed") return reportFromAudit(a, url);
  }
  throw new Error("The scan timed out.");
}
