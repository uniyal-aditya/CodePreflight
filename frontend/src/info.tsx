import { useState } from "react";
import { H2 } from "./components";

type Node = [string, string, string];
const ARCH: [string, Node[], boolean?][] = [
  ["Client", [["React dashboard", "Score, findings, evidence, coverage, history, rescan comparison and exports.", "Renders only masked, sanitised data."], ["Lite scan (browser)", "Runs repository checks, OSV advisories and OpenSSF Scorecard directly in the browser. No backend or keys.", "Public repos only; checks that cannot run are marked, never clean."]]],
  ["API · FastAPI", [["Gateway", "Validates GitHub URLs, rate-limits, queues audits and returns an audit ID at once.", "Strict URL allow-list, size and time limits."], ["GitHub login", "Supabase Auth with GitHub OAuth unlocks private repositories.", "Token kept in memory, never stored or logged; audits are owner-only."]]],
  ["Collect", [["GitHub API + SHA pin", "Resolves the branch to one commit and reads the file tree.", "Results stay consistent if the repo changes mid-scan."], ["Shallow clone", "Copies the last 100 commits of the pinned repo into a temp folder.", "Hooks disabled; nothing from the repo is ever executed."]], true],
  ["Scan", [["Trivy", "Secrets, vulnerable packages, misconfigurations.", "Argument lists only, timeouts, failures reported as failed."], ["OSV", "Advisory data for pinned dependency versions.", "Unresolvable versions are reported as unknown."], ["Scorecard", "Workflow, branch-protection and maintenance signals.", "Public repos only."], ["Git history", "Pattern scan for secrets committed in recent history.", "Read-only git log with diff drivers disabled."], ["Custom rules", "README, licence, tests, CI, lockfile.", "Each check is pass, fail or unknown."]], true],
  ["Normalise", [["One finding schema", "Every scanner output becomes one structure with a stable fingerprint for rescan matching.", "Secrets masked, repo text sanitised."]]],
  ["Intelligence", [["Scoring engine", "Weighted category scores plus a separate security risk status.", "Unknown is never counted as pass."], ["AI explainer", "Plain-language guidance through an OpenAI-compatible API.", "Redacted input, JSON only, grounding check, scanner text as fallback."]]],
  ["Storage · Supabase", [["Postgres", "Audits, findings, status history and scan tools.", "Row-level security plus owner checks in the API."], ["Reports", "JSON, SARIF, Markdown and PDF export.", "Generated from stored findings."]]],
];
const LIMITS: [string, string][] = [
  ["Incomplete detection or false negatives", "Several engines; the coverage panel shows what ran and what did not"],
  ["False positives", "Confidence on every finding; accepting a risk needs a logged reason"],
  ["Missing lockfiles", "Dependency checks are marked unknown, never pass"],
  ["Secrets in Git history", "Last 100 commits scanned by pattern in the full backend; older history is listed as not covered"],
  ["Binaries and runtime behaviour", "Listed as not covered or out of scope"],
  ["AI hallucination", "The AI sees only scanner findings; output with invented versions or line numbers is rejected"],
  ["Prompt injection and data leakage", "Repo text is treated as data; secrets are masked before storage and AI requests"],
  ["Provider dependency", "Any OpenAI-compatible API through configuration"],
  ["Repo changes mid-scan", "Every audit is pinned to a commit SHA"],
  ["Private repo access", "GitHub login via Supabase; token kept in memory; audits are owner-only"],
];

export function Info() {
  const [on, setOn] = useState<Node | null>(null);
  return (
    <>
      <section id="architecture" className="mt-14"><H2>Architecture</H2><p className="text-sm text-slate-500">Scanners are the source of truth. The AI only explains.</p>
        <div className="card mt-3">{ARCH.map(([label, nodes, untrusted], i) => (
          <div key={label}>{i > 0 && <div className="my-1.5 text-center text-slate-400">↓</div>}
            <div className={untrusted ? "rounded-xl border border-dashed border-slate-400 p-3" : ""}>
              <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">{label}{untrusted && " · untrusted input, static inspection only"}</p>
              <div className="flex flex-wrap gap-2">{nodes.map((n) => <button key={n[0]} onClick={() => setOn(n)} className={`min-w-36 flex-1 rounded-xl border p-3 text-left text-sm font-semibold transition hover:border-slate-900 ${on === n ? "border-slate-900 bg-white" : "border-stone-200 bg-stone-50"}`}>{n[0]}</button>)}</div>
            </div></div>))}
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-slate-500">{on ? <><b className="text-slate-900">{on[0]}</b> — {on[1]}<br />Safeguard: {on[2]}</> : "Select a component to see what it does and how it is protected."}</div>
        </div></section>
      <section className="mt-14"><H2>Limitations and how CodePreflight handles them</H2>
        <div className="card mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th>#</th><th>Limitation</th><th>Handling</th></tr></thead><tbody>
          {LIMITS.map(([l, f], i) => <tr key={l} className="border-t border-stone-100"><td className="py-2 pr-3">{i + 1}</td><td className="pr-3">{l}</td><td className="text-slate-600">{f}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
