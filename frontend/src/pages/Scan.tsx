import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, KeyRound, Lock, Search } from "lucide-react";
import { Link } from "../router";
import { useApp } from "../state";
import { ScanForm } from "../ScanForm";
import { Mascot, PageTitle, Reveal } from "../ui";

const STEPS = ["Pick a project", "We check it", "Read the results", "Fix and check again"];
const CHECKLIST = ["Opening your project", "Reading your files", "Looking for secrets and weak spots", "Sorting what we found", "Writing it in plain words"];
const TIPS = ["Git remembers old versions. A key you deleted last month may still be in there.", "A lockfile makes sure everyone uses the same version of every tool.", "Pilots call this a preflight check. It is boring when everything is fine, and very useful when it is not.", "Most leaked keys are not stolen by hackers. They are posted by accident.", "Small projects can have hundreds of hidden tools underneath.", "Fixing the red problems first gives you the biggest safety win."];

const help = (e: string) => /rate limit/i.test(e) ? "GitHub lets visitors make only 60 requests an hour without signing in. Wait a little, or sign in with GitHub to get more."
  : /private/i.test(e) ? "This looks like a private project. Press Continue with GitHub at the top, then choose Enable private repos."
  : /not found/i.test(e) ? "Check the spelling of the link. If the project is private, sign in with GitHub first."
  : /size|MB/i.test(e) ? "This project is very big. Try a smaller one, or ask the site owner to raise the size limit." : "Try again in a moment. If it keeps happening, tell the team what you were checking.";

export default function Scan() {
  const a = useApp(), [tip, setTip] = useState(0), step = a.busy ? 1 : 0;
  useEffect(() => { if (!a.busy) return; const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 4500); return () => clearInterval(t); }, [a.busy]);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <PageTitle kicker="Preflight check" title={a.busy ? "Pip is checking your project" : "Let's check your project"}>{a.busy ? "This usually takes about a minute. You can watch the checklist." : "Paste a GitHub link, or pick one of your own projects after you sign in."}</PageTitle>
      <ol className="mx-auto mb-10 grid max-w-2xl grid-cols-4 gap-2" aria-label="Progress">{STEPS.map((s, i) => (
        <li key={s} aria-current={i === step} className="text-center"><div className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold transition ${i < step ? "border-emerald-600 bg-emerald-600 text-white" : i === step ? "border-slate-900 bg-slate-900 text-white" : "border-stone-300 text-slate-400"}`}>{i < step ? "✓" : i + 1}</div>
          <p className={`mt-1.5 text-xs ${i === step ? "font-semibold" : "text-slate-400"}`}>{s}</p></li>))}</ol>

      {a.busy ? (
        <div className="card mx-auto max-w-2xl">
          <div className="flex items-center gap-5"><Mascot mood="thinking" size={92} />
            <div className="flex-1"><p className="font-semibold">{a.url.replace("https://github.com/", "") || "Your project"}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-slate-900 transition-all duration-700" style={{ width: `${Math.min(100, (a.stage + 1) * 20)}%` }} /></div></div></div>
          <ul className="mt-6 space-y-3" role="status" aria-live="polite">{CHECKLIST.map((c, i) => (
            <li key={c} className={`flex items-center gap-3 text-sm transition ${i > a.stage ? "text-slate-300" : ""}`}>
              {i < a.stage ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : i === a.stage ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> : <span className="h-5 w-5 rounded-full border-2 border-stone-200" />}
              <span className={i === a.stage ? "font-semibold" : ""}>{c}</span></li>))}</ul>
          <p key={tip} className="mt-6 animate-fade-up rounded-xl bg-stone-50 px-4 py-3 text-sm text-slate-600"><b>Did you know?</b> {TIPS[tip]}</p>
          {a.note && <p className="mt-3 text-xs text-amber-700">{a.note}</p>}
        </div>
      ) : (
        <>
          <ScanForm big />
          {a.err && <p className="mx-auto mt-2 max-w-2xl rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-600"><b>What can I do?</b> {help(a.err)}</p>}
          {a.rep && <p className="mt-6 text-center text-sm text-slate-500">Your last result is still here. <Link to="/report" className="font-semibold underline">Open the report</Link></p>}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">{([[<Search className="h-6 w-6" />, "What we read", "Your files, your list of tools and your recent Git history. Nothing is run."], [<KeyRound className="h-6 w-6" />, "What we look for", "Leaked keys, tools with known holes, unsafe settings and missing basics."], [<Lock className="h-6 w-6" />, "What we keep private", "Secrets are hidden. Your GitHub access stays in memory and is never saved."]] as [JSX.Element, string, string][]).map(([i, t, d], k) => (
            <Reveal key={t} delay={k * 80}><div className="card h-full"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-stone-100">{i}</div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div></Reveal>))}</div>
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-400"><ClipboardCheck className="h-4 w-4" />Not sure what the words mean? Visit <Link to="/learn" className="underline">Learn</Link>.</p>
        </>
      )}
    </div>
  );
}
