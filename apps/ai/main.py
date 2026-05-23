"""
VÉRTICE OS — AI Service
FastAPI wrapper sobre el orquestador multi-agente.

Endpoints públicos:
  POST /civic/query          — consulta ciudadana general (multi-agente + router)

Endpoints internos (requieren X-Service-Key):
  POST /territorial/analyze  — análisis de patrones en reportes territoriales
  POST /governance/synthesize — síntesis imparcial del debate de una propuesta
  POST /governance/draft-policy — borradores de política pública desde demandas ciudadanas

Infraestructura:
  GET  /health               — liveness check
  GET  /health/ready         — readiness check (dependencias externas)
  GET  /docs                 — OpenAPI (solo en desarrollo)
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

import config
from orchestrator import (
    AgentIntent,
    QueryRequest,
    QueryResponse,
    SessionContext,
    process_civic_query,
    process_with_intent,
)
from rag import rag_pipeline

logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="VÉRTICE OS — AI Orchestrator",
    version="0.1.0",
    description="Servicio de IA multi-agente para el Sistema Operativo Cívico de Cartagena",
    docs_url="/docs" if config.NODE_ENV != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGIN.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Exception handlers ─────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("[main] error no manejado: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Error interno del servidor"},
    )

# ── Auth dependency ────────────────────────────────────────────────────────────

async def verify_service_key(x_service_key: Annotated[str, Header()] = "") -> None:
    """Valida la clave interna de servicio. Requerida para endpoints internos."""
    secret = config.AI_SERVICE_SECRET
    if secret and x_service_key != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clave de servicio inválida",
        )

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["infra"])
async def health() -> dict:
    """Liveness check — responde inmediatamente sin verificar dependencias."""
    key_ok = bool(config.ANTHROPIC_API_KEY)
    return {
        "status": "ok" if key_ok else "degraded",
        "service": "ai-orchestrator",
        "version": "0.1.0",
        "checks": {
            "anthropic_key": "ok" if key_ok else "missing",
        },
    }


@app.get("/health/ready", tags=["infra"])
async def health_ready() -> JSONResponse:
    """Readiness check — verifica todas las dependencias externas."""
    checks: dict[str, str] = {}
    healthy = True

    checks["anthropic_key"] = "ok" if config.ANTHROPIC_API_KEY else "missing"
    if not config.ANTHROPIC_API_KEY:
        healthy = False

    checks["rag"] = rag_pipeline.status  # ok | no_api_key | not_installed | error

    return JSONResponse(
        status_code=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "ok" if healthy else "degraded",
            "service": "ai-orchestrator",
            "version": "0.1.0",
            "checks": checks,
        },
    )

# ── /civic/query — endpoint general (público) ──────────────────────────────────

@app.post("/civic/query", response_model=QueryResponse, tags=["orchestrator"])
async def civic_query(request: QueryRequest) -> QueryResponse:
    """
    Procesa una consulta ciudadana libre a través del orquestador multi-agente.
    El router clasifica automáticamente la intención y delega al agente adecuado.
    """
    logger.info(
        "[query] citizen_id=%s territory=%s",
        request.citizen_id or "anon",
        request.territory or "—",
    )
    return await process_civic_query(request)

# ── /territorial/analyze ───────────────────────────────────────────────────────

class TerritorialReportInput(BaseModel):
    id: str = Field(max_length=36)
    category: str = Field(max_length=100)
    title: str = Field(max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    urgency_score: float = Field(default=0.5, ge=0, le=1)
    status: str = Field(default="open", max_length=50)
    neighborhood: str | None = Field(default=None, max_length=120)


class TerritorialAnalysisRequest(BaseModel):
    reports: list[TerritorialReportInput] = Field(min_length=1, max_length=50)
    locality: str | None = Field(default=None, max_length=120)
    neighborhood: str | None = Field(default=None, max_length=120)
    citizen_id: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    )


class TerritorialAnalysisResponse(BaseModel):
    analysis: str
    urgency_level: str  # baja | media | alta | crítica
    report_count: int
    audit_id: str


def _build_territorial_message(req: TerritorialAnalysisRequest) -> str:
    location_parts: list[str] = []
    if req.locality:
        location_parts.append(f"Localidad: {req.locality}")
    if req.neighborhood:
        location_parts.append(f"Barrio: {req.neighborhood}")
    location = " — ".join(location_parts) if location_parts else "Cartagena de Indias"

    # Ordenar por urgencia descendente
    sorted_reports = sorted(req.reports, key=lambda r: r.urgency_score, reverse=True)

    lines = []
    for i, r in enumerate(sorted_reports, 1):
        urgency_pct = int(r.urgency_score * 100)
        desc = f" — {r.description[:120]}..." if r.description else ""
        lines.append(
            f"{i}. [{r.category.upper()}] {r.title} "
            f"(urgencia: {urgency_pct}%, estado: {r.status}, "
            f"barrio: {r.neighborhood or 'sin especificar'}){desc}"
        )

    reports_block = "\n".join(lines)

    return f"""Analiza los siguientes {len(req.reports)} reportes ciudadanos recibidos en {location}:

{reports_block}

Por favor identifica:
1. Los patrones y tendencias principales entre estos reportes
2. El nivel de urgencia general (baja/media/alta/crítica) y justificación
3. Las posibles causas sistémicas detrás de los problemas reportados
4. Las 3 recomendaciones prioritarias de acción para el equipo territorial"""


@app.post("/territorial/analyze", response_model=TerritorialAnalysisResponse, tags=["territorial"])
async def territorial_analyze(
    request: TerritorialAnalysisRequest,
    _auth: None = None,
) -> TerritorialAnalysisResponse:
    """
    Analiza patrones en reportes territoriales usando el TerritorialAgent.
    Endpoint interno llamado por la API Fastify cuando se solicita inteligencia territorial.
    """
    logger.info("[territorial/analyze] %d reportes locality=%s", len(request.reports), request.locality or "—")

    message = _build_territorial_message(request)
    context = SessionContext(
        locality=request.locality,
        neighborhood=request.neighborhood,
    )

    result = await process_with_intent(
        message=message,
        intent=AgentIntent.TERRITORIAL,
        context=context,
        citizen_id=request.citizen_id,
    )

    # Determinar nivel de urgencia a partir del contenido de la respuesta
    text_lower = result.response.lower()
    if "crítica" in text_lower or "critica" in text_lower or "emergencia" in text_lower:
        urgency_level = "crítica"
    elif "alta" in text_lower:
        urgency_level = "alta"
    elif "baja" in text_lower:
        urgency_level = "baja"
    else:
        urgency_level = "media"

    return TerritorialAnalysisResponse(
        analysis=result.response,
        urgency_level=urgency_level,
        report_count=len(request.reports),
        audit_id=result.audit_id,
    )

# ── /governance/synthesize ─────────────────────────────────────────────────────

class DebateSynthesisRequest(BaseModel):
    proposal_title: str = Field(max_length=200)
    proposal_description: str = Field(max_length=5000)
    category: str = Field(max_length=100)
    scope: str = Field(max_length=50)
    comments: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("comments")
    @classmethod
    def truncate_comments(cls, v: list[str]) -> list[str]:
        return [c[:500] for c in v]


class DebateSynthesisResponse(BaseModel):
    synthesis: str
    comment_count: int
    audit_id: str


def _build_synthesis_message(req: DebateSynthesisRequest) -> str:
    comments_block = ""
    if req.comments:
        numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(req.comments[:50]))
        comments_block = f"\n\n**Comentarios recibidos ({len(req.comments)}):**\n{numbered}"

    return f"""Sintetiza el debate de la siguiente propuesta ciudadana:

**Propuesta:** {req.proposal_title}
**Categoría:** {req.category}
**Alcance territorial:** {req.scope}

**Descripción:**
{req.proposal_description}{comments_block}

Genera una síntesis imparcial que incluya:
- Posiciones a favor con sus argumentos principales
- Posiciones en contra con sus argumentos principales
- Puntos de consenso identificados (si los hay)
- Preguntas clave que quedaron sin resolver
- Próximos pasos sugeridos para el proceso"""


@app.post("/governance/synthesize", response_model=DebateSynthesisResponse, tags=["governance"])
async def governance_synthesize(
    request: DebateSynthesisRequest,
    _auth: None = None,
) -> DebateSynthesisResponse:
    """
    Sintetiza el debate de una propuesta usando el GovernanceAgent.
    Genera un resumen imparcial de posiciones a favor, en contra y puntos de consenso.
    """
    logger.info(
        "[governance/synthesize] propuesta='%s' comentarios=%d",
        request.proposal_title[:50],
        len(request.comments),
    )

    message = _build_synthesis_message(request)
    context = SessionContext(topic=request.proposal_title[:200])

    result = await process_with_intent(
        message=message,
        intent=AgentIntent.GOVERNANCE,
        context=context,
    )

    return DebateSynthesisResponse(
        synthesis=result.response,
        comment_count=len(request.comments),
        audit_id=result.audit_id,
    )

# ── /governance/draft-policy ───────────────────────────────────────────────────

class PolicyDraftRequest(BaseModel):
    citizen_demand: str = Field(min_length=10, max_length=5000)
    category: str = Field(max_length=100)
    scope: str = Field(max_length=50)
    territory: str | None = Field(default=None, max_length=120)
    citizen_id: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    )

    @field_validator("citizen_demand")
    @classmethod
    def demand_no_injection(cls, v: str) -> str:
        forbidden = ["## ", "<|system|>", "<|user|>", "ignore previous"]
        lower = v.lower()
        for pattern in forbidden:
            if pattern.lower() in lower:
                raise ValueError("Formato de mensaje no permitido")
        return v


class PolicyDraftResponse(BaseModel):
    draft: str
    audit_id: str


def _build_policy_message(req: PolicyDraftRequest) -> str:
    territory_line = f"\nTerritorio específico: {req.territory}" if req.territory else ""

    return f"""Un ciudadano de Cartagena de Indias presenta la siguiente demanda:

"{req.citizen_demand}"

Categoría de política: {req.category}
Alcance territorial: {req.scope}{territory_line}

Convierte esta demanda en una propuesta estructurada de política pública con los 9 puntos del formato estándar:
1. Problema identificado
2. Población afectada
3. Causas raíz
4. Propuesta de intervención
5. Entidad responsable (Alcaldía, Gobernación, u otro ente)
6. Indicadores de éxito medibles
7. Recursos necesarios (estimación)
8. Marco legal aplicable en Colombia
9. Riesgos y cómo mitigarlos"""


@app.post("/governance/draft-policy", response_model=PolicyDraftResponse, tags=["governance"])
async def governance_draft_policy(
    request: PolicyDraftRequest,
    _auth: None = None,
) -> PolicyDraftResponse:
    """
    Convierte una demanda ciudadana en un borrador estructurado de política pública.
    Usa el PolicyAgent con el formato de 9 puntos del marco colombiano.
    """
    logger.info(
        "[governance/draft-policy] category=%s scope=%s citizen_id=%s",
        request.category,
        request.scope,
        request.citizen_id or "anon",
    )

    message = _build_policy_message(request)
    context = SessionContext(
        locality=request.territory,
        topic=request.category,
    )

    result = await process_with_intent(
        message=message,
        intent=AgentIntent.POLICY,
        context=context,
        citizen_id=request.citizen_id,
    )

    return PolicyDraftResponse(
        draft=result.response,
        audit_id=result.audit_id,
    )
