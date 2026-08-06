# ── Build Stage ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Production Stage ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS production

# Security: run as non-root user
RUN useradd --create-home --shell /bin/bash vertice
USER vertice
WORKDIR /home/vertice/app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/vertice/.local
ENV PATH=/home/vertice/.local/bin:$PATH

# Copy application code
COPY --chown=vertice:vertice . .

# Health check — reads $PORT so it still checks the right port when the
# platform (e.g. Railway) injects one and overrides the 8001 default below.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import httpx, os; httpx.get(f'http://localhost:{os.environ.get(\"PORT\", 8001)}/health')" || exit 1

EXPOSE 8001

# Shell form (not exec-array) so ${PORT:-8001} actually expands — Railway and
# most PaaS providers inject PORT and expect the process to bind to it rather
# than a hardcoded value.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 4
