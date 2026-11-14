FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# Trivy: secrets, vulnerable packages, misconfigurations. Pinned tag; check github.com/aquasecurity/trivy/releases for a newer one.
COPY --from=docker.io/aquasec/trivy:0.72.0 /usr/local/bin/trivy /usr/local/bin/trivy
# OpenSSF Scorecard runs through its public REST API (see scanners.py), so no binary or gcr.io image is needed here.
ENV TRIVY_CACHE_DIR=/tmp/trivy HOME=/tmp
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && chown -R app /app
USER app
# Render (and most hosts) provide the port in $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
