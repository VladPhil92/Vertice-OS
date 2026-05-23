"""
Tests de process_civic_query — cubre timeout, error inesperado y flujo exitoso.
El orquestador LangGraph está mockeado en conftest.py.
"""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from orchestrator import AgentIntent, QueryRequest, QueryResponse, process_civic_query


@pytest.mark.asyncio
async def test_process_civic_query_returns_query_response():
    """Flujo exitoso: el estado del grafo se convierte en QueryResponse."""
    mock_result = {
        "response": "Puedes participar registrándote en VÉRTICE OS con tu cédula.",
        "intent": AgentIntent.CITIZEN,
        "confidence": 0.85,
        "audit_log": [],
    }

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = AsyncMock(return_value=mock_result)

        result = await process_civic_query(
            QueryRequest(
                message="¿Cómo puedo participar en una votación?",
                citizen_id="550e8400-e29b-41d4-a716-446655440000",
                territory="Histórica",
            )
        )

    assert isinstance(result, QueryResponse)
    assert result.response == "Puedes participar registrándote en VÉRTICE OS con tu cédula."
    assert result.agent_used == "citizen"
    assert result.confidence == 0.85
    assert len(result.audit_id) == 36  # UUID format


@pytest.mark.asyncio
async def test_process_civic_query_timeout_returns_graceful_response():
    """Un timeout no debe propagar excepción — debe devolver QueryResponse con agent_used='timeout'."""

    async def never_resolves(_state):
        await asyncio.sleep(999)

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = never_resolves
        with patch("orchestrator.ORCHESTRATOR_TIMEOUT_SECONDS", 0.01):
            result = await process_civic_query(QueryRequest(message="test timeout"))

    assert isinstance(result, QueryResponse)
    assert result.agent_used == "timeout"
    assert result.confidence == 0.0
    assert "intenta de nuevo" in result.response.lower()


@pytest.mark.asyncio
async def test_process_civic_query_unexpected_error_returns_graceful_response():
    """Errores inesperados no deben propagar — devuelven agent_used='error'."""

    async def raises_runtime(_state):
        raise RuntimeError("boom")

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = raises_runtime

        result = await process_civic_query(QueryRequest(message="test error"))

    assert isinstance(result, QueryResponse)
    assert result.agent_used == "error"
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_process_civic_query_fallback_when_response_is_none():
    """Si el grafo devuelve response=None se usa texto de fallback."""
    mock_result = {
        "response": None,
        "intent": None,
        "confidence": 0.0,
    }

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = AsyncMock(return_value=mock_result)

        result = await process_civic_query(QueryRequest(message="pregunta sin respuesta"))

    assert result.response == "No se pudo generar una respuesta."
    assert result.agent_used == "unknown"


@pytest.mark.asyncio
async def test_process_civic_query_audit_id_is_unique():
    """Cada consulta genera un audit_id diferente."""
    mock_result = {"response": "ok", "intent": AgentIntent.CITIZEN, "confidence": 0.9}

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = AsyncMock(return_value=mock_result)

        r1 = await process_civic_query(QueryRequest(message="consulta 1"))
        r2 = await process_civic_query(QueryRequest(message="consulta 2"))

    assert r1.audit_id != r2.audit_id


@pytest.mark.asyncio
async def test_process_civic_query_anonymous_user():
    """Consultas anónimas (sin citizen_id) funcionan correctamente."""
    mock_result = {"response": "ok", "intent": AgentIntent.TERRITORIAL, "confidence": 0.75}

    with patch("orchestrator.orchestrator") as mock_orch:
        mock_orch.ainvoke = AsyncMock(return_value=mock_result)

        result = await process_civic_query(QueryRequest(message="¿Cuál es el estado de las vías?"))

    assert result.agent_used == "territorial"
    assert result.confidence == 0.75
