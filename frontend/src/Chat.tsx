import { useEffect, useRef, useState } from "react";
import { MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { api, Report } from "./lib";

type Msg = { role: "user" | "assistant"; content: string; flags?: string[]; fb?: boolean };
const SUGGEST = ["What should I fix first?", "Why is the score what it is?", "How do I fix the most serious finding?", "Which checks did not run?"];

/** Finding ids in an answer (F-1A2B3C) become buttons that open that finding. */
const Answer = ({ t, onSelect }: { t: string; onSelect: (id: string) => void }) => (
  <>{t.split(/(F-[0-9A-F]{6})/g).map((p, i) => /^F-[0-9A-F]{6}$/.test(p)
    ? <button key={i} onClick={() => onSelect(p)} className="mx-0.5 rounded bg-white px-1 font-mono text-xs underline">{p}</button> : <span key={i}>{p}</span>)}</>
);

/** Floating chat: a bubble in the bottom-right corner that opens a chat box about the finished scan. */
export function Chat({ rep, onSelect }: { rep: Report; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false), [seen, setSeen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const full = rep.mode === "full" && !!rep.sid, repo = rep.url.replace("https://github.com/", "");

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy, open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);

  const toggle = () => { setOpen((o) => !o); setSeen(true); };
  const send = async (q: string) => {
    q = q.trim(); if (!q || busy || !full) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setText(""); setBusy(true); setErr("");
    try {
      const r = await api<{ answer: string; flags?: string[]; fallback?: boolean }>(`/api/v1/audits/${rep.sid}/chat`, { method: "POST", body: JSON.stringify({ messages: next.slice(-6).map(({ role, content }) => ({ role, content })) }) });
      setMsgs([...next, { role: "assistant", content: r.answer, flags: r.flags, fb: r.fallback }]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const pick = (id: string) => { onSelect(id); if (window.innerWidth < 640) setOpen(false); }; // on phones the box covers the findings

  return (
    <>
      {open && (
        <section role="dialog" aria-label="AI chat about this repository" className="fixed bottom-24 right-5 z-40 flex h-[min(34rem,calc(100vh-8rem))] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Ask about this repo</p><p className="truncate text-xs text-slate-500">{repo} · answers come from this scan only</p></div>
            {msgs.length > 0 && <button aria-label="Clear conversation" title="Clear conversation" onClick={() => { setMsgs([]); setErr(""); }} className="rounded p-1.5 text-slate-400 hover:bg-stone-100 hover:text-slate-900"><RotateCcw className="h-4 w-4" /></button>}
            <button aria-label="Close chat" onClick={toggle} className="rounded p-1.5 text-slate-400 hover:bg-stone-100 hover:text-slate-900"><X className="h-4 w-4" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 px-4 py-3" aria-live="polite">
            {!full ? <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">AI chat needs the full backend, because the AI key stays on the server. This scan ran in Lite mode.</p> : (<>
              <div className="max-w-[90%] rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm">Hi! Ask me anything about the scan of <b>{repo}</b>. I only use its results, so check anything important yourself.</div>
              {!msgs.length && <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} className="ghost text-left !text-xs" onClick={() => send(s)}>{s}</button>)}</div>}
            </>)}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-slate-900 text-white" : "bg-white shadow-sm"}`}>
                  {m.role === "user" ? m.content : <Answer t={m.content} onSelect={pick} />}
                  {m.flags?.map((f) => <p key={f} className="mt-2 text-xs text-amber-700">{f}</p>)}
                  {m.fb && <p className="mt-2 text-xs text-slate-500">AI unavailable right now: this is a summary taken from the scan.</p>}
                </div>
              </div>))}
            {busy && <p className="text-sm text-slate-400">Thinking…</p>}
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            <div ref={end} />
          </div>
          {full && (
            <form className="flex items-end gap-2 border-t border-stone-200 bg-white p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <textarea ref={input} rows={1} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Ask a question about this repository"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
                placeholder="Ask a question…" className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-slate-900" />
              <button aria-label="Send" className="btn !rounded-xl !px-3 !py-2.5" disabled={busy || !text.trim()}><Send className="h-4 w-4" /></button>
            </form>)}
        </section>)}
      {!open && !seen && <span className="fixed bottom-7 right-24 z-40 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm shadow-md">Ask AI about this repo</span>}
      <button onClick={toggle} aria-expanded={open} aria-label={open ? "Close AI chat" : "Open AI chat"} className={`fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg transition hover:scale-105 ${!open && !seen ? "animate-bounce" : ""}`}>
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </>
  );
}
