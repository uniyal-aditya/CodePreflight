import { CountUp, PageTitle, Reveal } from "../ui";
import { JOURNEY, TEAM } from "../content";

const STACK = ["React", "TypeScript", "Vite", "Tailwind CSS", "FastAPI", "Python", "Supabase", "Trivy", "Gitleaks", "OSV", "OpenSSF Scorecard", "Vercel", "Railway"];

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <PageTitle kicker="About" title="Built to make shipping less scary">CodePreflight started with one question: how do you know a project is really ready to share? We built the answer for CodeSprint 2026.</PageTitle>
      <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">{([[5, "", "checkers"], [4, "", "report formats"], [6, "", "build phases"], [25, "+", "automated tests"]] as [number, string, string][]).map(([n, s, l]) => <div key={l} className="card !p-5"><b className="block text-4xl tracking-tighter"><CountUp to={n} suffix={s} /></b><span className="text-sm text-slate-500">{l}</span></div>)}</div>

      <h2 className="mt-16 text-center text-3xl font-bold tracking-tight">Our journey</h2><p className="mt-2 text-center text-slate-500">Six steps, each one built, tested and fixed before the next.</p>
      <ol className="relative mx-auto mt-10 max-w-2xl space-y-8 border-l-2 border-stone-200 pl-8">{JOURNEY.map(([t, d], i) => (
        <Reveal key={t} delay={i * 60}><li className="relative"><span className="absolute -left-[2.85rem] grid h-8 w-8 place-items-center rounded-full border-2 border-slate-900 bg-white text-sm font-bold">{i + 1}</span><h3 className="text-lg font-semibold">{t}</h3><p className="mt-1 text-slate-600">{d}</p></li></Reveal>))}</ol>

      <h2 className="mt-16 text-center text-3xl font-bold tracking-tight">Meet Team Limitless Arise</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{TEAM.map(([n, r, i], k) => <Reveal key={n} delay={k * 60}><div className="card flex items-center gap-4"><span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-slate-900 text-lg font-semibold text-white">{i}</span><div><b>{n}</b><p className="text-sm text-slate-500">{r}</p></div></div></Reveal>)}</div>

      <h2 className="mt-16 text-center text-3xl font-bold tracking-tight">What it is built with</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{STACK.map((s) => <span key={s} className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm">{s}</span>)}</div>
      <p className="mt-10 text-center text-sm text-slate-400">Idea → MVP → Open source → Pitch. This is just the beginning.</p>
    </div>
  );
}
