# Demo script (about 3 minutes)

Before you start: open the live site, sign in with GitHub, and scan your demo repo once so it is in History. Keep the backup plan in mind: if the API is slow, the site falls back to a Lite scan and says so.

## 1. The problem (30 seconds)
"A project can run on your laptop and still not be ready to share: a leaked key, an old tool with a known hole, no licence. Developers find out late. Pilots check the plane before every flight. We built that check for code."

## 2. Live scan (60 seconds)
1. Home page: paste your repo link (or pick it from the dropdown after signing in). Press **Check my project**.
2. While Pip works, point at the checklist: "Five checkers run together: Trivy, Gitleaks, OSV, Scorecard and our own rules. Your code is read, never run."
3. The report opens on the traffic light. Say the verdict out loud ("Hold at the gate: two big problems").

## 3. Understand and fix (60 seconds)
1. Open **Fix these first**. Show one card: what it means, how to fix it, and **Show the proof** (secrets are masked).
2. Open the chat bubble. Ask: "What should I fix first?" Click a finding ID in the answer to jump to it. Say: "The AI only uses this scan's results, and references that are not in the scan are removed."
3. Toggle **Technical** to show the full table, then back to Simple.

## 4. Proof it worked (30 seconds)
1. Press **Check again** after a fix (or show a previous pair in History > Compare). Show Fixed / Still open / New.
2. Download the PDF.

## Strong points to mention (all true today)
- Evidence first: every finding shows where it is and which checker found it.
- Honest coverage: checks that could not run say unknown, never clean.
- Private repos through one GitHub button; the token is kept in memory and never stored.
- We scanned CodePreflight with CodePreflight, and fixed what it found.
- Automated tests on the scoring, scanners, report and AI guard code.

## Questions judges may ask
- **Is it just a wrapper around Trivy?** No. It combines five checkers, normalises them into one finding format, scores them, explains them, and verifies fixes with a re-scan.
- **Can the AI make things up?** It only explains scanner findings. Unknown ids are removed and unfamiliar version numbers are flagged. It can still be wrong, so findings need human review.
- **What does it not cover?** Git history beyond 100 commits, binaries and containers, and runtime behaviour. They are listed as not covered in every report.
- **What is next?** Pull-request checks, SBOM export, scheduled scans and a README badge. These are planned, not built.
