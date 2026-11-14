import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, LogOut, Search, X } from "lucide-react";
import type { Repo } from "./lib";

function useOutside(ref: React.RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [ref, close]);
}

type PickerProps = { value: string; onChange: (v: string) => void; repos: Repo[]; privateOn: boolean | null; signedIn: boolean; onEnablePrivate: () => void };
/** One field that searches your repositories and also accepts a pasted URL. */
export function RepoPicker({ value, onChange, repos, privateOn, signedIn, onEnablePrivate }: PickerProps) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0), box = useRef<HTMLDivElement>(null);
  const q = value.replace(/^https?:\/\/github\.com\//i, "").trim().toLowerCase();
  const list = useMemo(() => repos.filter((r) => !q || r.full_name.toLowerCase().includes(q)).slice(0, 50), [repos, q]);
  useOutside(box, () => setOpen(false));
  useEffect(() => setHi(0), [q]);
  const pick = (r: Repo) => { onChange("https://github.com/" + r.full_name); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter" && open && list[hi] && !/^https?:\/\//i.test(value)) { e.preventDefault(); pick(list[hi]); } // a pasted URL submits the form instead
  };
  const showList = open && (repos.length > 0 || signedIn);
  return (
    <div ref={box} className="relative min-w-0 flex-1 text-left">
      <div className="flex items-center gap-2 px-3">
        <Search className="h-4 w-4 flex-none text-slate-400" aria-hidden />
        <input role="combobox" aria-expanded={showList} aria-controls="repo-list" aria-label="GitHub repository" autoComplete="off" spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-slate-400" value={value} onKeyDown={onKey}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={repos.length ? `Search your ${repos.length} repos or paste a GitHub URL` : "Paste a GitHub repository URL"} />
        {value && <button type="button" aria-label="Clear" onClick={() => onChange("")} className="rounded p-1 text-slate-400 hover:text-slate-900"><X className="h-4 w-4" /></button>}
        {repos.length > 0 && <button type="button" aria-label="Show my repositories" onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:text-slate-900"><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>}
      </div>
      {showList && (
        <div id="repo-list" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-3 max-h-72 overflow-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
          {list.map((r, i) => {
            const [owner, name] = r.full_name.split("/");
            return (
              <button type="button" role="option" aria-selected={i === hi} key={r.full_name} onMouseEnter={() => setHi(i)} onClick={() => pick(r)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === hi ? "bg-stone-100" : ""}`}>
                <span className="min-w-0 flex-1 truncate"><span className="text-slate-400">{owner}/</span><b>{name}</b></span>
                {r.private && <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-slate-600"><Lock className="h-3 w-3" />private</span>}
              </button>);
          })}
          {!list.length && <p className="px-3 py-2 text-sm text-slate-500">{repos.length ? "No match. Press Run to scan the URL you typed." : "No repositories found for this account yet."}</p>}
          {signedIn && privateOn !== true && (
            <button type="button" onClick={onEnablePrivate} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-stone-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-stone-50">
              <Lock className="h-4 w-4 flex-none" /><span>Private repos are hidden. <u>Enable private repos</u></span>
            </button>)}
        </div>)}
    </div>
  );
}

type MenuProps = { name: string; avatar?: string; privateOn: boolean | null; onEnablePrivate: () => void; onSignOut: () => void };
export function UserMenu({ name, avatar, privateOn, onEnablePrivate, onSignOut }: MenuProps) {
  const [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null);
  useOutside(box, () => setOpen(false));
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-2.5 text-sm transition hover:border-slate-900">
        {avatar ? <img src={avatar} alt="" className="h-6 w-6 rounded-full" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">{name[0]?.toUpperCase()}</span>}
        <span className="hidden max-w-28 truncate sm:inline">{name}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
          <div className="px-3 py-2"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-slate-500">{privateOn === true ? "Private repos enabled" : "Public repos only"}</p></div>
          {privateOn !== true && <button role="menuitem" className={item} onClick={() => { setOpen(false); onEnablePrivate(); }}><Lock className="h-4 w-4" />Enable private repos</button>}
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onSignOut(); }}><LogOut className="h-4 w-4" />Sign out</button>
        </div>)}
    </div>
  );
}
