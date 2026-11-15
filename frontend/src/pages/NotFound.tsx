import { Link } from "../router";
import { Mascot } from "../ui";

export default function NotFound() {
  return <div className="mx-auto max-w-lg px-4 py-24 text-center"><div className="mx-auto w-fit"><Mascot mood="worried" size={120} /></div><h1 className="mt-4 text-4xl font-bold tracking-tight">This page took off without us</h1><p className="mt-2 text-slate-500">We could not find what you were looking for.</p><Link to="/" className="btn-lg mt-6 inline-block">Back to the home page</Link></div>;
}
