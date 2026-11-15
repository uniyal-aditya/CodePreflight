import { useEffect, useState } from "react";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "../router";
import { useApp } from "../state";
import { Chip, Coverage, FindingsView, H2, NextSteps, Ring } from "../components";
import { Confetti, Mascot, SEV_WORDS } from "../ui";
import { explainLocal, Finding, score, SEV } from "../lib";

const LIGHT = ["#dc2626", "#f59e0b", "#10b981"];
const STATES = {
  hold: { title: "Hold at the gate", mood: "worried", on: 0, tone: "border-red-200 bg-red-50" },
  almost: { title: "Almost ready for takeoff", mood: "thinking", on: 1, tone: "border-amber-200 bg-amber-50" },
  ready: { title: "Cleared for takeoff!", mood: "happy", on: 2, tone: "border-emerald-200 bg-emerald-50" },
} as const;

/** One card per affected item. Several advisories for the same package are shown together. */
function FixCard({ g, n }: { g: Finding[]; n: number }) {
  const a = useApp(), [more, setMore] = useState(false), [busy, setBusy] = useState(false), f = g[0];
  const text = g.length > 1 ? `This has ${g.length} separate known problems: ${g.map((x) => x.rule).join(", ")}. They are listed under "Show the proof".` : a.aiMap[f.id]?.text ?? (f.ai || explainLocal(f));
  const fixes = [...new Set(g.map((x) => x.fix))];
  return (
    <div className="card">
      <div className="flex items-start gap-3"><span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">{n}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Chip sev={f.sev} /><span className="text-xs text-slate-500">{SEV_WORDS[f.sev]}</span>{g.length > 1 && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-slate-600">{g.length} related problems</span>}</div>
          <h3 className="mt-1 text-lg font-semibold">{f.t}</h3><p className="text-sm text-slate-500">Where: {f.file}{f.line ? `, line ${f.line}` : ""}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-stone-50 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">What it means</p><p className="text-sm">{text}</p></div>
        <div className="rounded-xl bg-stone-50 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">How to fix it</p>{fixes.map((x) => <p key={x} className="text-sm">{x}</p>)}</div></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {g.length === 1 && !a.aiMap[f.id] && !f.ai && <button className="ghost inline-flex items-center gap-1" disabled={busy} onClick={async () => { setBusy(true); await a.explain(f); setBusy(false); }}><Sparkles className="h-4 w-4" />{busy ? "Thinking…" : "Explain it simply"}</button>}
        <button className="ghost" onClick={() => setMore((m) => !m)}>{more ? "Hide the proof" : "Show the proof"}</button></div>
      {more && <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs">{g.map((x) => `${x.ev}\nFound by: ${x.src} · rule ${x.rule} · confidence ${x.conf}`).join("\n\n")}</pre>}
    </div>
  );
}

export default function Report() {
  const a = useApp(), [view, setViewRaw] = useState<"simple" | "tech">(() => { try { return sessionStorage.getItem("cp.view") === "tech" ? "tech" : "simple"; } catch { return "simple"; } });
  const setView = (v: "simple" | "tech") => { setViewRaw(v); try { sessionStorage.setItem("cp.view", v); } catch { /* storage blocked */ } };
  useEffect(() => { const f = () => setViewRaw("tech"); window.addEventListener("cp:open-technical", f); return () => window.removeEventListener("cp:open-technical", f); }, []);
  const rep = a.rep;
  if (!rep) return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center"><div className="mx-auto w-fit"><Mascot mood="thinking" size={120} /></div><h1 className="mt-4 text-3xl font-bold tracking-tight">No report yet</h1>
      <p className="mt-2 text-slate-500">Check a project first, and your report will show up here.</p><Link to="/scan" className="btn-lg mt-6 inline-block">Check a project</Link></div>);

  const F = rep.findings, s = score(F, a.acc), open = s.open;
  const blockers = open.filter((f) => f.sev === "critical" || f.sev === "high"), rest = open.filter((f) => f.sev === "medium" || f.sev === "low");
  const key = blockers.length ? "hold" : rest.length ? "almost" : "ready", st = STATES[key];
  const sorted = [...open].sort((x, y) => SEV.indexOf(x.sev) - SEV.indexOf(y.sev)), byItem = new Map<string, Finding[]>();
  for (const f of sorted) byItem.set(f.t + "|" + f.file, [...(byItem.get(f.t + "|" + f.file) || []), f]);
  const groups = [...byItem.values()], top = groups.slice(0, 3);
  const cmp = a.prev ? { fixed: a.prev.filter((p) => !F.some((f) => f.id === p.id)).length, still: F.filter((f) => a.prev!.some((p) => p.id === f.id)).length, fresh: F.filter((f) => !a.prev!.some((p) => p.id === f.id)).length } : null;
  const covWords = rep.pct >= 80 ? "We could check almost everything we planned." : rep.pct >= 50 ? "We checked about half. Some checks need the full backend." : "Many checks could not run. Treat this result with care.";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 pt-10">
      {key === "ready" && <Confetti />}
      <div className={`flex flex-col items-center gap-6 rounded-3xl border p-6 sm:flex-row sm:p-8 ${st.tone}`}>
        <Mascot mood={st.mood} size={112} />
        <div className="flex-1 text-center sm:text-left"><p className="text-sm text-slate-500">{rep.url.replace("https://github.com/", "")} · version {rep.commit.slice(0, 7)} · {rep.mode === "full" ? "full check" : "quick check in your browser"}</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tighter">{st.title}</h1>
          <p className="mt-2 text-lg text-slate-600">{key === "hold" ? `We found ${blockers.length} big problem${blockers.length > 1 ? "s" : ""}. Fix ${blockers.length > 1 ? "them" : "it"} before you share this project.` : key === "almost" ? `No big problems. ${rest.length} smaller thing${rest.length > 1 ? "s are" : " is"} left to tidy up.` : "Nothing we could check needs fixing. Great job!"}</p></div>
        <div className="flex gap-2 rounded-2xl bg-white/70 p-3 sm:flex-col" aria-label={`Traffic light: ${key}`}>{LIGHT.map((c, i) => <span key={c} className="h-8 w-8 rounded-full border border-stone-300 transition" style={{ background: i === st.on ? c : "#e7e5e4", boxShadow: i === st.on ? `0 0 14px ${c}` : "none" }} />)}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn flex items-center gap-1 !py-2.5" disabled={a.busy} onClick={a.rescan}><RefreshCw className="h-4 w-4" />Check again</button>
        {(["pdf", "md", "json", "sarif"] as const).map((f) => <button key={f} className="ghost flex items-center gap-1" onClick={() => a.exp(f)}><Download className="h-3.5 w-3.5" />{f === "md" ? "Markdown" : f.toUpperCase()}</button>)}
        <span className="flex-1" />
        <div className="inline-flex rounded-xl border border-stone-300 bg-white p-1 text-sm" role="tablist" aria-label="Detail level">{([["simple", "Simple"], ["tech", "Technical"]] as const).map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 transition ${view === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-stone-100"}`}>{l}</button>)}</div>
      </div>
      {cmp && <div className="card flex flex-wrap justify-around gap-6 text-center">{([["Fixed", cmp.fixed], ["Still open", cmp.still], ["New", cmp.fresh]] as [string, number][]).map(([l, n]) => <div key={l}><b className="block text-3xl">{n}</b><span className="text-sm text-slate-500">{l} since the last check</span></div>)}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card text-center"><p className="text-sm text-slate-500">Readiness score</p><Ring v={s.tot} /><p className="mt-1 text-xs text-slate-400">Out of 100</p></div>
        <div className="card"><p className="text-sm text-slate-500">Problems found</p><b className="mt-2 block text-5xl tracking-tighter">{open.length}</b>
          <div className="mt-3 flex flex-wrap gap-1.5">{SEV.filter((x) => open.some((f) => f.sev === x)).map((x) => <span key={x} className="flex items-center gap-1.5"><Chip sev={x} /><span className="text-sm">{open.filter((f) => f.sev === x).length}</span></span>)}{!open.length && <span className="text-sm text-slate-500">None. Nice!</span>}</div></div>
        <div className="card"><p className="text-sm text-slate-500">What we could check</p><b className="mt-2 block text-5xl tracking-tighter">{rep.pct}%</b><p className="mt-2 text-sm text-slate-500">{covWords} Checks that did not run are never counted as safe.</p></div>
      </div>

      {view === "simple" ? (<>
        <H2>{open.length ? "Fix these first" : "Nothing to fix"}</H2>
        {open.length ? <div className="space-y-4">{top.map((g, i) => <FixCard key={g[0].id} g={g} n={i + 1} />)}</div> : <p className="card text-slate-600">No open problems. Look at the list of what we checked below, to see what this result covers.</p>}
        {groups.length > 3 && <p className="text-sm text-slate-500">…and {groups.length - 3} more. Switch to <button className="underline" onClick={() => setView("tech")}>Technical</button> to see all of them.</p>}
      </>) : (<><span id="findings-anchor" /><H2>All findings</H2>
        <FindingsView F={F} acc={a.acc} aiMap={a.aiMap} sel={a.sel} setSel={a.setSel} flt={a.flt} setFlt={a.setFlt} onExplain={a.explain} onAccept={a.accept} clean={rep.mode === "lite"} /></>)}

      <H2>Your flight checklist</H2><NextSteps open={open} />
      <H2>What we checked</H2><Coverage cov={rep.coverage} />
      <p className="text-center text-sm text-slate-400">Questions? Open the chat bubble in the corner and ask Pip.</p>
    </div>
  );
}
