# Contributing

1. Create a branch: `feature/<short-name>` from `develop`.
2. Backend: `cd backend && python -m pytest -q tests` must pass.
3. Frontend: `node --check frontend/app.js`.
4. Open a pull request using the labels `frontend`, `backend`, `scanner`, `security`, `testing`, `documentation`.
5. Never commit real credentials. Use synthetic strings in tests.

New scanners must return the standard finding shape (see `backend/core.py`) and report `ran`, `failed` or `unknown`, never silently "clean".
