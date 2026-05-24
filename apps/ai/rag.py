"""
Pipeline RAG con Pinecone para VÉRTICE OS.

Genera embeddings con el modelo voyage-3 de Voyage AI (recomendado por Anthropic)
o cae en un stub si las claves no están configuradas.

Documentos indexados (Fase II):
  - POT Cartagena 2001-2011 (Plan de Ordenamiento Territorial)
  - Plan de Desarrollo Cartagena 2024-2027
  - Estatuto Tributario Distrital
  - Actas de JAC por localidad
  - Normas: Ley 472/1998, Ley 1437/2011, CP Colombia
"""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import config

logger = logging.getLogger(__name__)

# ── Pinecone ──────────────────────────────────────────────────────────────────

try:
    from pinecone import Pinecone as _PineconeClient  # type: ignore[import]
    _PINECONE_AVAILABLE = True
except ImportError:
    _PINECONE_AVAILABLE = False
    logger.info("[rag] pinecone no instalado — RAG desactivado")

# ── Voyage AI (embeddings) ────────────────────────────────────────────────────

try:
    import voyageai  # type: ignore[import]
    _VOYAGE_AVAILABLE = True
except ImportError:
    _VOYAGE_AVAILABLE = False
    logger.info("[rag] voyageai no instalado — usando fallback de embeddings")

# ── Anthropic (fallback embeddings via messages) ──────────────────────────────
# Nota: Claude no expone directamente un endpoint de embeddings, así que
# usamos voyage-3 como primera opción y un hash-vector de emergencia si no.

EMBEDDING_MODEL = "voyage-3"
EMBEDDING_DIM   = 1024  # voyage-3 produce 1024 dimensiones


def _hash_embedding(text: str) -> list[float]:
    """
    Fallback determinístico cuando Voyage AI no está disponible.
    Produce un vector de 1024 floats en [-1, 1] a partir del hash del texto.
    NO ES ÚTIL para semántica — solo para que el código no falle.
    """
    digest = hashlib.sha512(text.encode()).digest()
    return [(b / 127.5) - 1.0 for b in digest[:EMBEDDING_DIM // 4] * 4]


async def _embed(text: str) -> list[float]:
    """Genera embedding para el texto. Prioridad: Voyage AI → hash fallback."""
    voyage_key = os.getenv("VOYAGE_API_KEY", "")

    if _VOYAGE_AVAILABLE and voyage_key:
        try:
            vo = voyageai.AsyncClient(api_key=voyage_key)
            result = await vo.embed([text], model=EMBEDDING_MODEL, input_type="query")
            return result.embeddings[0]
        except Exception as exc:
            logger.warning("[rag] error generando embedding con Voyage AI: %s", exc)

    return _hash_embedding(text)


# ── Pipeline principal ────────────────────────────────────────────────────────

class RAGPipeline:
    """Retrieval-Augmented Generation sobre documentos cívicos de Cartagena."""

    def __init__(self) -> None:
        self._client: Any = None
        self._index: Any = None

    def _ensure_initialized(self) -> bool:
        if not config.PINECONE_API_KEY or not _PINECONE_AVAILABLE:
            return False
        if self._client is None:
            try:
                self._client = _PineconeClient(api_key=config.PINECONE_API_KEY)
                self._index = self._client.Index(config.PINECONE_INDEX)
                logger.info("[rag] Pinecone conectado — índice: %s", config.PINECONE_INDEX)
            except Exception as exc:
                logger.warning("[rag] error inicializando Pinecone: %s", exc)
                self._client = None
                return False
        return True

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filter_locality: str | None = None,
        filter_doc_type: str | None = None,
    ) -> list[str]:
        """
        Recupera los fragmentos más relevantes para la consulta.

        Args:
            query:            Consulta del ciudadano en lenguaje natural.
            top_k:            Número de fragmentos a recuperar.
            filter_locality:  Código de localidad ('CTG-01'…'CTG-04') para
                              filtrar documentos por zona geográfica.
            filter_doc_type:  Tipo de documento ('normativa', 'plan', 'acta', 'pot').

        Returns:
            Lista de fragmentos de texto ordenados por relevancia.
            Lista vacía si Pinecone no está configurado o hay un error.
        """
        if not self._ensure_initialized():
            return []

        try:
            embedding = await _embed(query)

            # Construir filtro de metadatos
            metadata_filter: dict[str, Any] = {}
            if filter_locality:
                metadata_filter["locality"] = {"$eq": filter_locality}
            if filter_doc_type:
                metadata_filter["doc_type"] = {"$eq": filter_doc_type}

            query_kwargs: dict[str, Any] = {
                "vector": embedding,
                "top_k": top_k,
                "include_metadata": True,
            }
            if metadata_filter:
                query_kwargs["filter"] = metadata_filter

            results = self._index.query(**query_kwargs)
            matches = results.get("matches", [])

            fragments: list[str] = []
            for match in matches:
                metadata = match.get("metadata", {})
                text = metadata.get("text", "")
                source = metadata.get("source", "")
                if text:
                    fragments.append(f"[{source}]\n{text}" if source else text)

            logger.debug("[rag] %d fragmentos recuperados para: %.60s…", len(fragments), query)
            return fragments

        except Exception as exc:
            logger.warning("[rag] error en retrieve: %s", exc)
            return []

    async def upsert_document(
        self,
        doc_id: str,
        text: str,
        metadata: dict[str, Any],
    ) -> bool:
        """
        Indexa un fragmento de documento en Pinecone.

        Args:
            doc_id:   Identificador único del fragmento.
            text:     Texto del fragmento (recomendado: 300-500 tokens).
            metadata: Metadatos: source, doc_type, locality, page, url, etc.

        Returns:
            True si se indexó correctamente, False en caso de error.
        """
        if not self._ensure_initialized():
            return False

        try:
            embedding = await _embed(text)
            metadata_with_text = {**metadata, "text": text[:2000]}  # Pinecone limit
            self._index.upsert(vectors=[{
                "id": doc_id,
                "values": embedding,
                "metadata": metadata_with_text,
            }])
            return True
        except Exception as exc:
            logger.warning("[rag] error en upsert: %s", exc)
            return False

    def format_context(self, fragments: list[str], max_chars: int = 3000) -> str:
        """
        Formatea los fragmentos recuperados como contexto para el LLM.
        Trunca si excede max_chars.
        """
        if not fragments:
            return ""

        lines: list[str] = ["--- Contexto documental recuperado ---"]
        total = len(lines[0])

        for i, frag in enumerate(fragments, 1):
            block = f"\n[Fragmento {i}]\n{frag}"
            if total + len(block) > max_chars:
                break
            lines.append(block)
            total += len(block)

        lines.append("--- Fin del contexto ---")
        return "\n".join(lines)

    @property
    def is_available(self) -> bool:
        return self._ensure_initialized()

    @property
    def status(self) -> str:
        if not _PINECONE_AVAILABLE:
            return "not_installed"
        if not config.PINECONE_API_KEY:
            return "no_api_key"
        return "ok" if self._ensure_initialized() else "error"


rag_pipeline = RAGPipeline()
