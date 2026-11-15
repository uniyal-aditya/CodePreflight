import { ReactNode, useEffect, useState } from "react";
import { Menu, X, LogIn } from "lucide-react";
import { Link, navigate, usePath } from "./router";
import { useApp } from "./state";
import { UserMenu } from "./RepoPicker";
import { Mascot } from "./ui";
import { Chat } from "./Chat";

export const NAV: [string, string][] = [["/", "Home"], ["/scan", "Scan"], ["/report", "Report"], ["/history", "History"], ["/how-it-works", "How it works"], ["/learn", "Learn"], ["/about", "About"]];

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath(), a = useApp(), [menu, setMenu] = useState(false);
  useEffect(() => { document.title = `${NAV.find(([p]) => p === path)?.[1] ?? "Page not found"} · CodePreflight`; setMenu(false); }, [path]);
  const link = (p: string, l: string, mobile = false) => <Link key={p} to={p} className={`${mobile ? "block rounded-lg px-3 py-2.5 text-base" : "rounded-lg px-3 py-1.5 text-sm"} transition ${path === p ? "bg-stone-200/70 font-semibold text-slate-900" : "text-slate-500 hover:bg-stone-100 hover:text-slate-900"}`}>{l}</Link>;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2"><Mascot size={34} /><b className="text-lg tracking-tight">CodePreflight</b></Link>
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">{NAV.slice(1).map(([p, l]) => link(p, l))}</nav><span className="flex-1" />
          {a.session
            ? <UserMenu name={a.gh?.user_name ?? "Signed in"} avatar={a.gh?.avatar_url} privateOn={a.repoScope} onEnablePrivate={() => a.signIn("repo read:user")} onSignOut={a.signOut} />
            : <button className="btn flex items-center gap-1 !px-3.5 !py-2 text-sm" title="Signs you in, or creates your account the first time" onClick={() => a.signIn()}><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Continue with GitHub</span><span className="sm:hidden">Sign in</span></button>}
          <button className="rounded-lg p-2 hover:bg-stone-100 lg:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menu && <nav aria-label="Mobile" className="border-t border-stone-200 bg-white px-3 py-2 lg:hidden">{NAV.map(([p, l]) => link(p, l, true))}</nav>}
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="mt-20 border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div><div className="flex items-center gap-2"><Mascot size={30} /><b>CodePreflight</b></div><p className="mt-3 text-sm text-slate-500">Know before you ship. Checks a GitHub project for leaked keys, risky tools and missing basics, then helps you fix them.</p></div>
          <div><p className="text-sm font-semibold">Explore</p><ul className="mt-3 space-y-2 text-sm text-slate-500">{NAV.slice(1).map(([p, l]) => <li key={p}><Link to={p} className="hover:text-slate-900">{l}</Link></li>)}</ul></div>
          <div><p className="text-sm font-semibold">Good to know</p><p className="mt-3 text-sm text-slate-500">Findings need a human to review them. A clean report is not a guarantee of safety. Your code is read, never run.</p><p className="mt-3 text-sm text-slate-500">Built by Team Limitless Arise.</p></div>
        </div>
      </footer>
      {a.rep && <Chat key={a.rep.id} rep={a.rep} onSelect={(id) => { a.setSel(id); a.setFlt("all"); a.setErr(""); try { sessionStorage.setItem("cp.view", "tech"); } catch { /* storage blocked */ } window.dispatchEvent(new CustomEvent("cp:open-technical")); if (path !== "/report") navigate("/report"); setTimeout(() => document.getElementById("findings-anchor")?.scrollIntoView({ behavior: "smooth" }), 350); }} />}
    </div>
  );
}
