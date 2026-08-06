"""
Configuración central del servicio AI de VÉRTICE OS.
Todas las variables se leen desde el entorno con defaults seguros.
"""
from __future__ import annotations

import os

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX: str = os.getenv("PINECONE_INDEX", "vertice-os")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

# Clave compartida entre la API Fastify y este servicio para llamadas internas
AI_SERVICE_SECRET: str = os.getenv("AI_SERVICE_SECRET", "")

CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:4000")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info").upper()
NODE_ENV: str = os.getenv("NODE_ENV", "development")
SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

# ── Validación de arranque ────────────────────────────────────────────────────
# En producción no se admite arrancar sin la clave de servicio: los endpoints
# internos (/territorial/analyze, /governance/*, /legal/analyze) consumen la API
# de Anthropic, así que dejarlos sin autenticar expone tanto datos como gasto.
if NODE_ENV == "production" and not AI_SERVICE_SECRET:
    raise RuntimeError(
        "AI_SERVICE_SECRET es obligatorio en producción: sin él los endpoints "
        "internos quedarían accesibles sin autenticación."
    )
