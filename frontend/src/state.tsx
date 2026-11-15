import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { API, sb, api, setProviderToken, listRepos, fullAudit, reportFromAudit, explainLocal, score, validUrl, Finding, Report, Repo } from "./lib";
import { liteAudit } from "./lite";
import { exportReport } from "./exporters";
import type { HItem } from "./components";
import { navigate } from "./router";

const loadLocal = (): Report[] => { try { return JSON.parse(localStorage.getItem("cp.history") || "[]"); } catch { return []; } };
const saveLocal = (l: Report[]) => { try { localStorage.setItem("cp.history", JSON.stringify(l)); } catch { /* storage full or blocked */ } };

/** Everything the pages share: sign-in, repo list, the running scan, the current report, history. */
function useAppState() {
  const qc = useQueryClient(), full = !!API;
  const [session, setSession] = useState<Session | null>(null);
  const [url, setUrl] = useState(""), [err, setErr] = useState(""), [note, setNote] = useState(""), [stage, setStage] = useState(-1);
  const [repos, setRepos] = useState<Repo[]>([]), [repoScope, setRepoScope] = useState<boolean | null>(null);
  const [rep, setRep] = useState<Report | null>(null), [prev, setPrev] = useState<Finding[] | null>(null);
  const [sel, setSel] = useState<string | null>(null), [flt, setFlt] = useState("all");
  const [acc, setAcc] = useState<Record<string, string>>({}), [aiMap, setAiMap] = useState<Record<string, { text: string; fb: boolean }>>({});
  const [local, setLocal] = useState<Report[]>(loadLocal);
  const busy = stage >= 0 && stage < 5;

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { if (data.session?.provider_token) setProviderToken(data.session.provider_token); setSession(data.session); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { if (s?.provider_token) setProviderToken(s.provider_token); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setRepos([]); setRepoScope(null); return; }
    listRepos((session.user.user_metadata as { user_name?: string })?.user_name).then((x) => { setRepos(x.repos); setRepoScope(x.repoScope); }).catch(() => { setRepos([]); setRepoScope(null); });
  }, [session]);
  const hist = useQuery({ queryKey: ["hist"], enabled: full && !!session, queryFn: () => api<any[]>("/api/v1/history") });

  const show = (r: Report) => {
    setRep(r); setSel(r.findings[0]?.id ?? null); setFlt("all"); setAiMap({});
    setAcc(Object.fromEntries(r.findings.filter((f) => f.st === "accepted").map((f) => [f.id, "accepted earlier (see audit trail)"])));
  };
  const run = async (u: string, keep = false) => {
    if (!validUrl(u)) return setErr("That does not look like a GitHub link. It should look like https://github.com/owner/repo");
    setErr(""); setNote(""); setStage(0); if (!keep) setPrev(null);
    try {
      let r: Report;
      try { r = full ? await fullAudit(u, setStage) : await liteAudit(u, setStage); }
      catch (e) { // network failure only (not an API error): fall back to the in-browser Lite scan
        if (!(full && e instanceof TypeError)) throw e;
        setNote(`Could not reach the backend at ${API} (it may be asleep, blocked by CORS, or it crashed). A Lite scan ran instead.`);
        setStage(0); r = await liteAudit(u, setStage);
      }
      show(r); setStage(5);
      if (r.mode === "lite") { const l = [r, ...local].slice(0, 15); setLocal(l); saveLocal(l); } else qc.invalidateQueries({ queryKey: ["hist"] });
      navigate("/report");
    } catch (e) { setErr((e as Error).message); setStage(-1); }
  };
  const start = (u: string) => { setUrl(u); navigate("/scan"); run(u); };
  const rescan = () => { if (!rep) return; setPrev(rep.findings); navigate("/scan"); run(rep.url, true); };

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
    try { show(l ?? reportFromAudit(await api<any>(`/api/v1/audits/${id}`), items.find((i) => i.id === id)!.url)); navigate("/report"); } catch (e) { setErr((e as Error).message); }
  };
  const compare = async (n: string, o: string) => {
    const a = local.find((r) => r.id === o), b = local.find((r) => r.id === n);
    if (a && b) { const x = new Set(a.findings.map((f) => f.id)), y = new Set(b.findings.map((f) => f.id)); return `${[...x].filter((i) => !y.has(i)).length} resolved · ${[...y].filter((i) => x.has(i)).length} still open · ${[...y].filter((i) => !x.has(i)).length} new`; }
    const r = await api<any>(`/api/v1/audits/compare?new=${n}&old=${o}`); return `${r.resolved} resolved · ${r.persistent} still open · ${r.new} new`;
  };
  const signIn = async (scopes = "read:user user:email") => { // GitHub creates the account on first sign-in, so one button is both sign in and register
    if (!sb) return setErr("Sign-in is not set up yet: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the root .env and enable the GitHub provider in Supabase.");
    const { error } = await sb.auth.signInWithOAuth({ provider: "github", options: { scopes, redirectTo: location.origin } });
    if (error) setErr(error.message);
  };
  const signOut = () => { sb?.auth.signOut(); setProviderToken(null); };
  const gh = session?.user?.user_metadata as { avatar_url?: string; user_name?: string } | undefined;
  const exp = (fmt: "json" | "sarif" | "md" | "pdf") => rep && exportReport(rep, acc, fmt);

  return { full, session, gh, url, setUrl, err, setErr, note, stage, busy, repos, repoScope, rep, prev, sel, setSel, flt, setFlt, acc, aiMap, items, run, start, rescan, explain, accept, open, compare, signIn, signOut, exp };
}

const Ctx = createContext<ReturnType<typeof useAppState> | null>(null);
export const AppProvider = ({ children }: { children: ReactNode }) => <Ctx.Provider value={useAppState()}>{children}</Ctx.Provider>;
export const useApp = () => useContext(Ctx)!;
