import { Lock, ShieldCheck, Trash2, Eye } from "lucide-react";
import { Info } from "../info";
import { CHECKERS, SLIDES } from "../content";
import { PageTitle, Reveal, Slideshow } from "../ui";

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <PageTitle kicker="Behind the scenes" title="How CodePreflight works">Five steps from a GitHub link to a project you can trust. Here is everything that happens, in plain words.</PageTitle>
      <Slideshow slides={SLIDES} interval={7000} />

      <h2 className="mt-16 text-center text-3xl font-bold tracking-tight">The five checkers</h2>
      <p className="mt-2 text-center text-slate-500">Different tools notice different things, so we use all of them together.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{CHECKERS.map(([n, d], i) => <Reveal key={n} delay={i * 70}><div className="card h-full"><span className="text-xs font-semibold tracking-widest text-slate-400">0{i + 1}</span><h3 className="mt-1 text-lg font-semibold">{n}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div></Reveal>)}</div>

      <h2 className="mt-16 text-center text-3xl font-bold tracking-tight">How we keep you safe</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{([[<ShieldCheck className="h-6 w-6" />, "We never run your code", "No installing, no building, no starting anything. We only read files."], [<Lock className="h-6 w-6" />, "Secrets stay hidden", "Anything that looks like a key is masked before it is saved, shown or sent to the AI."], [<Eye className="h-6 w-6" />, "No result is not a clean result", "A check that could not run says unknown. We never count it as safe."], [<Trash2 className="h-6 w-6" />, "Your GitHub access is not stored", "It stays in your browser's memory and disappears when you close the tab."]] as [JSX.Element, string, string][]).map(([i, t, d], k) => (
        <Reveal key={t} delay={k * 70}><div className="card flex h-full gap-4"><div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-stone-100">{i}</div><div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div></div></Reveal>))}</div>

      <div className="mt-6"><Info /></div>
    </div>
  );
}
