"""
VÉRTICE OS — AI Service
FastAPI wrapper sobre el orquestador multi-agente.

Endpoints públicos:
  POST /civic/query          — consulta ciudadana general (multi-agente + router)

Endpoints internos (requieren X-Service-Key):
  POST /territorial/analyze  — análisis de patrones en reportes territoriales
  POST /governance/synthesize — síntesis imparcial del debate de una propuesta
  POST /governance/draft-policy — borradores de política pública desde demandas ciudadanas
  POST /legal/analyze        — análisis legal y generación de documento jurídico

Infraestructura:
  GET  /health               — liveness check
  GET  /health/ready         — readiness check (dependencias externas)
  GET  /docs                 — OpenAPI (solo en desarrollo)
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request, status
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

# ── /legal/analyze ─────────────────────────────────────────────────────────────

LEGAL_TYPES = [
    "derecho_de_peticion",
    "tutela",
    "accion_popular",
    "accion_de_cumplimiento",
    "denuncia_penal",
    "queja",
]

URGENCY_LEVELS = ["baja", "media", "alta", "critica"]

INJECTION_PATTERNS = ["## ", "<|system|>", "<|user|>", "ignore previous", "<|assistant|>"]


class LegalAnalysisRequest(BaseModel):
    description: str = Field(
        min_length=30,
        max_length=8000,
        description="Descripción detallada de la situación reportada por el ciudadano",
    )
    evidence_description: str | None = Field(
        default=None,
        max_length=2000,
        description="Descripción de evidencias disponibles (fotos, documentos, testigos)",
    )
    location: str | None = Field(default=None, max_length=300, description="Ubicación donde ocurrió la situación")
    citizen_name: str | None = Field(default=None, max_length=200, description="Nombre del ciudadano (para el documento)")
    category: str = Field(default="general", max_length=100)
    citizen_id: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    )

    @field_validator("description")
    @classmethod
    def description_no_injection(cls, v: str) -> str:
        lower = v.lower()
        for pattern in INJECTION_PATTERNS:
            if pattern.lower() in lower:
                raise ValueError("Formato de descripción no permitido")
        return v


class LegalTargetEntity(BaseModel):
    name: str
    type: str
    address: str
    email: str
    phone: str = "N/A"
    contact_person: str = "Despacho"


class LegalAnalysisResponse(BaseModel):
    legal_type: str
    urgency: str
    rights_affected: list[str]
    target_entity: LegalTargetEntity
    response_deadline_days: int
    document_draft: str
    legal_orientation: str
    alternative_remedies: list[str]
    legal_basis: list[str]
    next_steps: list[str]
    audit_id: str


def _build_legal_message(req: LegalAnalysisRequest) -> str:
    evidence_block = ""
    if req.evidence_description:
        evidence_block = f"\n\nEVIDENCIAS DISPONIBLES:\n{req.evidence_description}"

    location_block = f"\n\nUBICACIÓN: {req.location}" if req.location else ""
    citizen_block = f"\n\nNOMBRE DEL CIUDADANO: {req.citizen_name}" if req.citizen_name else "\n\nNOMBRE DEL CIUDADANO: [El ciudadano proporcionará su nombre]"

    return f"""SITUACIÓN REPORTADA POR CIUDADANO DE CARTAGENA DE INDIAS:

DESCRIPCIÓN DEL HECHO:
{req.description}

CATEGORÍA: {req.category}{location_block}{evidence_block}{citizen_block}

Analiza esta situación y:
1. Determina el instrumento jurídico más apropiado
2. Identifica la entidad responsable en Cartagena/Colombia
3. Genera el documento legal completo listo para presentar
4. Proporciona orientación práctica al ciudadano

Responde ÚNICAMENTE con el JSON estructurado solicitado."""


_FALLBACK_LEGAL_RESPONSE = LegalAnalysisResponse(
    legal_type="derecho_de_peticion",
    urgency="media",
    rights_affected=["Derecho de petición (Art. 23 CP)"],
    target_entity=LegalTargetEntity(
        name="Alcaldía Distrital de Cartagena",
        type="distrital",
        address="Calle 36 No. 6-60, Centro Histórico, Cartagena",
        email="alcaldia@cartagena.gov.co",
        phone="(605) 650-5000",
        contact_person="Secretario(a) General",
    ),
    response_deadline_days=15,
    document_draft=(
        "DERECHO DE PETICIÓN\n\n"
        "Señores Alcaldía Distrital de Cartagena:\n\n"
        "En ejercicio del derecho fundamental de petición (Art. 23 CP, Ley 1755/2015), "
        "me dirijo a ustedes para solicitar atención a la situación descrita.\n\n"
        "[Complete este documento con sus datos y la descripción detallada de la situación]\n\n"
        "Atentamente,\n[Su nombre]\nC.C. No. _____"
    ),
    legal_orientation=(
        "Un derecho de petición es el instrumento más accesible para ciudadanos. "
        "No requiere abogado, es gratuito y puede enviarse por correo electrónico. "
        "La entidad tiene 15 días hábiles para responder. "
        "Si no responden, puede presentar una tutela por violación del derecho de petición."
    ),
    alternative_remedies=["Queja ante Personería Distrital", "Denuncia ante Procuraduría si hay falta disciplinaria"],
    legal_basis=["Artículo 23 Constitución Política de Colombia", "Ley 1755 de 2015"],
    next_steps=[
        "Complete sus datos personales en el documento",
        "Adjunte las evidencias disponibles",
        "Envíe por correo electrónico a la entidad correspondiente",
        "Guarde el acuse de recibo",
        "Si no responden en 15 días hábiles, presente tutela",
    ],
    audit_id="fallback",
)


@app.post("/legal/analyze", response_model=LegalAnalysisResponse, tags=["legal"])
async def legal_analyze(
    request: LegalAnalysisRequest,
    _auth: None = None,
) -> LegalAnalysisResponse:
    """
    Analiza una situación ciudadana y genera el documento legal apropiado
    (derecho de petición, tutela, acción popular, denuncia, etc.).
    Incluye orientación jurídica basada en la normatividad colombiana.
    """
    logger.info(
        "[legal/analyze] category=%s citizen_id=%s",
        request.category,
        request.citizen_id or "anon",
    )

    message = _build_legal_message(request)
    context = SessionContext(
        locality=request.location,
        topic=request.category,
    )

    result = await process_with_intent(
        message=message,
        intent=AgentIntent.LEGAL,
        context=context,
        citizen_id=request.citizen_id,
    )

    # El LegalAgent devuelve JSON — parsearlo
    try:
        raw = result.response.strip()
        # Extraer JSON si viene envuelto en markdown code block
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        data = json.loads(raw)

        target = data.get("target_entity", {})
        return LegalAnalysisResponse(
            legal_type=data.get("legal_type", "derecho_de_peticion"),
            urgency=data.get("urgency", "media"),
            rights_affected=data.get("rights_affected", []),
            target_entity=LegalTargetEntity(
                name=target.get("name", "Alcaldía Distrital de Cartagena"),
                type=target.get("type", "distrital"),
                address=target.get("address", ""),
                email=target.get("email", ""),
                phone=target.get("phone", "N/A"),
                contact_person=target.get("contact_person", "Despacho"),
            ),
            response_deadline_days=int(data.get("response_deadline_days", 15)),
            document_draft=data.get("document_draft", ""),
            legal_orientation=data.get("legal_orientation", ""),
            alternative_remedies=data.get("alternative_remedies", []),
            legal_basis=data.get("legal_basis", []),
            next_steps=data.get("next_steps", []),
            audit_id=result.audit_id,
        )
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.error("[legal/analyze] parse error: %s | raw=%s", exc, result.response[:200])
        fallback = _FALLBACK_LEGAL_RESPONSE
        fallback.audit_id = result.audit_id
        return fallback


# ── /rag/status — estado del pipeline RAG ─────────────────────────────────────

@app.get("/rag/status", tags=["rag"])
async def rag_status(
    _auth: None = None,
) -> dict:
    """
    Retorna el estado del pipeline RAG (Pinecone + Voyage AI).
    Requiere X-Service-Key.
    """
    import os

    try:
        import voyageai  # type: ignore[import]
        voyage_available = True
    except ImportError:
        voyage_available = False

    try:
        from pinecone import Pinecone as _PC  # type: ignore[import]
        pinecone_available = True
    except ImportError:
        pinecone_available = False

    rag_ok = rag_pipeline.status == "ok"
    return {
        "status": "ok" if rag_ok else "degraded",
        "rag_status": rag_pipeline.status,
        "index_name": config.PINECONE_INDEX,
        "voyage_available": voyage_available and bool(os.getenv("VOYAGE_API_KEY")),
        "pinecone_available": pinecone_available and bool(config.PINECONE_API_KEY),
    }


# ── /rag/index — indexación de documentos en segundo plano ───────────────────

# Registro de tareas de indexación en memoria (se pierde al reiniciar)
_indexing_tasks: dict[str, dict] = {}


class RagIndexRequest(BaseModel):
    doc_name: str | None = Field(
        default=None,
        description="Nombre parcial del documento a indexar. None para indexar todos.",
    )
    dry_run: bool = Field(
        default=False,
        description="Si es True, simula la indexación sin escribir en Pinecone.",
    )


class RagIndexResponse(BaseModel):
    task_id: str
    status: str
    message: str


async def _run_indexing_task(task_id: str, doc_name: str | None, dry_run: bool) -> None:
    """Tarea de indexación que corre en segundo plano."""
    import sys
    from pathlib import Path

    # Importar el módulo de seed desde scripts/
    scripts_path = Path(__file__).parent / "scripts"
    if str(scripts_path) not in sys.path:
        sys.path.insert(0, str(scripts_path))

    try:
        from seed_cartagena import seed_all  # type: ignore[import]

        _indexing_tasks[task_id]["status"] = "running"
        results = await seed_all(dry_run=dry_run, doc_name=doc_name)

        indexed_total = sum(results.values())
        indexed_docs = [name for name, count in results.items() if count > 0]
        skipped_docs = [name for name, count in results.items() if count == 0]

        _indexing_tasks[task_id].update({
            "status": "completed",
            "indexed": indexed_total,
            "skipped": len(skipped_docs),
            "documents": indexed_docs,
        })
        logger.info(
            "[rag/index] task_id=%s completado: %d chunks en %d docs",
            task_id, indexed_total, len(indexed_docs),
        )
    except Exception as exc:
        logger.exception("[rag/index] task_id=%s error: %s", task_id, exc)
        _indexing_tasks[task_id].update({
            "status": "error",
            "error": str(exc),
        })


@app.post(
    "/rag/index",
    response_model=RagIndexResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["rag"],
)
async def rag_index(
    request: RagIndexRequest,
    background_tasks: BackgroundTasks,
    _auth: None = None,
) -> RagIndexResponse:
    """
    Dispara la indexación de documentos cívicos de Cartagena en Pinecone.
    La indexación corre en segundo plano — retorna 202 Accepted con un task_id.
    Requiere X-Service-Key.

    Para verificar el estado de la tarea: GET /rag/index/{task_id}
    """
    task_id = str(uuid.uuid4())

    _indexing_tasks[task_id] = {
        "status": "pending",
        "doc_name": request.doc_name,
        "dry_run": request.dry_run,
        "task_id": task_id,
        "indexed": 0,
        "skipped": 0,
        "documents": [],
    }

    background_tasks.add_task(
        _run_indexing_task,
        task_id=task_id,
        doc_name=request.doc_name,
        dry_run=request.dry_run,
    )

    logger.info(
        "[rag/index] tarea iniciada task_id=%s doc_name=%s dry_run=%s",
        task_id,
        request.doc_name or "all",
        request.dry_run,
    )

    return RagIndexResponse(
        task_id=task_id,
        status="pending",
        message=(
            f"Indexación {'(dry-run) ' if request.dry_run else ''}iniciada en segundo plano. "
            f"Consulta el estado en GET /rag/index/{task_id}"
        ),
    )


@app.get("/rag/index/{task_id}", tags=["rag"])
async def rag_index_status(
    task_id: str,
    _auth: None = None,
) -> dict:
    """
    Consulta el estado de una tarea de indexación iniciada con POST /rag/index.
    Requiere X-Service-Key.
    """
    task = _indexing_tasks.get(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tarea no encontrada: {task_id}",
        )
    return task
