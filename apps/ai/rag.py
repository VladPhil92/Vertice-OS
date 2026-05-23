"""
Pipeline RAG con Pinecone para VÉRTICE OS.

Fase I: stub funcional — retorna lista vacía si Pinecone no está configurado.
Fase II: indexar documentos de Cartagena (POT, Plan de Desarrollo, normas, actas JAC).
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

try:
    from pinecone import Pinecone as _PineconeClient  # type: ignore[import]
    _PINECONE_AVAILABLE = True
except ImportError:
    _PINECONE_AVAILABLE = False
    logger.info("[rag] pinecone no instalado — RAG desactivado")


class RAGPipeline:
    """Retrieval-Augmented Generation sobre documentos cívicos de Cartagena."""

    def __init__(self) -> None:
        self._client = None
        self._index = None

    def _ensure_initialized(self) -> bool:
        api_key = os.getenv("PINECONE_API_KEY", "")
        if not api_key or not _PINECONE_AVAILABLE:
            return False
        if self._client is None:
            try:
                self._client = _PineconeClient(api_key=api_key)
                index_name = os.getenv("PINECONE_INDEX", "vertice-os")
                self._index = self._client.Index(index_name)
            except Exception as exc:
                logger.warning("[rag] error inicializando Pinecone: %s", exc)
                return False
        return True

    async def retrieve(self, query: str, top_k: int = 3) -> list[str]:
        """
        Recupera documentos relevantes para la consulta.
        Devuelve lista vacía si Pinecone no está configurado.

        Fase II: generar embedding con text-embedding-3-small y consultar el índice.
        """
        if not self._ensure_initialized():
            return []

        try:
            # Fase II: embedding + query
            # embedding = await embed_query(query)
            # results = self._index.query(vector=embedding, top_k=top_k, include_metadata=True)
            # return [m["metadata"]["text"] for m in results["matches"]]
            return []
        except Exception as exc:
            logger.warning("[rag] error recuperando documentos: %s", exc)
            return []

    @property
    def is_available(self) -> bool:
        return self._ensure_initialized()

    @property
    def status(self) -> str:
        if not _PINECONE_AVAILABLE:
            return "not_installed"
        if not os.getenv("PINECONE_API_KEY"):
            return "no_api_key"
        return "ok" if self._ensure_initialized() else "error"


rag_pipeline = RAGPipeline()
