FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# Trivy: secrets, vulnerable packages, misconfigurations. Pinned tag; check github.com/aquasecurity/trivy/releases for a newer one.
COPY --from=docker.io/aquasec/trivy:0.72.0 /usr/local/bin/trivy /usr/local/bin/trivy
# Gitleaks: secret detection in Git history. Pinned tag; verify the binary path with `docker build` before deploying.
COPY --from=docker.io/zricethezav/gitleaks:v8.18.4 /usr/bin/gitleaks /usr/local/bin/gitleaks
# OpenSSF Scorecard runs through its public REST API (see scanners.py), so no binary or gcr.io image is needed here.
ENV TRIVY_CACHE_DIR=/tmp/trivy HOME=/tmp
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && chown -R app /app
USER app
# Report container health (also silences Trivy's "no HEALTHCHECK" finding)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/docs' % os.getenv('PORT', '8000'), timeout=4)"
# Railway (and most hosts) provide the port in $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
