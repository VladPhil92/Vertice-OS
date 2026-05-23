"""
VÉRTICE OS — AI Service
FastAPI wrapper sobre el orquestador multi-agente.
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from orchestrator import QueryRequest, QueryResponse, process_civic_query

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "info").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VÉRTICE OS — AI Orchestrator",
    version="0.1.0",
    description="Servicio de IA multi-agente para el Sistema Operativo Cívico de Cartagena",
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGIN", "http://localhost:4000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
async def validation_exception_handler(_request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Datos de entrada inválidos", "details": exc.errors()},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("[main] error no manejado: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Error interno del servidor"},
    )


@app.get("/health", tags=["infra"])
async def health() -> dict:
    return {"status": "ok", "service": "ai-orchestrator", "version": "0.1.0"}


@app.post("/civic/query", response_model=QueryResponse, tags=["orchestrator"])
async def civic_query(request: QueryRequest) -> QueryResponse:
    """
    Procesa una consulta ciudadana a través del orquestador multi-agente.
    El router determina el agente especializado (ciudadano, gobernanza, territorial, etc.)
    """
    logger.info(
        "[query] citizen_id=%s territory=%s",
        request.citizen_id or "anon",
        request.territory or "—",
    )
    return await process_civic_query(request)
