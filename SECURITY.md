# Security policy

CodePreflight inspects untrusted repositories, so we treat its own security seriously.

## Reporting a vulnerability
Please do not open a public issue. Email the maintainers (see the README) with steps to reproduce. We aim to reply within 7 days.

## Design rules
- Repository content is untrusted input and is never executed (no install, build or workflow runs).
- Scanners are invoked with argument lists, never shell strings.
- Secrets are masked before storage, display, reports and AI requests.
- GitHub tokens are kept in memory only and never logged or stored.
- Every audit, finding and report is owner-checked.
