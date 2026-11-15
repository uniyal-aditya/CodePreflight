import { Link } from "../router";
import { useApp } from "../state";
import { History as HistoryTable } from "../components";
import { Mascot, PageTitle } from "../ui";

export default function History() {
  const a = useApp();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <PageTitle kicker="Your flight log" title="Scan history">Every check you ran is saved here. Open one to read it again, or tick two to see what changed.</PageTitle>
      {a.items.length === 0 ? (
        <div className="mx-auto max-w-md py-10 text-center"><div className="mx-auto w-fit"><Mascot mood="thinking" size={110} /></div><p className="mt-4 text-slate-500">Nothing here yet. Your first check will show up in this list.</p><Link to="/scan" className="btn-lg mt-5 inline-block">Check a project</Link></div>
      ) : <HistoryTable items={a.items} onOpen={a.open} onCompare={a.compare} />}
      <p className="mt-6 text-center text-sm text-slate-400">{a.session ? "Signed-in checks are saved to your account. Quick checks made in the browser are saved on this device only." : "Checks are saved on this device only. Sign in with GitHub to keep them in your account."}</p>
    </div>
  );
}
