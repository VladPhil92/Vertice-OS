"""
Configura mocks de sys.modules para anthropic y langgraph ANTES de que los test files
importen orchestrator.py. Esto evita instalar dependencias pesadas en CI ligero.
"""
import sys
from unittest.mock import AsyncMock, MagicMock


# ── Anthropic mock ────────────────────────────────────────────────────────────

class _APIStatusError(Exception):
    def __init__(self, message: str = "", *, status_code: int = 500, response=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class _APIConnectionError(Exception):
    pass


mock_anthropic = MagicMock()
mock_anthropic.APIStatusError = _APIStatusError
mock_anthropic.APIConnectionError = _APIConnectionError
mock_anthropic.Anthropic.return_value = MagicMock()

sys.modules["anthropic"] = mock_anthropic

# ── LangGraph mock ────────────────────────────────────────────────────────────
# El grafo compilado debe tener ainvoke awaitable

_default_invoke_result: dict = {
    "response": "Respuesta de prueba del orquestador.",
    "intent": None,
    "confidence": 0.0,
    "audit_log": [],
}

mock_compiled_graph = MagicMock()
mock_compiled_graph.ainvoke = AsyncMock(return_value=_default_invoke_result)

mock_workflow = MagicMock()
mock_workflow.compile.return_value = mock_compiled_graph

mock_StateGraph = MagicMock(return_value=mock_workflow)

mock_lg_graph = MagicMock()
mock_lg_graph.StateGraph = mock_StateGraph
mock_lg_graph.END = "__end__"
mock_lg_graph.START = "__start__"

mock_lg_graph_message = MagicMock()
mock_lg_graph_message.add_messages = MagicMock()

sys.modules["langgraph"] = MagicMock()
sys.modules["langgraph.graph"] = mock_lg_graph
sys.modules["langgraph.graph.message"] = mock_lg_graph_message
sys.modules["langchain_core"] = MagicMock()
sys.modules["langchain_core.messages"] = MagicMock()
