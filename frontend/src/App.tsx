import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogIn, LogOut, RefreshCw, Download, ArrowRight } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { API, sb, api, setProviderToken, hasToken, fullAudit, reportFromAudit, explainLocal, score, validUrl, Finding, Report } from "./lib";
import { liteAudit } from "./lite";
import { exportReport } from "./exporters";
import { FindingsView, H2, History, HItem, NextSteps, Coverage, Pipeline, Summary } from "./components";

const Info = lazy(() => import("./info").then((m) => ({ default: m.Info }))); // loaded after first paint
const PILLARS = [["01", "Unified assessment", "Hygiene, security, dependency and workflow signals in one view."], ["02", "Evidence-first findings", "Source, rule, file and masked evidence on every finding."], ["03", "Prioritised actions", "Severity explained, so the fix order is clear."], ["04", "AI explanations", "Plain-language guidance grounded on verified findings only."], ["05", "Fix verification", "Rescan and compare resolved, unchanged and new findings."]];
const EXAMPLES = ["octocat/Hello-World", "expressjs/express", "pallets/flask"];

const loadLocal = (): Report[] => { try { return JSON.parse(localStorage.getItem("cp.history") || "[]"); } catch { return []; } };
const saveLocal = (l: Report[]) => { try { localStorage.setItem("cp.history", JSON.stringify(l)); } catch { /* storage full or blocked */ } };

export default function App() {
  const qc = useQueryClient(), full = !!API;
  const [session, setSession] = useState<Session | null>(null);
  const [url, setUrl] = useState(""), [err, setErr] = useState(""), [stage, setStage] = useState(-1);
  const [rep, setRep] = useState<Report | null>(null), [prev, setPrev] = useState<Finding[] | null>(null);
  const [sel, setSel] = useState<string | null>(null), [flt, setFlt] = useState("all");
  const [acc, setAcc] = useState<Record<string, string>>({}), [aiMap, setAiMap] = useState<Record<string, { text: string; fb: boolean }>>({});
  const [local, setLocal] = useState<Report[]>(loadLocal), [note, setNote] = useState("");
  const busy = stage >= 0 && stage < 5;

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { if (data.session?.provider_token) setProviderToken(data.session.provider_token); setSession(data.session); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { if (s?.provider_token) setProviderToken(s.provider_token); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);
  const hist = useQuery({ queryKey: ["hist"], enabled: full && !!session, queryFn: () => api<any[]>("/api/v1/history") });

  const show = (r: Report) => {
    setRep(r); setSel(r.findings[0]?.id ?? null); setFlt("all"); setAiMap({});
    setAcc(Object.fromEntries(r.findings.filter((f) => f.st === "accepted").map((f) => [f.id, "accepted earlier (see audit trail)"])));
    setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const run = async (u: string, keep = false) => {
    if (!validUrl(u)) return setErr("Enter a valid GitHub URL: https://github.com/owner/repo");
    setErr(""); setNote(""); setStage(0); if (!keep) setPrev(null);
    try {
      let r: Report;
      try { r = full ? await fullAudit(u, setStage) : await liteAudit(u, setStage); }
      catch (e) { // network failure only (not an API error): fall back to the in-browser Lite scan
        if (!(full && e instanceof TypeError)) throw e;
        setNote(`Backend not reachable at ${API}, so a Lite scan ran instead. Start the API (uvicorn main:app --reload) or leave VITE_API_URL empty in .env.`);
        setStage(0); r = await liteAudit(u, setStage);
      }
      show(r); setStage(5);
      if (r.mode === "lite") { const l = [r, ...local].slice(0, 15); setLocal(l); saveLocal(l); } else qc.invalidateQueries({ queryKey: ["hist"] });
    } catch (e) { setErr((e as Error).message); setStage(-1); }
  };
  const example = (slug: string) => { const u = "https://github.com/" + slug; setUrl(u); run(u); };

  const signIn = async (scopes = "read:user user:email") => { // GitHub creates the account on first sign-in, so this is also "register"
    if (!sb) return setErr("Sign-in is not configured yet: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the root .env, enable the GitHub provider in Supabase, then restart npm run dev.");
    const { error } = await sb.auth.signInWithOAuth({ provider: "github", options: { scopes, redirectTo: location.origin } });
    if (error) setErr(error.message);
  };
  const gh = session?.user?.user_metadata as { avatar_url?: string; user_name?: string } | undefined;

  const explain = async (f: Finding) => {
    if (rep?.mode !== "full") return setAiMap((m) => ({ ...m, [f.id]: { text: explainLocal(f), fb: true } }));
    try { const r = (await api<any[]>("/api/v1/ai/explain", { method: "POST", body: JSON.stringify({ finding_ids: [f.uid] }) }))[0]; setAiMap((m) => ({ ...m, [f.id]: { text: `${r.explanation} ${r.steps.join(" ")} ${r.priority_reason}`, fb: !!r.fallback } })); } catch (e) { setErr((e as Error).message); }
  };
  const accept = async (f: Finding, reason: string) => {
    try { if (rep?.mode === "full") await api(`/api/v1/findings/${f.uid}/accept`, { method: "POST", body: JSON.stringify({ reason }) }); setAcc((m) => ({ ...m, [f.id]: reason })); } catch (e) { setErr((e as Error).message); }
  };

  const items: HItem[] = useMemo(() => [
    ...local.map((r) => { const s = score(r.findings, {}); return { id: r.id, url: r.url, commit: r.commit, at: r.at, score: s.tot, risk: s.top, status: "completed" }; }),
    ...(full && session ? (hist.data ?? []).map((h) => ({ id: h.id, url: `https://github.com/${h.repositories?.owner}/${h.repositories?.name}`, commit: h.commit_sha, at: h.started_at, score: h.score, risk: h.risk, status: h.status })) : []),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)), [full, session, hist.data, local]);
  const open = async (id: string) => {
    const l = local.find((r) => r.id === id); setPrev(null);
    if (l) return show(l);
    try { show(reportFromAudit(await api<any>(`/api/v1/audits/${id}`), items.find((i) => i.id === id)!.url)); } catch (e) { setErr((e as Error).message); }
  };
  const compare = async (n: string, o: string) => {
    const a = local.find((r) => r.id === o), b = local.find((r) => r.id === n);
    if (a && b) { const x = new Set(a.findings.map((f) => f.id)), y = new Set(b.findings.map((f) => f.id)); return `${[...x].filter((i) => !y.has(i)).length} resolved · ${[...y].filter((i) => x.has(i)).length} still open · ${[...y].filter((i) => !x.has(i)).length} new`; }
    const r = await api<any>(`/api/v1/audits/compare?new=${n}&old=${o}`); return `${r.resolved} resolved · ${r.persistent} still open · ${r.new} new`;
  };

  const F = rep?.findings ?? [], s = score(F, acc);
  const cmp = prev && rep ? { resolved: prev.filter((p) => !F.some((f) => f.id === p.id)).length, still: F.filter((f) => prev.some((p) => p.id === f.id)).length, fresh: F.filter((f) => !prev.some((p) => p.id === f.id)).length } : null;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <a href="#top" className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><b className="tracking-tight">CodePreflight</b></a>
          <span className="hidden gap-4 text-sm text-slate-500 sm:flex"><a href="#report" className="hover:text-slate-900">Report</a><a href="#history" className="hover:text-slate-900">History</a><a href="#architecture" className="hover:text-slate-900">Architecture</a></span><span className="flex-1" />
          <span className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs text-slate-500">{full && !note ? "Full scan · backend" : note ? "Lite scan · backend offline" : "Lite scan · in browser"}</span>
          {session ? (<>
            {full && !hasToken() && <button className="ghost" title="Re-authorise GitHub with access to private repositories" onClick={() => signIn("repo read:user")}>Enable private repos</button>}
            <span className="flex items-center gap-2 text-sm text-slate-600">{gh?.avatar_url && <img src={gh.avatar_url} alt="" className="h-6 w-6 rounded-full" />}<span className="hidden sm:inline">{gh?.user_name ?? "Signed in"}</span></span>
            <button className="ghost flex items-center gap-1" onClick={() => { sb?.auth.signOut(); setProviderToken(null); }}><LogOut className="h-4 w-4" />Sign out</button>
          </>) : (<>
            <button className="ghost" onClick={() => signIn()}>Sign in</button>
            <button className="btn flex items-center gap-1 !px-3 !py-1.5 text-sm" title="GitHub creates your account the first time you sign in" onClick={() => signIn()}><LogIn className="h-4 w-4" />Sign up with GitHub</button>
          </>)}
        </div>
      </nav>

      <main id="top" className="mx-auto max-w-5xl px-4 pb-16">
        <section className="py-14 text-center">
          <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-slate-500">CodeSprint 2026 · Team Limitless Arise</span>
          <h1 className="mt-5 text-5xl font-bold tracking-tighter sm:text-6xl">Know before <span className="text-slate-400">you ship.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">Evidence-backed repository audits, prioritised findings, grounded AI guidance, and a rescan that proves your fixes worked.</p>
          <form className="mx-auto mt-7 flex max-w-xl gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm" onSubmit={(e) => { e.preventDefault(); run(url); }}>
            <input className="min-w-0 flex-1 bg-transparent px-3 outline-none" placeholder="https://github.com/owner/repo" aria-label="GitHub repository URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn flex items-center gap-1" disabled={busy}>{busy ? "Scanning…" : <>Run preflight <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Try: {EXAMPLES.map((x) => <button key={x} disabled={busy} onClick={() => example(x)} className="mx-1 underline decoration-stone-300 underline-offset-2 hover:text-slate-900">{x}</button>)}</p>
          {!session && <p className="mt-2 text-xs text-slate-500"><button onClick={() => signIn()} className="underline underline-offset-2 hover:text-slate-900">Sign in with GitHub</button> to save your history and scan private repos.</p>}
          <p role="alert" className="mt-3 min-h-5 text-sm text-red-700">{err}</p>
          {note && <p className="mx-auto max-w-xl text-xs text-amber-700">{note}</p>}
          {busy && <Pipeline stage={stage} />}
        </section>

        {!rep && !busy && <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{PILLARS.map(([n, t, d]) => <div key={n} className="card !p-4"><b className="text-xs tracking-widest text-slate-400">{n}</b><h4 className="font-semibold">{t}</h4><p className="text-sm text-slate-500">{d}</p></div>)}</section>}

        {rep && (
          <section id="report" className="space-y-5">
            <p className="text-sm text-slate-500">{rep.url.replace("https://github.com/", "")} · commit {rep.commit.slice(0, 7)} (pinned) · {new Date(rep.at).toLocaleString()}</p>
            {rep.mode === "lite" && <p className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-slate-600">Lite scan: repository checks, dependency advisories (OSV) and OpenSSF Scorecard ran in your browser. Trivy and the Git-history secret scan need the full backend, and are listed below as not run.</p>}
            <Summary F={F} acc={acc} pct={rep.pct} />
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn flex items-center gap-1 !py-2" disabled={busy} onClick={() => { setPrev(F); run(rep.url, true); }}><RefreshCw className="h-4 w-4" />Rescan</button>
              {(["json", "sarif", "md", "pdf"] as const).map((f) => <button key={f} className="ghost flex items-center gap-1" onClick={() => exportReport(rep, acc, f)}><Download className="h-3.5 w-3.5" />{f.toUpperCase()}</button>)}
            </div>
            {cmp && <div className="card flex flex-wrap gap-8 text-center">{([["Previous", prev!.length], ["Now", F.length], ["Resolved", cmp.resolved], ["Still open", cmp.still], ["New", cmp.fresh]] as [string, number][]).map(([l, n]) => <div key={l}><b className="block text-2xl">{n}</b><span className="text-xs text-slate-500">{l}</span></div>)}</div>}
            <H2>Findings</H2>
            <FindingsView F={F} acc={acc} aiMap={aiMap} sel={sel} setSel={setSel} flt={flt} setFlt={setFlt} onExplain={explain} onAccept={accept} clean={rep.mode === "lite"} />
            <H2>Next steps</H2><NextSteps open={s.open} />
            <H2>Scan coverage</H2><Coverage cov={rep.coverage} />
          </section>
        )}

        <History items={items} onOpen={open} onCompare={compare} />
        <Suspense fallback={<p className="mt-14 text-center text-sm text-slate-400">Loading…</p>}><Info /></Suspense>
      </main>
      <footer className="pb-10 text-center text-xs text-slate-400">Findings need human review. A clean report is not a guarantee of safety.<br />Built by Limitless Arise · Aditya Uniyal · Aditya Singh · Prince Bisht · Akshat Arya · Harshit Gupta</footer>
    </div>
  );
}
