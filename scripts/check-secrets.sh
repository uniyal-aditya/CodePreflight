#!/usr/bin/env bash
# Looks for things that must never be committed. Run it from the project root before you push:  bash scripts/check-secrets.sh
set -u; bad=0
pat='sb_secret_[A-Za-z0-9_]{10,}|gsk_[A-Za-z0-9]{10,}|pt_live_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|SUPABASE_SERVICE_KEY=[A-Za-z0-9._-]{20,}'
if git grep -nIE "$pat" -- . ':!*.md' ':!.env.example' ':!backend/tests' ':!scripts'; then echo "^ possible secret(s) in tracked files"; bad=1; fi
if git ls-files | grep -E '(^|/)\.env$'; then echo "^ .env is tracked by git. Remove it with: git rm --cached .env"; bad=1; fi
if git grep -nIE "service_role|SERVICE_KEY" -- frontend/src; then echo "^ the service key must never appear in frontend code"; bad=1; fi
[ "$bad" -eq 0 ] && echo "No obvious secrets found. (This is a quick check, not a guarantee. Also run CodePreflight on the repo.)"
exit "$bad"
