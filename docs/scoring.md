# Scoring

Per category: 100 minus deductions for open findings (critical 60, high 30, medium 15, low 5, info 0), floored at 0.
Overall = weighted sum: Security 30, Dependencies 20, Documentation 15, Engineering hygiene 15, Maintenance 10, Release readiness 10.
Security Risk Status is separate: the highest severity among open security-relevant findings, so one number never hides a critical issue.
Coverage % counts only checks that actually ran (pass, fail, ran). Unknown, failed and not-covered checks are never counted as passing.
Accepted risks leave the score but stay visible, with the reason, in the audit trail.
