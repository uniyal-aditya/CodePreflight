import { lazy, Suspense } from "react";
import { Layout } from "./Layout";
import { usePath } from "./router";
import { Mascot } from "./ui";

// every page is its own file and its own download: only the page you open is loaded
const pages: Record<string, ReturnType<typeof lazy>> = {
  "/": lazy(() => import("./pages/Home")),
  "/pr": lazy(() => import("./pages/PullRequest")),
  "/scan": lazy(() => import("./pages/Scan")),
  "/report": lazy(() => import("./pages/Report")),
  "/history": lazy(() => import("./pages/History")),
  "/how-it-works": lazy(() => import("./pages/HowItWorks")),
  "/learn": lazy(() => import("./pages/Learn")),
  "/about": lazy(() => import("./pages/About")),
};
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  const Page = pages[usePath()] ?? NotFound;
  return <Layout><Suspense fallback={<div className="grid place-items-center py-32"><Mascot mood="thinking" size={80} /></div>}><Page /></Suspense></Layout>;
}
