import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pip, the preflight robot. The mood changes with the scan result. */
export function Mascot({ mood = "happy", size = 96 }: { mood?: "happy" | "worried" | "thinking"; size?: number }) {
  const mouth = mood === "happy" ? "M44 94 Q60 108 76 94" : mood === "worried" ? "M44 100 Q60 88 76 100" : "M48 96 H72";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Pip, the preflight robot" className={mood === "thinking" ? "animate-float" : ""}>
      <line x1="60" y1="14" x2="60" y2="28" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" /><circle cx="60" cy="12" r="5" fill="#0f172a" />
      <circle cx="60" cy="72" r="38" fill="#fff" stroke="#0f172a" strokeWidth="4" />
      <path d="M24 60 Q60 4 96 60 Z" fill="#0f172a" /><rect x="18" y="56" width="84" height="9" rx="4.5" fill="#0f172a" />
      <circle cx="46" cy="78" r="7" fill="#0f172a" /><circle cx="74" cy="78" r="7" fill="#0f172a" /><circle cx="48" cy="76" r="2" fill="#fff" /><circle cx="76" cy="76" r="2" fill="#fff" />
      <path d={mouth} stroke="#0f172a" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Counts up when it scrolls into view. */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(reduced() ? to : 0), ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduced() || !ref.current || !("IntersectionObserver" in window)) { setN(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect(); const t0 = performance.now();
      const f = (t: number) => { const p = Math.min(1, (t - t0) / 1100); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }, { threshold: 0.4 });
    io.observe(ref.current); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n}{suffix}</span>;
}

/** Fades its content in when it scrolls into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [on, setOn] = useState(reduced()), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (on || !ref.current || !("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(ref.current); return () => io.disconnect();
  }, [on]);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition duration-700 ${on ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"} ${className}`}>{children}</div>;
}

export type Slide = { icon: ReactNode; title: string; text: string; tip?: string };
/** Auto-playing carousel with dots, arrows, keyboard control, pause on hover and a progress bar. */
export function Slideshow({ slides, interval = 6000 }: { slides: Slide[]; interval?: number }) {
  const [i, setI] = useState(0), [paused, setPaused] = useState(reduced()), n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  useEffect(() => { if (paused) return; const t = setTimeout(() => go(1), interval); return () => clearTimeout(t); }, [i, paused, interval, go]);
  const s = slides[i];
  return (
    <div className="card !p-0 overflow-hidden" role="group" aria-roledescription="carousel" aria-label="How CodePreflight works" tabIndex={0}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(reduced())} onFocus={() => setPaused(true)} onBlur={() => setPaused(reduced())}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
      <div className="h-1 bg-stone-100"><div key={`${i}-${paused}`} className={`h-full bg-slate-900 ${paused ? "w-0" : "animate-progress"}`} style={{ animationDuration: `${interval}ms` }} /></div>
      <div key={i} className="animate-fade-up grid items-center gap-8 px-6 py-10 sm:px-12 md:grid-cols-[auto,1fr]" aria-live="polite">
        <div className="mx-auto grid h-32 w-32 place-items-center rounded-3xl bg-stone-100 text-slate-900">{s.icon}</div>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Step {i + 1} of {n}</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">{s.title}</h3><p className="mt-2 text-lg text-slate-600">{s.text}</p>
          {s.tip && <p className="mt-3 rounded-xl bg-stone-50 px-4 py-2 text-sm text-slate-500">{s.tip}</p>}</div>
      </div>
      <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
        <button aria-label="Previous step" onClick={() => go(-1)} className="rounded-full p-2 hover:bg-stone-100"><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex gap-2">{slides.map((x, k) => <button key={x.title} aria-label={`Go to step ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={`h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-slate-900" : "w-2.5 bg-stone-300 hover:bg-stone-400"}`} />)}</div>
        <button aria-label="Next step" onClick={() => go(1)} className="rounded-full p-2 hover:bg-stone-100"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/** A few pieces of paper falling when the project is ready. Pure CSS. */
export function Confetti() {
  if (reduced()) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">{Array.from({ length: 28 }, (_, k) => (
    <span key={k} className="absolute top-0 block h-3 w-2 animate-confetti rounded-sm" style={{ left: `${(k * 37) % 100}%`, animationDelay: `${(k % 9) * 0.25}s`, animationDuration: `${3 + (k % 5) * 0.5}s`, background: ["#0f172a", "#64748b", "#10b981", "#f59e0b", "#cbd5e1"][k % 5] }} />))}</div>;
}

export const PageTitle = ({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) => (
  <div className="mx-auto max-w-3xl pb-8 pt-12 text-center">{kicker && <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{kicker}</p>}
    <h1 className="mt-2 text-4xl font-bold tracking-tighter sm:text-5xl">{title}</h1>{children && <p className="mt-3 text-lg text-slate-500">{children}</p>}</div>
);

export const SEV_WORDS = { critical: "Fix right now", high: "Fix before sharing", medium: "Should fix", low: "Nice to fix", info: "Just so you know" } as const;
