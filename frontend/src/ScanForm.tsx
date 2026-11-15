import { ArrowRight } from "lucide-react";
import { RepoPicker } from "./RepoPicker";
import { useApp } from "./state";

export const EXAMPLES = ["octocat/Hello-World", "expressjs/express", "pallets/flask"];

/** The one place where a repository is chosen. Used on the home page and the scan page. */
export function ScanForm({ big = false }: { big?: boolean }) {
  const a = useApp();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); a.start(a.url); }} className={`flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm transition focus-within:border-slate-400 focus-within:shadow-md ${big ? "sm:p-3" : ""}`}>
        <RepoPicker value={a.url} onChange={a.setUrl} repos={a.repos} privateOn={a.repoScope} signedIn={!!a.session} onEnablePrivate={() => a.signIn("repo read:user")} />
        <button className="btn flex flex-none items-center gap-1" disabled={a.busy}>{a.busy ? "Checking…" : <>Check my project <ArrowRight className="h-4 w-4" /></>}</button>
      </form>
      <p className="mt-3 text-center text-sm text-slate-500">No project handy? Try one:{" "}
        {EXAMPLES.map((x) => <button key={x} disabled={a.busy} onClick={() => a.start("https://github.com/" + x)} className="mx-1 underline decoration-stone-300 underline-offset-2 hover:text-slate-900">{x}</button>)}</p>
      <p role="alert" className="mt-2 min-h-5 text-center text-sm text-red-700">{a.err}</p>
    </div>
  );
}
