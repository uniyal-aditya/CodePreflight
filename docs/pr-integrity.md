# PR change integrity (rules v0.1)

Checks whether a pull request weakens the tests, CI, security controls, permissions or agent instructions that are supposed to validate it.
Deterministic static rules over the PR diff plus base/head file contents. No model decides a verdict; repository code is never executed.

## Endpoints
- `POST /api/v2/pull-requests/analyze` body `{pr_url, task?, allowed_paths?, protected_paths?}` (stateless; nothing is stored yet).
- `GET /api/v2/demo/{safe|unsafe}` synthetic PRs, labelled `demo: true`; the verdict is computed by the same engine.

## Verdicts
| Technical | Outcome | When |
|---|---|---|
| REJECTED | BLOCK | a critical finding, or a high-severity finding with high confidence |
| NOT_VERIFIABLE | REVIEW | a required module could not inspect something (file list truncated, content unreadable, YAML unparseable) |
| CONDITIONALLY_SAFE | REVIEW | medium findings, lower-confidence high findings, or prompt-injection indicators |
| VERIFIED_SAFE | PASS | every required module ran and found nothing at medium or above |

`enforcement` is always `advisory`: nothing here stops a merge on GitHub (that needs a Check Run plus branch protection).

## Rules
tests: TEST-001 deleted/renamed test, 002 skip marker, 003 fewer tests, 004 assertion broadened, 005 fewer assertions, 006 coverage threshold lowered.
ci: CI-000 unparseable workflow, 001 continue-on-error, 002 masked exit status, 003 step removed, 004 command replaced by no-op, 005 always-false `if`.
security_controls: SEC-001 scanner step removed, 002 ignore list widened, 003 scanner exits 0 on findings, 004 pre-commit hook removed, 006 config deleted.
permissions: PERM-001 write-all, 002 write scope added, 003 permissions block removed, 004 pull_request_target added, 005 checkout of PR head.
agent_instructions: AGT-001..004 policy-relevant added lines, AGT-000 changed file with no match (low).
scope: SCOPE-001 protected path, SCOPE-002 outside allowed paths; `not_configured` when no policy is given.

## Prompt injection
PR title, body, branch name and added diff lines are scanned for override/exfiltration/policy-tampering phrasing (Unicode-normalised, hidden characters stripped, base64 decoded). Indicators are reported separately and can raise REVIEW; they never change rules or policy. No PR text is sent to a model in this slice.

## Known limitations
- Heuristic regex rules: expect false positives and misses (Python/JS test syntax is covered best; other frameworks only partly).
- Homoglyph (e.g. Cyrillic) obfuscation is not normalised. Only the first 3000 files and 80 relevant file contents are inspected; beyond that the result is NOT_VERIFIABLE.
- No persistence, remediation, GitHub write access or Check Run yet.
