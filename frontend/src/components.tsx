import { memo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Finding, SEV, SEVC, Sev, score } from "./lib";

export const Chip = ({ sev }: { sev: Sev }) => <span className={`chip ${SEVC[sev]}`}>{sev}</span>;
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="card"><p className="mb-2 text-sm text-slate-500">{title}</p>{children}</div>;
export const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="pb-1 pt-6 text-2xl font-bold tracking-tight">{children}</h2>;

export function Ring({ v }: { v: number }) {
  const c = 2 * Math.PI * 54;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="-rotate-90"><circle cx="60" cy="60" r="54" fill="none" strokeWidth="10" className="stroke-stone-200" />
        <circle cx="60" cy="60" r="54" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-slate-900 transition-all duration-700" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} /></svg>
      <b className="absolute inset-0 grid place-items-center text-4xl">{v}</b>
    </div>
  );
}

const STEPS = ["Connect", "Collect", "Scan", "Normalise", "Guide"];
export const Pipeline = memo(({ stage }: { stage: number }) => (
  <div className="mx-auto mb-4 flex max-w-xl gap-1.5" role="status" aria-live="polite">
    {STEPS.map((s, i) => <div key={s} className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs transition ${i < stage ? "border-emerald-600 text-emerald-700" : i === stage ? "animate-pulse border-slate-900 font-semibold" : "border-stone-200 text-slate-400"}`}>{i < stage ? "✓ " : ""}{s}</div>)}
  </div>
));

export const Summary = memo(({ F, acc, pct }: { F: Finding[]; acc: Record<string, string>; pct: number }) => {
  const s = score(F, acc);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Repository Readiness"><Ring v={s.tot} /><p className="mt-2 text-center text-xs text-slate-500">Coverage {pct}% · unknown is not counted as pass</p></Card>
      <Card title="Security Risk Status"><span className={`chip mt-3 inline-block text-base ${SEVC[s.top as Sev]}`}>{s.top} risk</span>
        <p className="mt-3 text-sm text-slate-500">{SEV.map((x) => `${x}: ${s.open.filter((f) => f.sev === x).length}`).join(" · ")}</p>
        <p className="mt-2 text-xs text-slate-400">Separate from the score, so one number never hides a critical issue.</p></Card>
      <Card title="Category scores">{Object.entries(s.cs).map(([c, v]) => <div key={c} className="my-2 flex items-center gap-2 text-xs"><span className="w-32">{c}</span><div className="h-1.5 flex-1 rounded-full bg-stone-200"><div className="h-full rounded-full bg-slate-900" style={{ width: `${v}%` }} /></div><em className="w-7 text-right not-italic">{v}</em></div>)}</Card>
    </div>
  );
});

type FV = { F: Finding[]; acc: Record<string, string>; aiMap: Record<string, { text: string; fb: boolean }>; sel: string | null; setSel: (s: string) => void; flt: string; setFlt: (s: string) => void; onExplain: (f: Finding) => void; onAccept: (f: Finding, r: string) => void; clean: boolean };
export function FindingsView({ F, acc, aiMap, sel, setSel, flt, setFlt, onExplain, onAccept, clean }: FV) {
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const list = F.filter((f) => flt === "all" || (flt === "accepted" ? acc[f.id] : f.sev === flt)).sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev));
  const cur = F.find((f) => f.id === sel), ai = cur ? aiMap[cur.id]?.text ?? cur.ai : "";
  const n = (k: string) => (k === "all" ? F.length : k === "accepted" ? Object.keys(acc).length : F.filter((f) => f.sev === k).length);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">{["all", ...SEV.slice(0, 4), "accepted"].map((x) => <button key={x} onClick={() => setFlt(x)} className={`ghost ${flt === x ? "!border-slate-900 !bg-slate-900 !text-white" : ""}`}>{x} · {n(x)}</button>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>{list.length ? list.map((f) => (
          <button key={f.id} onClick={() => setSel(f.id)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-slate-900 ${sel === f.id ? "border-slate-900" : "border-stone-200"}`}>
            <Chip sev={f.sev} /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{f.t}</b><small className="text-slate-500">{f.id} · {f.file}{f.line ? `:${f.line}` : ""} · {f.src}{acc[f.id] ? " · accepted" : ""}</small></span>
          </button>)) : <p className="card text-sm text-slate-500">{F.length ? "No findings in this filter." : clean ? "No findings from the checks that ran. Check the coverage panel: checks that did not run are not a clean result." : "No findings were reported."}</p>}</div>
        <div className="card lg:sticky lg:top-20 lg:self-start">{cur ? (<>
          <Chip sev={cur.sev} /> <span className="text-xs text-slate-500">{cur.id} · confidence {cur.conf} · rule {cur.rule}</span>
          <h3 className="my-3 text-lg font-semibold">{cur.t}</h3>
          <p className="text-xs text-slate-500">Evidence (masked)</p><pre className="my-2 overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs">{cur.ev}</pre>
          <div className="my-3 border-l-4 border-slate-900 pl-3 text-sm">
            <span className="mr-2 rounded-full border border-slate-300 px-2 py-0.5 text-[11px]">grounded on {cur.id}</span><span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px]">{cur.src}</span><br />
            {ai ? <>{ai}{aiMap[cur.id]?.fb && <span className="text-slate-500"> (scanner text; AI needs the full backend and a key)</span>}</>
              : <button className="ghost mt-2 inline-flex items-center gap-1" disabled={busy} onClick={async () => { setBusy(true); await onExplain(cur); setBusy(false); }}><Sparkles className="h-4 w-4" />{busy ? "Explaining…" : "Explain"}</button>}
          </div>
          <b className="text-sm">Recommended fix</b><p className="mb-3 text-sm">{cur.fix}</p>
          {acc[cur.id] ? <p className="text-xs text-slate-500">Accepted: {acc[cur.id]}</p> : (<>
            <input className="mb-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder="Reason to accept this risk (min 5 characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="ghost" disabled={reason.trim().length < 5} onClick={() => { onAccept(cur, reason.trim()); setReason(""); }}>Accept risk</button></>)}
        </>) : <p className="text-sm text-slate-500">Select a finding to see evidence and guidance.</p>}</div>
      </div>
    </>
  );
}

export const NextSteps = memo(({ open }: { open: Finding[] }) => {
  const b = open.filter((f) => f.sev === "critical" || f.sev === "high"), m = open.filter((f) => f.sev === "medium" || f.sev === "low"), ok = !b.length && !m.length;
  const banner = b.length ? ["Not ready to ship", `Fix the ${b.length} critical or high finding(s) first.`, "border-l-red-600"] : m.length ? ["Almost there", "No blockers left. Work through the remaining recommendations.", "border-l-amber-500"] : ["Ready to ship", "No open findings above informational. Time to harden and release.", "border-l-emerald-600"];
  const S: [string, string, string][] = [
    ["Fix the blockers", b.length ? b.slice(0, 3).map((f) => `${f.id} ${f.t}`).join("; ") : "No critical or high findings are open.", b.length ? "now" : "done"],
    ["Rescan to verify", "A fix only counts once a new scan stops detecting it.", b.length || m.length ? "next" : "done"],
    ["Clear the recommendations", m.length ? `${m.length} medium or low item(s), starting with ${m[0].t}.` : "Nothing left to clear.", m.length ? (b.length ? "later" : "now") : "done"],
    ["Harden the repository", "Add SECURITY.md, enable branch protection and Dependabot, pin GitHub Actions to commit SHAs.", ok ? "now" : "later"],
    ["Prepare the release", "Tag a version, write release notes, add the CodePreflight badge, and have a person review licences.", ok ? "next" : "later"],
    ["Keep it healthy", "Turn on scheduled scans and pull-request checks, and export an SBOM for users.", "later"]];
  return (
    <div className="card">
      <div className={`mb-2 rounded-xl border border-l-4 border-stone-200 bg-stone-50 p-4 ${banner[2]}`}><b className="text-lg">{banner[0]}</b><p className="text-sm text-slate-500">{banner[1]}</p></div>
      {S.map(([t, d, st], i) => <div key={t} className={`flex items-start gap-3 border-t border-stone-200 py-3 ${st === "later" ? "opacity-60" : ""}`}>
        <i className={`grid h-6 w-6 flex-none place-items-center rounded-full border text-xs not-italic ${st === "now" ? "border-slate-900 bg-slate-900 text-white" : st === "done" ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300"}`}>{st === "done" ? "✓" : i + 1}</i>
        <div className="flex-1"><b className="text-sm">{t}</b><p className="text-sm text-slate-500">{d}</p></div><span className="text-[11px] uppercase tracking-wide text-slate-400">{st}</span></div>)}
    </div>
  );
});

export const Coverage = memo(({ cov }: { cov: Record<string, string> }) => {
  const rows = [...Object.entries(cov), ["Git history beyond the last 100 commits", "not covered"], ["Binary / container artefacts", "not covered"], ["Runtime behaviour", "out of scope"]];
  return <div className="card overflow-x-auto"><table className="w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-b border-stone-100 last:border-0"><td className="py-2">{k}</td><td className={["pass", "ran"].includes(v) ? "text-emerald-700" : "text-slate-500"}>{v}</td></tr>)}</tbody></table></div>;
});

export type HItem = { id: string; url: string; commit: string; at: string; score: number | null; risk: string; status: string };
export function History({ items, onOpen, onCompare }: { items: HItem[]; onOpen: (id: string) => void; onCompare: (newer: string, older: string) => Promise<string> }) {
  const [picked, setPicked] = useState<string[]>([]), [msg, setMsg] = useState("");
  return (
    <section id="history" className="mt-10"><H2>Scan history</H2><p className="mb-3 text-sm text-slate-500">Open a previous audit, or tick two to compare them.</p>
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th /><th>Repository</th><th>Commit</th><th>Score</th><th>Risk</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
        {items.map((h) => <tr key={h.id} className="border-t border-stone-100"><td><input type="checkbox" aria-label="select" checked={picked.includes(h.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, h.id] : p.filter((x) => x !== h.id)))} /></td>
          <td className="py-2">{h.url.replace("https://github.com/", "")}</td><td><code>{h.commit.slice(0, 7)}</code></td><td>{h.score ?? "–"}</td><td>{h.risk || "–"}</td><td className={h.status === "failed" ? "text-red-700" : h.status === "completed" ? "text-slate-500" : "text-amber-700"}>{h.status}</td><td>{new Date(h.at).toLocaleString()}</td><td><button className="ghost disabled:opacity-40" disabled={h.status !== "completed"} onClick={() => onOpen(h.id)}>Open</button></td></tr>)}
        {!items.length && <tr><td colSpan={8} className="py-3 text-slate-500">No audits yet. Run one above.</td></tr>}</tbody></table></div>
      <button className="ghost mt-3" onClick={async () => { if (picked.length !== 2) return setMsg("Tick exactly two audits."); const [n, o] = items.filter((h) => picked.includes(h.id)).map((h) => h.id); try { setMsg("Newer vs older: " + (await onCompare(n, o))); } catch (e) { setMsg((e as Error).message); } }}>Compare selected</button>
      <span className="ml-3 text-sm text-slate-500">{msg}</span>
    </section>
  );
}
