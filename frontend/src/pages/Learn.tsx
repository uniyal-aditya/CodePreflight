import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CHECKLIST, FAQ, GLOSSARY } from "../content";
import { H2 } from "../components";
import { PageTitle, Reveal } from "../ui";

export default function Learn() {
  const [q, setQ] = useState(""), [done, setDone] = useState<boolean[]>(() => { try { return JSON.parse(localStorage.getItem("cp.checklist") || "[]"); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem("cp.checklist", JSON.stringify(done)); } catch { /* storage blocked */ } }, [done]);
  const terms = GLOSSARY.filter(([t, d]) => (t + d).toLowerCase().includes(q.toLowerCase())), n = CHECKLIST.filter((_, i) => done[i]).length;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <PageTitle kicker="Learn" title="Big words, small explanations">New to security? Start here. No jargon, no stress.</PageTitle>
      <div className="relative mx-auto max-w-md"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search words" placeholder="Type a word you don't know…" className="w-full rounded-2xl border border-stone-300 bg-white py-3.5 pl-11 pr-4 outline-none focus:border-slate-900" /></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{terms.map(([t, d], i) => <Reveal key={t} delay={(i % 4) * 60}><div className="card h-full"><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div></Reveal>)}</div>
      {!terms.length && <p className="mt-6 text-center text-slate-500">No word matches &quot;{q}&quot;. Ask the AI helper in the chat bubble after a check.</p>}

      <H2>Your 5-minute project health checklist</H2>
      <div className="card"><div className="mb-3 flex items-center justify-between text-sm"><span className="text-slate-500">Tick what is true for your project. It is saved on this device.</span><b>{n} of {CHECKLIST.length}</b></div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${(n / CHECKLIST.length) * 100}%` }} /></div>
        <ul className="space-y-2">{CHECKLIST.map((c, i) => <li key={c}><label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-50"><input type="checkbox" className="h-5 w-5 accent-slate-900" checked={!!done[i]} onChange={(e) => setDone((d) => { const x = [...d]; x[i] = e.target.checked; return x; })} /><span className={done[i] ? "text-slate-400 line-through" : ""}>{c}</span></label></li>)}</ul>
        {n === CHECKLIST.length && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">All ticked! Now run a real check to confirm it.</p>}</div>

      <H2>More questions</H2>
      <div className="space-y-3">{FAQ.map(([qq, a]) => <details key={qq} className="card group !p-0"><summary className="cursor-pointer list-none px-5 py-4 font-semibold marker:content-none">{qq}<span className="float-right text-slate-400 transition group-open:rotate-45">+</span></summary><p className="px-5 pb-4 text-slate-600">{a}</p></details>)}</div>
    </div>
  );
}
