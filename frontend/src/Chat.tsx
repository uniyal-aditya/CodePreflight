import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { api, Report } from "./lib";

type Msg = { role: "user" | "assistant"; content: string; flags?: string[]; fb?: boolean };
const SUGGEST = ["What should I fix first?", "Why is the score what it is?", "How do I fix the most serious finding?", "Which checks did not run?"];

/** Finding ids in an answer (F-1A2B3C) become buttons that open that finding. */
const Answer = ({ t, onSelect }: { t: string; onSelect: (id: string) => void }) => (
  <>{t.split(/(F-[0-9A-F]{6})/g).map((p, i) => /^F-[0-9A-F]{6}$/.test(p)
    ? <button key={i} onClick={() => onSelect(p)} className="mx-0.5 rounded bg-white px-1 font-mono text-xs underline">{p}</button> : <span key={i}>{p}</span>)}</>
);

export function Chat({ rep, onSelect }: { rep: Report; onSelect: (id: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);
  if (rep.mode !== "full" || !rep.sid) return <div className="card text-sm text-slate-500">AI chat needs the full backend, because the AI key stays on the server. This scan ran in Lite mode.</div>;

  const send = async (q: string) => {
    q = q.trim(); if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setText(""); setBusy(true); setErr("");
    try {
      const r = await api<{ answer: string; flags?: string[]; fallback?: boolean }>(`/api/v1/audits/${rep.sid}/chat`, { method: "POST", body: JSON.stringify({ messages: next.slice(-6).map(({ role, content }) => ({ role, content })) }) });
      setMsgs([...next, { role: "assistant", content: r.answer, flags: r.flags, fb: r.fallback }]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <p className="mb-3 flex items-center gap-2 text-sm text-slate-500"><MessageSquare className="h-4 w-4 flex-none" />Answers use only this scan&apos;s results. Check anything important yourself.</p>
      <div className="max-h-96 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {!msgs.length && <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} className="ghost" onClick={() => send(s)}>{s}</button>)}</div>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-slate-900 text-white" : "bg-stone-100"}`}>
              {m.role === "user" ? m.content : <Answer t={m.content} onSelect={onSelect} />}
              {m.flags?.map((f) => <p key={f} className="mt-2 text-xs text-amber-700">{f}</p>)}
              {m.fb && <p className="mt-2 text-xs text-slate-500">AI unavailable right now: this is a summary taken from the scan.</p>}
            </div>
          </div>))}
        {busy && <p className="text-sm text-slate-400">Thinking…</p>}
        <div ref={end} />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <textarea rows={1} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Ask a question about this repository"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          placeholder="Ask about this repo, for example: which finding is the riskiest?" className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900" />
        <button className="btn flex items-center gap-1 !px-4" disabled={busy || !text.trim()}><Send className="h-4 w-4" />Send</button>
      </form>
    </div>
  );
}
