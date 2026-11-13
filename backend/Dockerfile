FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# Scanners. Trivy: plain multi-arch tag (0.72.0 exists per Trivy discussion #10824); check the releases page for a newer one.
COPY --from=docker.io/aquasec/trivy:0.72.0 /usr/local/bin/trivy /usr/local/bin/trivy
# Scorecard: official image documented at gcr.io/openssf/scorecard. ":stable" moves, so pin a version or digest once chosen.
# The binary path (/scorecard) is unverified: run  docker run --rm --entrypoint ls gcr.io/openssf/scorecard:stable /  to confirm.
COPY --from=gcr.io/openssf/scorecard:stable /scorecard /usr/local/bin/scorecard
ENV TRIVY_CACHE_DIR=/tmp/trivy HOME=/tmp
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && chown -R app /app
USER app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
