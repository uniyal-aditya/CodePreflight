import { MouseEvent, ReactNode, useEffect, useState } from "react";

/** Tiny history-API router: no extra dependency. Real URLs like /scan and /report (Vercel and nginx are configured to serve index.html for them). */
export function navigate(to: string) {
  if (location.pathname !== to) history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}
export function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const f = () => setP(location.pathname); window.addEventListener("popstate", f); return () => window.removeEventListener("popstate", f); }, []);
  return p.length > 1 ? p.replace(/\/$/, "") : p;
}
export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return <a href={to} className={className} onClick={(e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onClick?.(); navigate(to); }}>{children}</a>;
}
