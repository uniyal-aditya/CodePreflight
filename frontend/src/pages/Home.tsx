import { useEffect, useState } from "react";
import { Bug, FileText, GraduationCap, Lock, MessageSquare, RefreshCw, ShieldCheck, Users, Wrench } from "lucide-react";
import { Link } from "../router";
import { ScanForm } from "../ScanForm";
import { CountUp, Mascot, Reveal, Slideshow } from "../ui";
import { FAQ, SLIDES } from "../content";

const WORDS = ["ship", "share", "demo", "launch", "publish"];
const FEATURES: [JSX.Element, string, string][] = [
  [<Bug className="h-6 w-6" />, "Finds real problems", "Leaked keys, tools with known holes and unsafe settings, found by five different checkers."],
  [<ShieldCheck className="h-6 w-6" />, "Shows its proof", "Every problem lists where it is, what we saw (hidden if secret) and which checker found it."],
  [<Wrench className="h-6 w-6" />, "Tells you how to fix it", "Plain steps, and a warning when a fix means a big version change."],
  [<MessageSquare className="h-6 w-6" />, "Has an AI helper", "Ask questions about your own results in the chat bubble. It only uses what was found."],
  [<RefreshCw className="h-6 w-6" />, "Proves your fixes worked", "Check again and see what was fixed, what is still open and what is new."],
  [<FileText className="h-6 w-6" />, "Gives you a report", "Download it as a PDF, Markdown, JSON or SARIF file to share with your team or judges."],
];

export default function Home() {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setInterval(() => setW((x) => (x + 1) % WORDS.length), 2400); return () => clearInterval(t); }, []);
  return (
    <>
      <section className="relative px-4 pb-14 pt-14 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(#d6d6d0_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,#000_25%,transparent_72%)]" />
        <div className="mx-auto mb-3 w-fit animate-float"><Mascot size={110} /></div>
        <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-slate-500">CodeSprint 2026 · Team Limitless Arise</span>
        <h1 className="mt-5 text-5xl font-bold tracking-tighter sm:text-7xl">Know before you<br /><span key={w} className="inline-block animate-word text-slate-400">{WORDS[w]}.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 sm:text-xl">Pilots check the plane before every flight. CodePreflight checks your project before you share it, and tells you exactly what to fix.</p>
        <div className="mt-8"><ScanForm big /></div>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Your code is never run</li><li className="flex items-center gap-1.5"><Lock className="h-4 w-4" />Secrets are hidden</li><li className="flex items-center gap-1.5"><Users className="h-4 w-4" />Works with private projects</li>
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10"><Reveal>
        <h2 className="text-center text-3xl font-bold tracking-tight">How it works, in five easy steps</h2><p className="mb-6 mt-2 text-center text-slate-500">Press the arrows, or just wait. It plays by itself.</p>
        <Slideshow slides={SLIDES} /></Reveal></section>

      <section className="mx-auto max-w-5xl px-4 py-10"><Reveal><div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
        {([[5, "", "checkers working together"], [4, "", "report formats"], [5, "", "steps from link to fix"], [25, "+", "automated tests"]] as [number, string, string][]).map(([n, s, l]) => (
          <div key={l} className="card !p-6"><b className="block text-5xl tracking-tighter"><CountUp to={n} suffix={s} /></b><span className="text-sm text-slate-500">{l}</span></div>))}</div></Reveal></section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need before you share</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([i, t, d], k) => (
          <Reveal key={t} delay={k * 70}><div className="card h-full transition hover:-translate-y-1 hover:shadow-md"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-stone-100">{i}</div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div></Reveal>))}</div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10"><h2 className="text-center text-3xl font-bold tracking-tight">Made for people who build</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">{([["Students", "Learn good habits and catch missing basics before you hand in or present your project."], ["Open-source maintainers", "See repository health, tool risks and security habits in one place."], ["Small teams", "Agree on what ready means and track it from one check to the next."]] as [string, string][]).map(([t, d], k) => (
          <Reveal key={t} delay={k * 90}><div className="card h-full"><GraduationCap className="mb-3 h-6 w-6" /><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-500">{d}</p></div></Reveal>))}</div></section>

      <section className="mx-auto max-w-3xl px-4 py-10"><h2 className="text-center text-3xl font-bold tracking-tight">Questions people ask</h2>
        <div className="mt-6 space-y-3">{FAQ.map(([q, a]) => <details key={q} className="card group !p-0"><summary className="cursor-pointer list-none px-5 py-4 font-semibold marker:content-none">{q}<span className="float-right text-slate-400 transition group-open:rotate-45">+</span></summary><p className="px-5 pb-4 text-slate-600">{a}</p></details>)}</div>
        <p className="mt-4 text-center text-sm text-slate-500">Want to learn the words? Visit <Link to="/learn" className="underline">Learn</Link>.</p></section>

      <section className="mx-auto max-w-5xl px-4 py-10"><Reveal><div className="rounded-3xl bg-slate-900 px-6 py-12 text-center text-white">
        <div className="mx-auto mb-3 w-fit"><Mascot size={80} mood="happy" /></div><h2 className="text-3xl font-bold tracking-tight">Ready for your preflight check?</h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-300">It takes about a minute. Paste a link and Pip does the rest.</p>
        <Link to="/scan" className="mt-6 inline-block rounded-2xl bg-white px-7 py-3.5 text-lg font-semibold text-slate-900 transition hover:-translate-y-0.5">Start my check</Link></div></Reveal></section>
    </>
  );
}
