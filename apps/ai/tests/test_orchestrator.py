"""
Tests de process_civic_query, rag_retrieval_node y constantes del orquestador.
El orquestador LangGraph está mockeado en conftest.py.
"""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from orchestrator import (
    AgentIntent,
    QueryRequest,
    QueryResponse,
    RAG_INTENTS,
    _TERRITORY_CODES,
    process_civic_query,
    rag_retrieval_node,
)


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


# ── RAG_INTENTS constant ──────────────────────────────────────────────────────

def test_rag_intents_contains_expected_agents():
    """Solo los agentes con capacidad RAG deben estar en RAG_INTENTS."""
    assert AgentIntent.CITIZEN    in RAG_INTENTS
    assert AgentIntent.POLICY     in RAG_INTENTS
    assert AgentIntent.TERRITORIAL in RAG_INTENTS
    assert AgentIntent.LEGAL      in RAG_INTENTS


def test_rag_intents_excludes_non_rag_agents():
    """Governance, integrity y comms no usan RAG (no tienen contexto documental)."""
    assert AgentIntent.GOVERNANCE not in RAG_INTENTS
    assert AgentIntent.INTEGRITY  not in RAG_INTENTS
    assert AgentIntent.COMMS      not in RAG_INTENTS


# ── _TERRITORY_CODES lookup ───────────────────────────────────────────────────

def test_territory_codes_cover_four_localities():
    codes = set(_TERRITORY_CODES.values())
    assert codes == {"CTG-01", "CTG-02", "CTG-03", "CTG-04"}


def test_territory_codes_both_accent_forms():
    assert _TERRITORY_CODES.get("historica")  == "CTG-01"
    assert _TERRITORY_CODES.get("histórica")  == "CTG-01"


def test_territory_codes_partial_match_keys():
    assert _TERRITORY_CODES.get("virgen")    == "CTG-02"
    assert _TERRITORY_CODES.get("la virgen") == "CTG-02"
    assert _TERRITORY_CODES.get("industrial") == "CTG-03"
    assert _TERRITORY_CODES.get("bayunca")   == "CTG-04"


# ── rag_retrieval_node ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rag_retrieval_node_calls_pipeline_with_last_message():
    """El nodo debe pasar el contenido del último mensaje a rag_pipeline.retrieve()."""
    state = {
        "messages": [{"role": "user", "content": "¿Cuál es el POT de Cartagena?"}],
        "territory": "",
        "intent": AgentIntent.TERRITORIAL,
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    mock_fragments = ["[POT]\nEl Plan de Ordenamiento Territorial establece..."]

    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(return_value=mock_fragments)

        result = await rag_retrieval_node(state)

    mock_rag.retrieve.assert_called_once()
    call_args = mock_rag.retrieve.call_args
    assert "POT" in call_args.args[0] or "POT" in call_args.kwargs.get("query", "")
    assert result["retrieved_docs"] == mock_fragments


@pytest.mark.asyncio
async def test_rag_retrieval_node_resolves_territory_code():
    """Cuando territory contiene 'histórica', debe pasar filter_locality='CTG-01'."""
    state = {
        "messages": [{"role": "user", "content": "¿Hay problemas de alcantarillado?"}],
        "territory": "Histórica",
        "intent": AgentIntent.TERRITORIAL,
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(return_value=[])
        await rag_retrieval_node(state)

    mock_rag.retrieve.assert_called_once()
    kwargs = mock_rag.retrieve.call_args.kwargs
    assert kwargs.get("filter_locality") == "CTG-01"


@pytest.mark.asyncio
async def test_rag_retrieval_node_no_locality_when_territory_unknown():
    """Un territorio desconocido no debe pasar filter_locality."""
    state = {
        "messages": [{"role": "user", "content": "Consulta general"}],
        "territory": "zona desconocida",
        "intent": AgentIntent.CITIZEN,
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(return_value=[])
        await rag_retrieval_node(state)

    kwargs = mock_rag.retrieve.call_args.kwargs
    assert kwargs.get("filter_locality") is None


@pytest.mark.asyncio
async def test_rag_retrieval_node_appends_to_existing_docs():
    """Si ya hay docs recuperados, el nodo debe añadir (no reemplazar)."""
    existing = ["[Ley 134]\nMecanismos de participación..."]
    state = {
        "messages": [{"role": "user", "content": "Más contexto"}],
        "territory": "",
        "intent": AgentIntent.CITIZEN,
        "retrieved_docs": existing,
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    new_docs = ["[POT]\nPlan de Ordenamiento..."]
    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(return_value=new_docs)
        result = await rag_retrieval_node(state)

    assert existing[0] in result["retrieved_docs"]
    assert new_docs[0] in result["retrieved_docs"]


@pytest.mark.asyncio
async def test_rag_retrieval_node_handles_pipeline_error_gracefully():
    """Si rag_pipeline.retrieve() lanza, el nodo devuelve lista vacía sin propagar."""
    state = {
        "messages": [{"role": "user", "content": "consulta"}],
        "territory": "",
        "intent": AgentIntent.CITIZEN,
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(side_effect=Exception("Pinecone timeout"))
        result = await rag_retrieval_node(state)

    assert result["retrieved_docs"] == []


@pytest.mark.asyncio
async def test_rag_retrieval_node_handles_empty_messages():
    """Sin mensajes en el estado no debe lanzar excepción."""
    state = {
        "messages": [],
        "territory": "",
        "intent": AgentIntent.CITIZEN,
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
    }

    with patch("orchestrator.rag_pipeline") as mock_rag:
        mock_rag.retrieve = AsyncMock(return_value=[])
        result = await rag_retrieval_node(state)

    assert "retrieved_docs" in result
