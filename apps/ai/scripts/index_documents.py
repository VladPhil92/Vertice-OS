"""
Script de indexación de documentos cívicos de Cartagena en Pinecone.

Uso:
    python scripts/index_documents.py --source docs/pot.txt --doc-type pot --locality CTG-01
    python scripts/index_documents.py --source docs/plan-desarrollo.txt --doc-type plan

Variables de entorno requeridas:
    PINECONE_API_KEY
    PINECONE_INDEX
    VOYAGE_API_KEY
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import re
import sys
from pathlib import Path

# Añadir el directorio padre al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from rag import rag_pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CHUNK_SIZE   = 800   # chars aprox — ~200 tokens para voyage-3
CHUNK_OVERLAP = 100  # solapamiento entre chunks


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Divide el texto en chunks con solapamiento."""
    # Limpiar espacios múltiples y líneas vacías excesivas
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    text = re.sub(r' {2,}', ' ', text)

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        # Intentar cortar en límite de párrafo
        if end < len(text):
            last_newline = text.rfind('\n', start, end)
            if last_newline > start + size // 2:
                end = last_newline
        chunks.append(text[start:end].strip())
        start = end - overlap

    return [c for c in chunks if len(c) > 50]


async def index_file(
    path: Path,
    doc_type: str,
    locality: str | None,
    source_name: str | None,
) -> int:
    """Indexa un archivo de texto en Pinecone. Retorna número de chunks indexados."""
    if not rag_pipeline.is_available:
        logger.error("Pinecone no está disponible. Verifica PINECONE_API_KEY y PINECONE_INDEX.")
        return 0

    text = path.read_text(encoding="utf-8", errors="replace")
    chunks = chunk_text(text)
    source = source_name or path.stem

    logger.info("Indexando %d chunks de '%s' (tipo: %s)…", len(chunks), source, doc_type)

    indexed = 0
    for i, chunk in enumerate(chunks):
        doc_id = hashlib.sha256(f"{source}:{i}:{chunk[:100]}".encode()).hexdigest()[:32]
        metadata: dict = {
            "source": source,
            "doc_type": doc_type,
            "chunk_index": i,
            "total_chunks": len(chunks),
        }
        if locality:
            metadata["locality"] = locality

        ok = await rag_pipeline.upsert_document(doc_id, chunk, metadata)
        if ok:
            indexed += 1
        else:
            logger.warning("Error indexando chunk %d", i)

    logger.info("✅ %d/%d chunks indexados para '%s'", indexed, len(chunks), source)
    return indexed


async def main() -> None:
    parser = argparse.ArgumentParser(description="Indexa documentos cívicos en Pinecone")
    parser.add_argument("--source", required=True, help="Ruta al archivo de texto (.txt, .md)")
    parser.add_argument(
        "--doc-type",
        required=True,
        choices=["pot", "plan", "normativa", "acta", "estatuto", "otro"],
        help="Tipo de documento",
    )
    parser.add_argument(
        "--locality",
        choices=["CTG-01", "CTG-02", "CTG-03", "CTG-04"],
        default=None,
        help="Código de localidad (opcional — para documentos zonales)",
    )
    parser.add_argument("--name", default=None, help="Nombre del documento para metadatos")
    args = parser.parse_args()

    path = Path(args.source)
    if not path.exists():
        logger.error("Archivo no encontrado: %s", path)
        sys.exit(1)

    total = await index_file(path, args.doc_type, args.locality, args.name)
    if total == 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
