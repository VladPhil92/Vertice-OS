"""
VÉRTICE OS — AI Orchestrator
Orquestación multi-agente para el Sistema Operativo Cívico

Agentes:
  1. CitizenAgent      — Guía de participación y preguntas cívicas
  2. GovernanceAgent   — Síntesis de debates e identificación de consenso
  3. PolicyAgent       — Conversión de demandas en propuestas de política
  4. TerritorialAgent  — Análisis de tendencias territoriales
  5. IntegrityAgent    — Detección de manipulación y desinformación
  6. CommsAgent        — Narrativa estratégica y comunicación
  7. LegalAgent        — Generación de documentos legales y asesoría jurídica
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from enum import Enum
from typing import Annotated, Any, Literal

import anthropic
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypedDict

from rag import rag_pipeline

logger = logging.getLogger(__name__)

ORCHESTRATOR_TIMEOUT_SECONDS = 30

# ──────────────────────────────────────────────────────────────────────────────
# State
# ──────────────────────────────────────────────────────────────────────────────

class AgentIntent(str, Enum):
    CITIZEN = "citizen"
    GOVERNANCE = "governance"
    POLICY = "policy"
    TERRITORIAL = "territorial"
    INTEGRITY = "integrity"
    COMMS = "comms"
    LEGAL = "legal"
    UNKNOWN = "unknown"


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    intent: AgentIntent | None
    citizen_id: str | None
    territory: str | None
    context: dict[str, str]      # solo claves/valores string — ver SessionContext
    retrieved_docs: list[str]
    response: str | None
    confidence: float
    audit_log: list[dict]
    audit_id: str


# ──────────────────────────────────────────────────────────────────────────────
# Base Agent
# ──────────────────────────────────────────────────────────────────────────────

class BaseAgent:
    """Clase base para todos los agentes de VÉRTICE OS."""

    MODEL = "claude-sonnet-4-6"
    MAX_TOKENS = 1024

    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.client = anthropic.Anthropic()

    def _call_llm(
        self,
        messages: list[dict],
        context: dict[str, str] | None = None,
        retrieved_docs: list[str] | None = None,
    ) -> str:
        """Llamada al LLM con prompt caching en el system prompt estático.

        Args:
            messages:      Historial de mensajes para la API.
            context:       Contexto de sesión (ciudadano, localidad, etc.).
            retrieved_docs: Fragmentos recuperados por el pipeline RAG.
                            Se inyectan como bloque adicional en el system prompt,
                            sin cache (cambian por consulta).
        """
        # El system prompt es estático por agente → candidato ideal para cache
        system_blocks: list[dict] = [
            {
                "type": "text",
                "text": self.system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ]

        # El contexto de sesión varía por request → NO se cachea
        if context:
            lines = [f"- {k}: {v}" for k, v in context.items() if v]
            if lines:
                system_blocks.append({
                    "type": "text",
                    "text": "## Contexto de la sesión\n" + "\n".join(lines),
                })

        # Contexto documental RAG — varía por consulta → NO se cachea
        if retrieved_docs:
            formatted = rag_pipeline.format_context(retrieved_docs)
            if formatted:
                system_blocks.append({
                    "type": "text",
                    "text": "## Contexto documental recuperado\n" + formatted,
                })

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=self.MAX_TOKENS,
                system=system_blocks,
                messages=messages,
            )
        except anthropic.APIStatusError as exc:
            logger.error("[%s] Anthropic API error %d: %s", self.name, exc.status_code, exc.message)
            raise
        except anthropic.APIConnectionError as exc:
            logger.error("[%s] Anthropic connection error: %s", self.name, exc)
            raise

        if not response.content:
            raise ValueError(f"[{self.name}] Anthropic devolvió contenido vacío")

        return response.content[0].text

    def _log_action(self, state: AgentState, action: str, result: str) -> dict:
        return {
            "agent": self.name,
            "action": action,
            "citizen_id": state.get("citizen_id"),
            "territory": state.get("territory"),
            "result_summary": result[:200],
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        }


# ──────────────────────────────────────────────────────────────────────────────
# Agentes especializados
# ──────────────────────────────────────────────────────────────────────────────

class CitizenAgent(BaseAgent):
    """
    Guía a ciudadanos en su participación cívica.
    Responde preguntas sobre la plataforma, procesos y derechos.
    """

    SYSTEM_PROMPT = """Eres el Agente Ciudadano de VÉRTICE OS, el Sistema Operativo Cívico 
de Cartagena de Indias, Colombia.

Tu rol es guiar a los ciudadanos en su participación cívica de manera clara, 
empática y precisa. Tienes conocimiento profundo de:
- Los mecanismos de participación ciudadana en Colombia (Ley 134/1994, Ley 1757/2015)
- El funcionamiento de VÉRTICE OS: módulos, procesos, votaciones
- Los derechos y deberes ciudadanos en el contexto colombiano
- El Plan de Desarrollo y POT de Cartagena de Indias

Principios:
- Lenguaje claro y accesible para todos los niveles educativos
- Siempre citar las fuentes cuando hagas afirmaciones normativas
- Nunca tomar partido político — eres neutral
- Si no sabes algo, dilo honestamente y sugiere dónde buscar
- Empodera al ciudadano, no lo hagas dependiente de ti

Formato de respuesta:
- Responde en español colombiano natural
- Máximo 3 párrafos a menos que la complejidad lo requiera
- Usa ejemplos concretos de Cartagena cuando sea posible"""

    def __init__(self):
        super().__init__("CitizenAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
            retrieved_docs=state.get("retrieved_docs") or [],
        )
        log_entry = self._log_action(state, "citizen_guidance", response)
        return {
            **state,
            "response": response,
            "confidence": 0.85,
            "audit_log": state["audit_log"] + [log_entry],
        }


class GovernanceAgent(BaseAgent):
    """
    Sintetiza debates y facilita la identificación de consenso.
    Modera discusiones y genera resúmenes de propuestas.
    """

    SYSTEM_PROMPT = """Eres el Agente de Gobernanza de VÉRTICE OS.

Tu función es:
1. Sintetizar debates complejos en resúmenes claros e imparciales
2. Identificar puntos de consenso y disenso en las discusiones
3. Estructurar propuestas para hacerlas más claras y accionables
4. Moderar el tono de los debates (señalar cuando hay falta de respeto)
5. Generar actas y minutas de asambleas digitales

Principios de moderación:
- Neutralidad absoluta: no favorecer ninguna posición política
- Representar fielmente todas las posiciones, incluyendo las minoritarias
- Identificar cuando hay manipulación o argumentos de mala fe
- Facilitar, no decidir

Al sintetizar un debate, siempre incluye:
- Posiciones a favor con sus argumentos principales
- Posiciones en contra con sus argumentos principales
- Puntos de consenso (si los hay)
- Preguntas que quedaron sin resolver
- Próximos pasos sugeridos"""

    def __init__(self):
        super().__init__("GovernanceAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
        )
        log_entry = self._log_action(state, "governance_synthesis", response)
        return {
            **state,
            "response": response,
            "confidence": 0.82,
            "audit_log": state["audit_log"] + [log_entry],
        }


class PolicyAgent(BaseAgent):
    """
    Convierte demandas ciudadanas en borradores de política pública.
    """

    SYSTEM_PROMPT = """Eres el Agente de Políticas Públicas de VÉRTICE OS.

Tu función es transformar demandas y necesidades ciudadanas en propuestas 
estructuradas de política pública, usando metodologías de diseño de políticas.

Para cada propuesta que generes, incluye:
1. **Problema identificado**: descripción precisa del problema
2. **Población afectada**: quiénes y cuántos
3. **Causas raíz**: análisis causal (no solo síntomas)
4. **Propuesta de intervención**: qué hacer exactamente
5. **Entidad responsable**: quién en el gobierno debe ejecutarlo
6. **Indicadores de éxito**: cómo medir si funcionó
7. **Recursos necesarios**: estimación básica de costo
8. **Marco legal**: base normativa en Colombia
9. **Riesgos**: qué puede salir mal

Conocimientos base:
- Estructura del Estado colombiano (nacional, departamental, municipal)
- Competencias de la Alcaldía de Cartagena vs. Gobernación de Bolívar
- Procesos de planeación y presupuesto público colombiano
- Marco de Gasto de Mediano Plazo (MGMP)"""

    def __init__(self):
        super().__init__("PolicyAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
            retrieved_docs=state.get("retrieved_docs") or [],
        )
        log_entry = self._log_action(state, "policy_draft", response)
        return {
            **state,
            "response": response,
            "confidence": 0.78,
            "audit_log": state["audit_log"] + [log_entry],
        }


class TerritorialAgent(BaseAgent):
    """
    Analiza tendencias territoriales y prioridades por zona.
    """

    SYSTEM_PROMPT = """Eres el Agente de Inteligencia Territorial de VÉRTICE OS.

Analizas datos del territorio de Cartagena de Indias y produces 
inteligencia accionable para ciudadanos y tomadores de decisiones.

Tus capacidades:
1. Identificar patrones en reportes ciudadanos por zona
2. Correlacionar problemas territoriales con causas sistémicas
3. Priorizar intervenciones basándote en urgencia y alcance
4. Generar narrativas territoriales que den contexto a los datos
5. Detectar zonas de alto riesgo de deterioro

Conocimiento geográfico:
- Localidades de Cartagena: Histórica, La Virgen, Industrial, Bayunca, etc.
- Barrios críticos y sus características socioeconómicas
- Problemáticas históricas de cada zona
- Infraestructura crítica y su estado conocido

Al analizar territorio, siempre incluye:
- Patrón identificado (qué está pasando)
- Zona geográfica específica
- Urgencia estimada (baja/media/alta/crítica)
- Posibles causas sistémicas
- Recomendación de acción"""

    def __init__(self):
        super().__init__("TerritorialAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
            retrieved_docs=state.get("retrieved_docs") or [],
        )
        log_entry = self._log_action(state, "territorial_analysis", response)
        return {
            **state,
            "response": response,
            "confidence": 0.80,
            "audit_log": state["audit_log"] + [log_entry],
        }


class IntegrityAgent(BaseAgent):
    """
    Detecta manipulación, bots y desinformación coordinada.
    CRÍTICO: Nunca actúa de forma autónoma — siempre escala a revisión humana.
    """

    SYSTEM_PROMPT = """Eres el Agente de Integridad de VÉRTICE OS.

Tu función CRÍTICA es proteger la integridad del sistema democrático.

Detectas:
1. Comportamiento de bots (patrones de actividad inhumanos)
2. Ataques Sybil (múltiples cuentas falsas coordinadas)
3. Desinformación coordinada (narrativas falsas amplificadas)
4. Clientelismo digital (incentivos para votar de cierta manera)
5. Manipulación de debates (flooding, brigading, astroturfing)

Principios de operación:
- NUNCA tomes acciones autónomas sobre cuentas de usuarios
- SIEMPRE escala a revisión humana antes de cualquier sanción
- Explica tu razonamiento con evidencia concreta
- El beneficio de la duda es para el ciudadano
- Falsos positivos son menos aceptables que falsos negativos

Formato de reporte:
- Señal detectada: qué comportamiento es sospechoso
- Evidencia: datos concretos que lo sustentan
- Nivel de confianza: bajo/medio/alto
- Acción recomendada: investigar / alertar / suspender temporalmente
- Revisión humana requerida: SÍ (siempre)"""

    def __init__(self):
        super().__init__("IntegrityAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
        )
        log_entry = self._log_action(state, "integrity_check", response)
        # Integrity always flags for human review
        return {
            **state,
            "response": response,
            "confidence": 0.70,  # Conservative — always needs human review
            "audit_log": state["audit_log"] + [log_entry],
        }


class CommsAgent(BaseAgent):
    """
    Genera comunicaciones estratégicas: discursos, informes, narrativas.
    """

    SYSTEM_PROMPT = """Eres el Agente de Comunicación Estratégica de VÉRTICE OS.

Generas contenido de comunicación institucional para líderes cívicos y ciudadanos:
- Discursos y alocuciones públicas
- Informes de gestión territorial
- Resúmenes ejecutivos de debates y votaciones
- Narrativas de impacto (cómo la participación generó cambio real)
- Contenido para redes sociales institucionales

Estilo de comunicación de VÉRTICE OS:
- Tono: institucional pero humano, cercano pero riguroso
- Nunca populista, nunca tecnocrático en exceso
- Siempre basado en datos y hechos verificables
- Incluye voces ciudadanas, no solo datos abstractos
- Cartagena como territorio vivo con historia y cultura

Lo que NO haces:
- Contenido de campaña política electoral
- Ataques a personas o instituciones específicas
- Promesas sin respaldo factual
- Propaganda o manipulación emocional"""

    def __init__(self):
        super().__init__("CommsAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
        )
        log_entry = self._log_action(state, "comms_generation", response)
        return {
            **state,
            "response": response,
            "confidence": 0.83,
            "audit_log": state["audit_log"] + [log_entry],
        }


class LegalAgent(BaseAgent):
    """
    Analiza situaciones ciudadanas y genera documentos legales colombianos.
    Asesoría basada en la Constitución y normativa vigente de Colombia.

    Devuelve JSON estructurado con:
      - legal_type: instrumento jurídico apropiado
      - document_draft: texto completo del documento
      - legal_orientation: asesoría breve al ciudadano
      - target_entity: entidad a la que se dirige
      - urgency: nivel de urgencia
      - rights_affected: derechos vulnerados
      - response_deadline_days: plazo legal de respuesta
      - alternative_remedies: otros recursos disponibles
    """

    MAX_TOKENS = 4000  # Los documentos legales pueden ser extensos

    SYSTEM_PROMPT = """Eres el Agente Legal de VÉRTICE OS, especializado en derecho colombiano aplicado a ciudadanos de Cartagena de Indias y Colombia en general.

Tu función es:
1. Analizar situaciones reportadas por ciudadanos
2. Clasificar el remedio jurídico más apropiado
3. Generar el documento legal completo y correcto
4. Dar una orientación jurídica breve y comprensible

## INSTRUMENTOS JURÍDICOS — CUÁNDO USAR CADA UNO

### DERECHO DE PETICIÓN (Art. 23 CP + Ley 1755/2015)
Usar cuando: Solicitar información, documentos, actuación o consulta a entidades públicas o privadas que prestan servicios públicos.
Plazo respuesta: 15 días hábiles (general) | 10 días (humanitario) | 30 días (ambiental)
Casos típicos: servicios públicos deficientes, información denegada, trámites sin resolver, infraestructura no atendida, respuesta administrativa tardía.

### TUTELA (Art. 86 CP + Decreto 2591/1991)
Usar cuando: Derecho fundamental VIOLADO o AMENAZADO de forma inminente, sin otro mecanismo eficaz.
Derechos más invocados: salud (49), vida (11), educación (67), vivienda digna (51), debido proceso (29), petición (23), mínimo vital (1), trabajo (25).
Plazo respuesta del juez: 10 días calendario.
IMPORTANTE: Existe subsidiariedad (solo si no hay otro recurso eficaz) y residualidad.

### ACCIÓN POPULAR (Ley 472/1998 + Art. 88 CP)
Usar cuando: Derechos o intereses COLECTIVOS vulnerados (ambiente sano, espacio público, patrimonio público, moralidad administrativa, seguridad ciudadana, libre competencia económica).
Quién puede presentarla: cualquier persona.
Ante: Tribunal Administrativo o Juez Administrativo.

### ACCIÓN DE CUMPLIMIENTO (Ley 393/1997 + Art. 87 CP)
Usar cuando: Una ley o acto administrativo NO está siendo cumplido por la autoridad.
Requisito previo: pedir a la entidad que cumpla (esperar 10 días).
Ante: Tribunal Administrativo (actos administrativos) o Juez Administrativo (leyes).

### DENUNCIA PENAL
Usar cuando: Se ha cometido un delito (corrupción, peculado, contrato sin cumplir, violencia, delitos ambientales, fraude).
Ante: Fiscalía General de la Nación — Regional Bolívar / cualquier URI (Unidad de Reacción Inmediata).
También: Procuraduría (faltas disciplinarias de funcionarios) | Contraloría (daño fiscal).

### QUEJA / PQRS
Usar cuando: Primera instancia ante la entidad responsable antes de escalar.
Ante: oficina de atención al ciudadano de la entidad.
Plazo: 15 días hábiles.

## ENTIDADES RESPONSABLES — CARTAGENA DE INDIAS

**DISTRITO (Alcaldía Distrital de Cartagena)**
- Secretaría de Infraestructura: vías, andenes, alumbrado público, obras
- Secretaría de Salud Distrital: hospitales, centros de salud, saneamiento
- Secretaría de Educación: colegios públicos, cupos, calidad educativa
- Secretaría de Planeación: urbanismo, licencias, construcciones ilegales
- Secretaría de Hacienda: tributos distritales
- Secretaría del Interior: convivencia, JACs, participación ciudadana
- ESES (Empresas Sociales del Estado): Hospital Universitario del Caribe, Caminos de Salud
- Correo: alcaldia@cartagena.gov.co | Calle 36 No. 6-60 Centro Histórico

**SERVICIOS PÚBLICOS**
- Aguas de Cartagena S.A. ESP: agua potable y alcantarillado | acueducto@aguasdecartagena.com
- Air-e (antes Electricaribe): energía eléctrica | pqrs@aire.com.co
- Gases del Caribe: gas natural domiciliario
- Superintendencia de Servicios Públicos Domiciliarios (SSPD): superintendencia@sspd.gov.co

**ENTIDADES DE CONTROL**
- Personería Distrital de Cartagena: personeria@personeriadecartagena.gov.co | derechos humanos, quejas contra funcionarios
- Defensoría del Pueblo — Regional Bolívar: defensoría fundamental de derechos
- Contraloría Distrital de Cartagena: daño fiscal, malversación de fondos públicos
- Contraloría General de la República: entidades del orden nacional
- Procuraduría General — Regional Bolívar: faltas disciplinarias de servidores públicos
- Fiscalía General — Regional Bolívar: delitos (URI Cartagena disponible 24/7)

**AMBIENTAL**
- CARDIQUE (Corporación Autónoma Regional del Canal del Dique): medio ambiente Bolívar/Sucre
  cardique@cardique.gov.co
- ANLA: proyectos de impacto ambiental nacional
- Ministerio de Ambiente: política ambiental nacional

**TRANSPORTE Y MOVILIDAD**
- Secretaría de Movilidad Cartagena: tránsito urbano, movilidad
- Transcaribe: sistema de transporte masivo
- MinTransporte / INVIAS: vías nacionales

**EDUCACIÓN**
- Secretaría de Educación Distrital: colegios distritales
- Ministerio de Educación: políticas nacionales, universidades públicas
- ICFES, ICETEX: exámenes y créditos educativos

## FORMATO DE RESPUESTA

Responde SIEMPRE con un JSON válido (sin texto fuera del JSON) con esta estructura exacta:
```json
{
  "legal_type": "derecho_de_peticion|tutela|accion_popular|accion_de_cumplimiento|denuncia_penal|queja",
  "urgency": "baja|media|alta|critica",
  "rights_affected": ["derecho1", "derecho2"],
  "target_entity": {
    "name": "Nombre oficial de la entidad",
    "type": "distrital|departamental|nacional|privada",
    "address": "Dirección física",
    "email": "email@entidad.gov.co",
    "phone": "número o N/A",
    "contact_person": "cargo al que va dirigido"
  },
  "response_deadline_days": 15,
  "document_draft": "TEXTO COMPLETO DEL DOCUMENTO...",
  "legal_orientation": "Párrafo de orientación práctica para el ciudadano...",
  "alternative_remedies": ["Alternativa 1 con breve explicación", "Alternativa 2"],
  "legal_basis": ["Art. 23 Constitución Política", "Ley 1755 de 2015"],
  "next_steps": ["Paso 1", "Paso 2", "Paso 3"]
}
```

## FORMATO DEL DOCUMENTO (document_draft)

Para DERECHO DE PETICIÓN:
---
[Ciudad], [fecha actual]

Señores/Señoras
[NOMBRE DE LA ENTIDAD]
[Cargo del destinatario]
[Dirección]
[Ciudad]

Referencia: DERECHO DE PETICIÓN — [Asunto en 10 palabras]

Respetados señores:

[NOMBRE], identificado(a) con Cédula de Ciudadanía No. _____, residente en [barrio/dirección], ciudad de Cartagena de Indias, D.T. y C., en ejercicio del derecho fundamental de petición consagrado en el artículo 23 de la Constitución Política de Colombia y reglamentado por la Ley 1755 de 2015, respetuosamente me dirijo a ustedes para:

HECHOS:
[Numerados, concisos, específicos]

FUNDAMENTO JURÍDICO:
[Artículos y leyes aplicables]

PETICIÓN:
Solicito respetuosamente a su despacho: [solicitud específica y accionable]

En cumplimiento de la Ley 1755 de 2015, solicito dar respuesta dentro de los quince (15) días hábiles siguientes a la recepción del presente escrito.

Atentamente,

[NOMBRE COMPLETO]
C.C. No. _____
Teléfono: _____
Correo electrónico: _____
Dirección: _____
---

Para TUTELA: incluir derechos afectados, hechos, pretensiones, urgencia.
Para ACCIÓN POPULAR: incluir derechos colectivos, hechos, medidas cautelares.
Para otros: formato apropiado según el instrumento.

## PRINCIPIOS

- Lenguaje claro y accesible: el ciudadano no es abogado
- Siempre citar las normas colombianas específicas
- El documento debe poder presentarse tal como está generado
- La orientación debe ser práctica: decirle AL CIUDADANO qué hacer exactamente
- Mencionar si se requiere firma de abogado o si el ciudadano puede presentarlo solo
- Para tutelas: mencionar que puede presentarla en cualquier juzgado, sin costo, sin abogado
- Para derechos de petición: sin costo, sin abogado, puede enviarse por correo electrónico
- Siempre indicar plazos y qué hacer si no responden"""

    def __init__(self):
        super().__init__("LegalAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        response = self._call_llm(
            state["messages"],
            context=state.get("context"),
            retrieved_docs=state.get("retrieved_docs") or [],
        )
        log_entry = self._log_action(state, "legal_document_generated", response)
        return {
            **state,
            "response": response,
            "confidence": 0.88,
            "audit_log": state["audit_log"] + [log_entry],
        }


# ──────────────────────────────────────────────────────────────────────────────
# RAG retrieval node
# ──────────────────────────────────────────────────────────────────────────────

# Intents that benefit from document retrieval
RAG_INTENTS: frozenset[AgentIntent] = frozenset({
    AgentIntent.CITIZEN,
    AgentIntent.POLICY,
    AgentIntent.TERRITORIAL,
    AgentIntent.LEGAL,
})

# Territory name → Pinecone locality code
_TERRITORY_CODES: dict[str, str] = {
    "historica":  "CTG-01",
    "histórica":  "CTG-01",
    "virgen":     "CTG-02",
    "la virgen":  "CTG-02",
    "industrial": "CTG-03",
    "bayunca":    "CTG-04",
}


async def rag_retrieval_node(state: AgentState) -> AgentState:
    """Retrieve relevant document fragments before calling specialized agents."""
    # Build query from last message + optional territory
    last_message: str = ""
    messages = state.get("messages", [])
    if messages:
        last = messages[-1]
        # LangGraph messages can be dicts or objects with .content
        last_message = last.get("content", "") if isinstance(last, dict) else getattr(last, "content", "")

    territory = state.get("territory") or ""
    query = f"{last_message} {territory}".strip() if territory else last_message

    # Resolve territory string to locality code for filtering
    locality_code: str | None = None
    territory_lower = territory.lower()
    for key, code in _TERRITORY_CODES.items():
        if key in territory_lower:
            locality_code = code
            break

    try:
        docs = await rag_pipeline.retrieve(query, top_k=4, filter_locality=locality_code)
    except Exception as exc:
        logger.warning("[rag_retrieval_node] error en retrieve: %s", exc)
        docs = []

    # Keep existing docs if retrieve returned nothing
    existing = state.get("retrieved_docs") or []
    new_docs = docs if docs else existing

    return {**state, "retrieved_docs": new_docs}


# ──────────────────────────────────────────────────────────────────────────────
# Router
# ──────────────────────────────────────────────────────────────────────────────

class RouterAgent(BaseAgent):
    """Determina qué agente especializado debe manejar cada consulta."""

    SYSTEM_PROMPT = """Eres el Router de VÉRTICE OS.
Tu única tarea es clasificar la intención de una consulta ciudadana.

Responde SOLO con una de estas palabras (sin explicación):
- citizen      → preguntas de participación, dudas sobre la plataforma, derechos
- governance   → debates, votaciones, síntesis de propuestas, moderación
- policy       → propuestas de política pública, análisis de impacto
- territorial  → problemas del territorio, mapas, zonas, infraestructura
- integrity    → sospecha de manipulación, bots, desinformación
- comms        → redacción de discursos, informes, comunicados
- legal        → reportes de situaciones que requieren tutela, derecho de petición, denuncia u otro recurso legal
- unknown      → cuando no está claro"""

    def __init__(self):
        super().__init__("RouterAgent", self.SYSTEM_PROMPT)

    def __call__(self, state: AgentState) -> AgentState:
        last_message = state["messages"][-1]["content"] if state["messages"] else ""

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=20,
                system=self.SYSTEM_PROMPT,
                messages=[{"role": "user", "content": last_message}],
            )
        except (anthropic.APIStatusError, anthropic.APIConnectionError) as exc:
            logger.error("[RouterAgent] LLM error: %s", exc)
            return {**state, "intent": AgentIntent.UNKNOWN}

        if not response.content:
            logger.warning("[RouterAgent] Anthropic devolvió contenido vacío")
            return {**state, "intent": AgentIntent.UNKNOWN}

        intent_str = response.content[0].text.strip().lower()
        try:
            intent = AgentIntent(intent_str)
        except ValueError:
            intent = AgentIntent.UNKNOWN

        return {**state, "intent": intent}


# ──────────────────────────────────────────────────────────────────────────────
# Grafo de orquestación (LangGraph)
# ──────────────────────────────────────────────────────────────────────────────

def route_to_agent(
    state: AgentState,
) -> Literal[
    "citizen", "governance", "policy", "territorial", "integrity", "comms", "legal", END
]:
    """Función de routing condicional para LangGraph."""
    intent = state.get("intent") or AgentIntent.UNKNOWN
    if intent == AgentIntent.UNKNOWN:
        return "citizen"  # Default al agente ciudadano
    return intent.value


def _entry_point(
    state: AgentState,
) -> Literal["router", "rag_retrieval", "citizen", "governance", "policy", "territorial", "integrity", "comms", "legal"]:
    """Si el intent ya está fijado, salta el router.

    Para intents RAG-capable (citizen, policy, territorial, legal) va primero
    por ``rag_retrieval`` antes de llegar al agente especializado.
    Para los demás (governance, integrity, comms) va directo al agente.
    """
    intent = state.get("intent")
    if intent is not None and intent != AgentIntent.UNKNOWN:
        if intent in RAG_INTENTS:
            return "rag_retrieval"
        return intent.value  # type: ignore[return-value]
    return "router"


def build_orchestrator() -> StateGraph:
    """Construye el grafo de orquestación de agentes."""
    router = RouterAgent()
    citizen = CitizenAgent()
    governance = GovernanceAgent()
    policy = PolicyAgent()
    territorial = TerritorialAgent()
    integrity = IntegrityAgent()
    comms = CommsAgent()
    legal = LegalAgent()

    workflow = StateGraph(AgentState)

    workflow.add_node("router", router)
    workflow.add_node("rag_retrieval", rag_retrieval_node)
    workflow.add_node("citizen", citizen)
    workflow.add_node("governance", governance)
    workflow.add_node("policy", policy)
    workflow.add_node("territorial", territorial)
    workflow.add_node("integrity", integrity)
    workflow.add_node("comms", comms)
    workflow.add_node("legal", legal)

    # START → rag_retrieval (RAG intents) | router | direct agent (non-RAG with known intent)
    workflow.add_conditional_edges(
        START,
        _entry_point,
        {
            "router": "router",
            "rag_retrieval": "rag_retrieval",
            "governance": "governance",
            "integrity": "integrity",
            "comms": "comms",
        },
    )

    # router → rag_retrieval (RAG intents) | direct agent (non-RAG intents)
    workflow.add_conditional_edges(
        "router",
        lambda state: (
            "rag_retrieval"
            if state.get("intent") in RAG_INTENTS
            else route_to_agent(state)
        ),
        {
            "rag_retrieval": "rag_retrieval",
            "governance": "governance",
            "integrity": "integrity",
            "comms": "comms",
            "citizen": "citizen",  # fallback for UNKNOWN → citizen
        },
    )

    # rag_retrieval → specific RAG-capable agent based on intent
    workflow.add_conditional_edges(
        "rag_retrieval",
        route_to_agent,
        {
            "citizen": "citizen",
            "policy": "policy",
            "territorial": "territorial",
            "legal": "legal",
        },
    )

    for agent_name in ["citizen", "governance", "policy", "territorial", "integrity", "comms", "legal"]:
        workflow.add_edge(agent_name, END)

    return workflow.compile()


# Singleton del orquestador
orchestrator = build_orchestrator()


# ──────────────────────────────────────────────────────────────────────────────
# API Entry Point
# ──────────────────────────────────────────────────────────────────────────────

class SessionContext(BaseModel):
    """Campos de contexto permitidos — lista blanca explícita para prevenir prompt injection."""

    proposal_id: str | None = Field(None, max_length=36)
    report_id: str | None = Field(None, max_length=36)
    locality: str | None = Field(None, max_length=120)
    neighborhood: str | None = Field(None, max_length=120)
    topic: str | None = Field(None, max_length=200)

    def to_safe_dict(self) -> dict[str, str]:
        """Devuelve solo campos con valor, como strings seguros."""
        return {k: str(v) for k, v in self.model_dump(exclude_none=True).items()}


class QueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000, description="Mensaje del ciudadano")
    citizen_id: str | None = Field(
        None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        description="UUID del ciudadano autenticado",
    )
    territory: str | None = Field(None, max_length=120, description="Localidad o barrio")
    context: SessionContext = Field(default_factory=SessionContext, description="Contexto de sesión")

    @field_validator("message")
    @classmethod
    def message_no_injection(cls, v: str) -> str:
        """Rechaza mensajes que intentan romper el formato del system prompt."""
        forbidden = ["## ", "<|system|>", "<|user|>", "<|assistant|>", "ignore previous"]
        lower = v.lower()
        for pattern in forbidden:
            if pattern.lower() in lower:
                raise ValueError("Formato de mensaje no permitido")
        return v


class QueryResponse(BaseModel):
    response: str
    agent_used: str
    confidence: float
    audit_id: str


async def process_civic_query(request: QueryRequest) -> QueryResponse:
    """Procesa una consulta ciudadana a través del orquestador multi-agente."""
    audit_id = str(uuid.uuid4())

    initial_state: AgentState = {
        "messages": [{"role": "user", "content": request.message}],
        "intent": None,
        "citizen_id": request.citizen_id,
        "territory": request.territory,
        "context": request.context.to_safe_dict(),
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
        "audit_id": audit_id,
    }

    try:
        result = await asyncio.wait_for(
            orchestrator.ainvoke(initial_state),
            timeout=ORCHESTRATOR_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "[orchestrator] timeout audit_id=%s citizen_id=%s",
            audit_id,
            request.citizen_id,
        )
        return QueryResponse(
            response="La consulta tardó demasiado. Por favor intenta de nuevo.",
            agent_used="timeout",
            confidence=0.0,
            audit_id=audit_id,
        )
    except Exception:
        logger.exception(
            "[orchestrator] error inesperado audit_id=%s citizen_id=%s",
            audit_id,
            request.citizen_id,
        )
        return QueryResponse(
            response="Ocurrió un error procesando tu consulta. Por favor intenta de nuevo.",
            agent_used="error",
            confidence=0.0,
            audit_id=audit_id,
        )

    return QueryResponse(
        response=result.get("response") or "No se pudo generar una respuesta.",
        agent_used=result["intent"].value if result.get("intent") else "unknown",
        confidence=result.get("confidence", 0.0),
        audit_id=audit_id,
    )


async def process_with_intent(
    message: str,
    intent: AgentIntent,
    context: SessionContext | None = None,
    citizen_id: str | None = None,
) -> QueryResponse:
    """
    Envía una consulta directamente al agente indicado, omitiendo el router.
    Usado por los endpoints estructurados (/territorial/analyze, /governance/*).
    """
    audit_id = str(uuid.uuid4())

    initial_state: AgentState = {
        "messages": [{"role": "user", "content": message}],
        "intent": intent,
        "citizen_id": citizen_id,
        "territory": None,
        "context": context.to_safe_dict() if context else {},
        "retrieved_docs": [],
        "response": None,
        "confidence": 0.0,
        "audit_log": [],
        "audit_id": audit_id,
    }

    try:
        result = await asyncio.wait_for(
            orchestrator.ainvoke(initial_state),
            timeout=ORCHESTRATOR_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error("[process_with_intent] timeout audit_id=%s intent=%s", audit_id, intent.value)
        return QueryResponse(
            response="La consulta tardó demasiado. Por favor intenta de nuevo.",
            agent_used="timeout",
            confidence=0.0,
            audit_id=audit_id,
        )
    except Exception:
        logger.exception("[process_with_intent] error inesperado audit_id=%s", audit_id)
        return QueryResponse(
            response="Ocurrió un error procesando tu consulta. Por favor intenta de nuevo.",
            agent_used="error",
            confidence=0.0,
            audit_id=audit_id,
        )

    return QueryResponse(
        response=result.get("response") or "No se pudo generar una respuesta.",
        agent_used=intent.value,
        confidence=result.get("confidence", 0.0),
        audit_id=audit_id,
    )
