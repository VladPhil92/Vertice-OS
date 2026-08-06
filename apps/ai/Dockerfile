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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8001/health')" || exit 1

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
