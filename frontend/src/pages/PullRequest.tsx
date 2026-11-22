import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, FlaskConical, GitPullRequest, LogIn, CheckCircle2 } from "lucide-react";
import { api, SEVC, Sev } from "../lib";
import { PageTitle } from "../ui";
import { useApp } from "../state";

type F = { module: string; rule_id: string; severity: Sev; confidence: string; file: string; line: number | null; before: string; after: string; reason: string; invariant: string };
type Result = {
  verdict: string; outcome: "PASS" | "REVIEW" | "BLOCK"; enforcement: string; demo: boolean; title?: string; pr_url?: string | null; task?: string | null; note: string; rules_version: string;
  analysis: { base_sha: string; head_sha: string; files_analysed: number };
  modules: Record<string, { status: string; findings: number }>; coverage: Record<string, string>;
  findings: F[]; injection_indicators: { source: string; indicator: string; confidence: string; excerpt: string }[];
};

type PRItem = { url: string; repo: string; number: number; title: string; author: string; updated_at: string | null; draft: boolean };
const TABS: [string, string][] = [["review", "Needs my review"], ["mine", "My pull requests"], ["all", "All involving me"]];
const ago = (t: string | null) => { if (!t) return ""; const d = Math.max(0, Date.now() - +new Date(t)) / 36e5; return d < 1 ? "just now" : d < 24 ? `${Math.floor(d)}h ago` : `${Math.floor(d / 24)}d ago`; };
const MOD: Record<string, string> = { tests: "Test integrity", ci: "CI integrity", security_controls: "Security controls", permissions: "Permissions", agent_instructions: "Agent instructions", scope: "Scope" };
const ST: Record<string, [string, string]> = { pass: ["Pass", "bg-emerald-100 text-emerald-800"], review: ["Review", "bg-amber-100 text-amber-800"], block: ["Block", "bg-red-100 text-red-800"], unknown: ["Not verifiable", "bg-stone-200 text-stone-700"], not_configured: ["Not configured", "bg-stone-100 text-stone-500"] };
const OUT = { PASS: { Icon: ShieldCheck, cls: "border-emerald-300 bg-emerald-50", text: "Pass: every required check ran and found nothing serious." }, REVIEW: { Icon: ShieldQuestion, cls: "border-amber-300 bg-amber-50", text: "Review: a person needs to look before this is merged." }, BLOCK: { Icon: ShieldAlert, cls: "border-red-300 bg-red-50", text: "Block: this change weakens the checks meant to validate it." } };
const split = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);

export default function PullRequest() {
  const app = useApp();
  const [url, setUrl] = useState(""), [task, setTask] = useState(""), [allowed, setAllowed] = useState(""), [prot, setProt] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [res, setRes] = useState<Result | null>(null);
  const [tab, setTab] = useState("review"), [list, setList] = useState<PRItem[] | null>(null), [listBusy, setListBusy] = useState(false), [listErr, setListErr] = useState("");
  const [ack, setAck] = useState(false), [approving, setApproving] = useState(false), [approveErr, setApproveErr] = useState(""), [approved, setApproved] = useState<string | null>(null), [current, setCurrent] = useState("");
  // the list loads by itself as soon as someone is signed in with GitHub
  useEffect(() => {
    if (!app.session) { setList(null); return; }
    let live = true; setListBusy(true); setListErr("");
    api<{ items: PRItem[] }>(`/api/v2/pull-requests?scope=${tab}`).then((r) => live && setList(r.items)).catch((e) => live && setListErr((e as Error).message)).finally(() => live && setListBusy(false));
    return () => { live = false; };
  }, [app.session, tab]);
  const go = async (p: () => Promise<Result>) => { setBusy(true); setErr(""); setRes(null); setAck(false); setApproved(null); setApproveErr(""); try { setRes(await p()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const policy = () => ({ allowed_paths: split(allowed), protected_paths: split(prot) });
  const analyse = (u: string) => { setCurrent(u); return go(() => api<Result>("/api/v2/pull-requests/analyze", { method: "POST", body: JSON.stringify({ pr_url: u.trim(), task: task.trim() || null, ...policy() }) })); };
  const demo = (k: "safe" | "unsafe") => { setCurrent(""); return go(() => api<Result>(`/api/v2/demo/${k}`)); };
  const approve = async () => {
    if (!res?.pr_url) return; setApproving(true); setApproveErr("");
    try { const r = await api<{ approved: boolean; review_url: string | null }>("/api/v2/pull-requests/approve", { method: "POST", body: JSON.stringify({ pr_url: res.pr_url, head_sha: res.analysis.head_sha, acknowledge_review: ack, ...policy() }) }); if (r.approved) setApproved(r.review_url || "done"); }
    catch (e) { setApproveErr((e as Error).message); } finally { setApproving(false); }
  };
  const o = res ? OUT[res.outcome as keyof typeof OUT] : null;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <PageTitle kicker="Change integrity" title="Analyse a pull request">Passing CI is not enough if the change also weakened the tests and checks that decide whether it passes. Paste a GitHub pull request link to find out.</PageTitle>
      {!app.session ? (
        <div className="card mb-5 flex flex-wrap items-center gap-3"><GitPullRequest className="h-6 w-6 text-slate-400" /><p className="flex-1 text-sm text-slate-600">Sign in with GitHub and your open pull requests will appear here, ready to check.</p><button className="btn flex items-center gap-2 !px-4 !py-2 text-sm" onClick={() => app.signIn("repo read:user")}><LogIn className="h-4 w-4" />Continue with GitHub</button></div>
      ) : (
        <section className="card mb-5" aria-label="Your pull requests">
          <div className="flex flex-wrap items-center gap-2" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-stone-200/70 font-semibold" : "text-slate-500 hover:bg-stone-100"}`}>{l}</button>)}{listBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}</div>
          {app.repoScope === false && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">To approve pull requests from here, GitHub needs to give CodePreflight permission to review them. <button className="font-semibold underline" onClick={() => app.signIn("repo read:user")}>Allow approving</button></p>}
          {listErr && <p role="alert" className="mt-3 text-sm text-red-700">{listErr}</p>}
          {list && list.length === 0 && !listBusy && <p className="mt-4 text-sm text-slate-500">No open pull requests in this list.</p>}
          {list && list.length > 0 && <ul className="mt-3 divide-y divide-stone-100">{list.map((p) => (
            <li key={p.url} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.title || "(no title)"}{p.draft && <span className="ml-2 rounded bg-stone-100 px-1.5 text-xs text-slate-500">draft</span>}</p><p className="truncate font-mono text-xs text-slate-500">{p.repo}#{p.number} · {p.author} · {ago(p.updated_at)}</p></div>
              <button className="btn-outline !px-4 !py-1.5 text-sm" disabled={busy} onClick={() => analyse(p.url)}>{busy && current === p.url ? "Checking…" : current === p.url && res ? "Check again" : "Check"}</button>
            </li>))}</ul>}
        </section>
      )}
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); if (url.trim()) analyse(url); }}>
        <label className="block text-sm font-medium">{app.session ? "Or paste any pull request link" : "Pull request link"}<input className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" placeholder="https://github.com/owner/repo/pull/123" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="block text-sm font-medium">What was this change meant to do? <span className="font-normal text-slate-400">(optional)</span><input className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5" maxLength={500} value={task} onChange={(e) => setTask(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Allowed paths <span className="font-normal text-slate-400">(optional)</span><textarea className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-sm" rows={2} placeholder="src/auth/**, tests/**" value={allowed} onChange={(e) => setAllowed(e.target.value)} /></label>
          <label className="block text-sm font-medium">Protected paths <span className="font-normal text-slate-400">(optional)</span><textarea className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-sm" rows={2} placeholder=".github/**" value={prot} onChange={(e) => setProt(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn flex items-center gap-2" disabled={busy || !url.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Analyse pull request</button>
          <span className="text-sm text-slate-400">or try a demo:</span>
          <button type="button" className="btn-outline !px-4 !py-2 text-sm" disabled={busy} onClick={() => demo("unsafe")}><FlaskConical className="mr-1 inline h-4 w-4" />Unsafe change</button>
          <button type="button" className="btn-outline !px-4 !py-2 text-sm" disabled={busy} onClick={() => demo("safe")}><FlaskConical className="mr-1 inline h-4 w-4" />Safe change</button>
        </div>
        <p className="text-xs text-slate-400">Read-only. The pull request is read, never run. Leave the path boxes empty and the scope check is reported as not configured.</p>
      </form>
      {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {res && o && (
        <div className="mt-6 space-y-5">
          <div className={`rounded-2xl border p-5 ${o.cls}`}>
            <div className="flex items-center gap-3"><o.Icon className="h-8 w-8" /><div><p className="text-xl font-bold">{res.outcome} <span className="font-mono text-sm font-medium text-slate-500">{res.verdict}</span></p><p className="text-sm">{o.text}</p></div>{res.demo && <span className="ml-auto rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">DEMO DATA</span>}</div>
            <p className="mt-3 text-sm text-slate-600">{res.title}{res.task ? ` · task: ${res.task}` : ""}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">base {res.analysis.base_sha?.slice(0, 10)} → head {res.analysis.head_sha?.slice(0, 10)} · {res.analysis.files_analysed} files · rules v{res.rules_version} · {res.enforcement}</p>
            <p className="mt-2 text-xs text-slate-500">{res.note}</p>
          </div>
          {res.pr_url && !res.demo && (
            <div className="card">
              <h2 className="text-lg font-bold">Approve this pull request</h2>
              <p className="mt-1 text-sm text-slate-500">This sends an approving review to GitHub as you, attached to commit <span className="font-mono">{res.analysis.head_sha.slice(0, 10)}</span>. It does not merge anything.</p>
              {approved ? <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5" />Approved on GitHub. {approved.startsWith("http") && <a className="underline" href={approved} target="_blank" rel="noreferrer">View the review</a>}</p>
              : !app.session ? <p className="mt-3 text-sm text-slate-600">Sign in with GitHub above to approve.</p>
              : res.outcome === "BLOCK" ? <p className="mt-3 text-sm text-red-800">Approval is switched off because blocking problems were found. Fix them, or review it on GitHub yourself.</p>
              : <div className="mt-3 space-y-2">
                  {res.outcome === "REVIEW" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />I read the findings above and still want to approve.</label>}
                  <button className="btn flex items-center gap-2" disabled={approving || (res.outcome === "REVIEW" && !ack)} onClick={approve}>{approving && <Loader2 className="h-4 w-4 animate-spin" />}Approve on GitHub</button>
                </div>}
              {approveErr && <p role="alert" className="mt-3 text-sm text-red-700">{approveErr}</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">{(Object.entries(res.modules) as [string, { status: string; findings: number }][]).map(([m, v]) => { const [l, c] = ST[v.status] ?? ST.unknown; return <div key={m} className="card !p-4"><p className="text-sm font-semibold">{MOD[m] ?? m}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{l}</span><span className="ml-2 text-xs text-slate-400">{v.findings} finding{v.findings === 1 ? "" : "s"}</span></div>; })}</div>
          {res.findings.length > 0 && <section><h2 className="mb-2 text-lg font-bold">Findings</h2><ul className="space-y-3">{res.findings.map((f, i) => (
            <li key={i} className="card !p-4">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVC[f.severity as Sev]}`}>{f.severity}</span><span className="font-mono text-xs text-slate-500">{f.rule_id} · {MOD[f.module]} · {f.confidence} confidence</span></div>
              <p className="mt-2 font-medium">{f.reason}</p>
              <p className="font-mono text-xs text-slate-500">{f.file}{f.line ? `:${f.line}` : ""}</p>
              {(f.before || f.after) && <div className="mt-2 grid gap-2 sm:grid-cols-2">{[["Before", f.before, "bg-stone-50"], ["After", f.after, "bg-red-50"]].map(([l, t, c]) => t && <div key={l} className={`rounded-lg p-2 ${c}`}><p className="text-xs font-semibold text-slate-500">{l}</p><pre className="whitespace-pre-wrap break-words font-mono text-xs">{t}</pre></div>)}</div>}
              {f.invariant && <p className="mt-2 text-xs text-slate-500">Should stay true: {f.invariant}</p>}
            </li>))}</ul></section>}
          {res.injection_indicators.length > 0 && <section><h2 className="mb-1 text-lg font-bold">Possible prompt-injection text</h2><p className="mb-2 text-sm text-slate-500">Text in the pull request that tries to instruct an AI. It was treated as data and did not change any rule. Please read it yourself.</p><ul className="space-y-2">{res.injection_indicators.map((x, i) => <li key={i} className="card !p-3 text-sm"><b>{x.indicator}</b> <span className="text-slate-400">in {x.source} · {x.confidence}</span><pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-slate-600">{x.excerpt}</pre></li>)}</ul></section>}
          {res.findings.length === 0 && res.outcome === "PASS" && <p className="text-center text-sm text-slate-500">No integrity problems found in the files that were checked. This is not a guarantee of security.</p>}
        </div>
      )}
    </div>
  );
}
