import { ClipboardCheck, KeyRound, Rocket, Search, Sparkles } from "lucide-react";
import type { Slide } from "./ui";

const ic = "h-14 w-14";
export const SLIDES: Slide[] = [
  { icon: <Search className={ic} />, title: "Paste a GitHub link", text: "Tell us which project to check. Public projects work right away. Sign in with GitHub to check your private ones too.", tip: "We pin the check to one exact version of your project, so the answer cannot change halfway through." },
  { icon: <ClipboardCheck className={ic} />, title: "We read it like a checklist", text: "We look for the basics (a README, a licence, tests) and open every file that lists the tools your project uses.", tip: "We only read your files. We never run your code." },
  { icon: <KeyRound className={ic} />, title: "We hunt for secrets and weak spots", text: "Five checkers look for leaked passwords and keys, tools with known holes, and unsafe settings.", tip: "Secrets are hidden (masked) everywhere you see them." },
  { icon: <Sparkles className={ic} />, title: "Pip explains it in plain words", text: "Every problem comes with what it means, why it matters and exactly how to fix it. You can also chat with the AI helper about your results.", tip: "The AI only explains what the checkers found. It does not invent problems." },
  { icon: <Rocket className={ic} />, title: "Fix it, check again, take off", text: "After you fix things, press Check again. We show what got fixed and what is new, so you know it really worked.", tip: "A problem only counts as fixed when a new check no longer finds it." },
];

export const FAQ: [string, string][] = [
  ["Is my code safe?", "Yes. We only read your files. We never run your code, install your packages or start your programs. Anything that looks like a password or key is hidden before it is shown."],
  ["Do I have to sign in?", "Not for public projects. Sign in with GitHub when you want to check your private projects. Signing in also saves your history."],
  ["What if you find nothing?", "Look at the list of what we checked. A check that could not run is marked unknown, and unknown never counts as safe. No news is not the same as good news."],
  ["Is the AI always right?", "No. It only explains what the checkers found, and we remove any made-up references. Always double-check anything important."],
  ["Which projects can I check?", "Any public GitHub project, and your own private ones after you sign in. Very big projects are skipped to keep the service fast for everyone."],
  ["How much does it cost?", "CodePreflight is a hackathon project and it is free to try."],
];

export const GLOSSARY: [string, string][] = [
  ["Secret or API key", "A secret password a program uses to talk to another service. If it leaks, strangers can use it. It is like leaving your house key in the front door."],
  ["Secret in Git history", "Git remembers every old version of your project. If you saved a key once and deleted it later, it is still written in the old pages."],
  ["Dependency", "A tool written by someone else that your project uses, like a LEGO piece you did not make yourself."],
  ["Vulnerability", "A hole in a tool that bad people could use to cause trouble."],
  ["CVE or advisory", "A public report number for a known hole, like a recall notice for a toy."],
  ["Lockfile", "A list that says exactly which version of every tool you use, so everyone gets the same ones."],
  ["CI (continuous integration)", "A robot that runs your tests every time you save changes, so mistakes are caught early."],
  ["Licence", "A note that says what other people are allowed to do with your code."],
  ["README", "The front page of your project. It explains what the project is and how to start."],
  ["Severity", "How serious a problem is. We use five levels, from Fix right now to Just so you know."],
  ["Misconfiguration", "A setting that is unsafe, like leaving a door unlocked."],
  ["Preflight check", "What pilots do before every flight. We do the same for your project before you share it."],
];

export const CHECKLIST = ["My project has a README that says how to start it", "My project has a licence file", "I never typed a password or key into my code", "I use a .gitignore so secret files stay out of Git", "My project has at least one test", "A robot (CI) runs my tests on every change", "I keep a lockfile for my tools", "I update tools when a hole is announced"];

export const CHECKERS: [string, string][] = [
  ["Trivy", "Finds leaked secrets, tools with known holes and unsafe settings in your files."],
  ["Gitleaks", "Reads your recent Git history for keys that were saved once and deleted later."],
  ["OSV", "Looks up every tool version you use in a public list of known holes."],
  ["OpenSSF Scorecard", "Grades how safely a public project is run, such as protected branches and safe workflows."],
  ["Our own rules", "Checks the basics: README, licence, tests, CI, .gitignore and lockfiles."],
];

export const TEAM: [string, string, string][] = [
  ["Aditya Uniyal", "Backend and integration", "AU"], ["Aditya Singh", "Scanning engine", "AS"], ["Prince Bisht", "Frontend", "PB"], ["Akshat Arya", "Testing and security", "AA"], ["Harshit Gupta", "Product and documentation", "HG"],
];

export const JOURNEY: [string, string][] = [
  ["The idea", "A project can work on your laptop and still not be ready to share. We wrote a blueprint around one promise: find the problem, show the proof, help fix it, then check again."],
  ["The checking engine", "We combined Trivy, OSV, OpenSSF Scorecard, Gitleaks and our own rules, and made every result use one shared shape with masked evidence."],
  ["AI you can trust", "The AI explains real findings only. Made-up versions and references are caught, and a chat helper answers questions about your scan."],
  ["Accounts and private projects", "One GitHub button signs you in. Private repositories work, and your GitHub token stays in memory and is never stored."],
  ["Reports and history", "Download JSON, SARIF, Markdown or PDF. Run a check again and see what was fixed, what stayed and what is new."],
  ["Going live", "Frontend on Vercel, backend on Railway, our own domain, automatic tests, and a scan of our own repository to prove it works."],
];
