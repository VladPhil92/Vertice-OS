# Arquitectura Técnica — VÉRTICE OS

> Documento maestro de arquitectura · v0.1.0  
> Cartagena de Indias, Colombia

---

## 1. Visión de Sistema

VÉRTICE OS es una plataforma de infraestructura cívica distribuida compuesta por microservicios especializados, una capa multi-agente de IA, y un sistema de confianza basado en blockchain. Está diseñada para operar a escala territorial desde un municipio hasta múltiples países.

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                 │
│    Web (Next.js)    ·    Mobile (PWA)    ·    API Partners       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼─────────────────────────────────────┐
│                     API GATEWAY (GraphQL)                        │
│              Rate Limiting · Auth · Observability                │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼──────────┐
│  Auth   │ │Identity │ │Govern.│ │ AI    │ │  Territorial │
│ Service │ │ Service │ │Engine │ │Orch.  │ │   Engine     │
└──────┬──┘ └────┬────┘ └───┬───┘ └───┬───┘ └───┬──────────┘
       │         │          │         │          │
┌──────▼─────────▼──────────▼─────────▼──────────▼────────────┐
│                    EVENT BUS (Kafka / Redis Streams)          │
└──────────────────────────────────────────────────────────────┘
┌──────────┬───────────┬──────────┬──────────┬─────────────────┐
│PostgreSQL│  MongoDB  │  Neo4j   │ Pinecone │     Redis       │
│+ PostGIS │ (NoSQL)   │ (Graph)  │ (Vector) │    (Cache)      │
└──────────┴───────────┴──────────┴──────────┴─────────────────┘
┌──────────────────────────────────────────────────────────────┐
│              BLOCKCHAIN LAYER (Polygon PoS)                  │
│           EAS · IPFS · Smart Contracts · The Graph          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Microservicios

### 2.1 Auth Service
**Responsabilidad:** Autenticación y autorización de todos los actores del sistema.

**Stack:** Node.js + TypeScript + Fastify

**Funcionalidades:**
- OAuth 2.0 + PKCE para clientes web y móvil
- JWT con rotación automática (access: 15min, refresh: 7d)
- MFA: TOTP + biometría (WebAuthn)
- Integración con Registraduría Nacional para verificación de cédula
- Sesiones distribuidas en Redis con invalidación instantánea

**APIs:**
```
POST /auth/register          # Registro inicial
POST /auth/verify-identity   # Verificación cédula + selfie
POST /auth/token             # Obtener tokens
POST /auth/refresh           # Renovar access token
POST /auth/logout            # Invalidar sesión
GET  /auth/me                # Perfil autenticado
```

---

### 2.2 Identity Service
**Responsabilidad:** Gestión de identidades cívicas digitales soberanas.

**Stack:** Node.js + TypeScript + Prisma

**Funcionalidades:**
- Creación y gestión de DIDs (Decentralized Identifiers) bajo W3C standard
- Emisión de Verifiable Credentials (VC) en JSON-LD
- Zero-Knowledge Proofs para verificar atributos sin revelarlos
- Sistema de validación comunitaria (3 ciudadanos verificados → 1 nuevo)
- Perfil cívico: barrio, localidad, intereses, habilidades verificadas

**Flujo de verificación:**
```
Usuario ingresa cédula
        ↓
Registraduría API valida (hash commitment, nunca texto plano)
        ↓
Liveness check (selfie vs foto cédula — procesado localmente)
        ↓
DID generado localmente en dispositivo
        ↓
DID Document anclado en Polygon (solo hash)
        ↓
VC emitida y almacenada en wallet del usuario
        ↓
Validación comunitaria activa (24h window)
        ↓
Perfil cívico verificado y activo
```

---

### 2.3 Territorial Engine
**Responsabilidad:** Inteligencia geoespacial del territorio.

**Stack:** Python + FastAPI + PostGIS + Mapbox

**Pipeline de datos:**
```python
# Clasificación de reporte entrante
{
  "texto": "El hueco en la calle 30 con carrera 5 lleva 3 meses",
  "coordenadas": {"lat": 10.391, "lng": -75.479},
  "foto": "base64...",
  "timestamp": "2025-11-15T10:23:00Z"
}

# → Clasificación ML: categoria="infraestructura", subcategoria="vial"
# → Urgencia: 0.72 (alta)
# → Clustering: asignado a cluster CTG-INF-042
# → Geocoding: Localidad Histórica, Barrio Getsemaní
# → Alerta: Líder territorial asignado notificado
```

**Modelos ML:**
- **Clasificación:** BERT fine-tuned en español (HuggingFace) para categorizar reportes
- **Clustering:** HDBSCAN para agrupación geoespacial sin número de clusters predefinido
- **Predicción:** XGBoost sobre series temporales para anticipar zonas de deterioro
- **Sentimiento:** RoBERTa fine-tuned para análisis de comentarios ciudadanos

**API Endpoints:**
```
POST /territorial/report          # Nuevo reporte ciudadano
GET  /territorial/heatmap         # Mapa de calor por categoría
GET  /territorial/clusters        # Clusters activos
GET  /territorial/priority-zones  # Zonas de mayor urgencia
GET  /territorial/analytics       # Dashboard analytics
PUT  /territorial/report/:id      # Actualizar estado de reporte
```

---

### 2.4 Governance Engine
**Responsabilidad:** Motor de democracia líquida y decisiones colectivas.

**Stack:** Go + PostgreSQL + Redis

**Ciclo de vida de una propuesta:**
```
ESTADO: IDEA
  - Creada por ciudadano verificado
  - Mínimo 10 endorsements para avanzar

ESTADO: DRAFT  
  - 7 días de comentarios públicos
  - IA moderadora activa
  - Enmiendas permitidas

ESTADO: DEBATE
  - Sesión de debate estructurado (72h)
  - Delegación de voto disponible
  - IA de gobernanza sintetiza posiciones

ESTADO: VOTING
  - Ventana de votación (48-168h según impacto)
  - Quórum dinámico requerido
  - Voto ponderado por reputación cívica

ESTADO: APPROVED / REJECTED
  - Resultado registrado on-chain
  - Responsable asignado automáticamente
  - Tracking de ejecución activo

ESTADO: EXECUTED / FAILED_EXECUTION
  - Evaluación ciudadana de cumplimiento
  - Impacto en reputación del responsable
```

**Quórum dinámico:**
| Tipo de Decisión | Umbral Aprobación | Quórum Mínimo |
|-----------------|------------------|---------------|
| Barrio | 40% | 15% elegibles |
| Localidad | 50% | 20% elegibles |
| Ciudad | 55% | 25% elegibles |
| Política Pública Mayor | 60% | 30% elegibles |

---

### 2.5 AI Orchestrator
**Responsabilidad:** Orquestación del sistema multi-agente de IA.

**Stack:** Python + LangGraph + Claude API

**Arquitectura:**
```python
# Router Agent — decide qué agente activar
class RouterAgent:
    def route(self, query: Query) -> Agent:
        intent = self.classify_intent(query)
        return self.agent_map[intent]

# Ejemplo de grafo de agentes (LangGraph)
workflow = StateGraph(AgentState)
workflow.add_node("citizen_agent", CitizenAgent())
workflow.add_node("governance_agent", GovernanceAgent())
workflow.add_node("policy_agent", PolicyAgent())
workflow.add_node("territorial_agent", TerritorialAgent())
workflow.add_node("integrity_agent", IntegrityAgent())
workflow.add_node("comms_agent", CommsAgent())
workflow.add_node("memory_layer", MemoryLayer())

workflow.add_conditional_edges("router", route_query)
workflow.add_edge("*", "memory_layer")  # Todos pasan por memoria
```

**RAG Pipeline:**
```
Query ciudadana
      ↓
Embedding (text-embedding-3-large)
      ↓
Pinecone: cosine similarity search → top-20 chunks
      ↓
Cross-encoder re-ranking → top-5 chunks
      ↓
Context window: [System Prompt + Retrieved Chunks + Query]
      ↓
Claude API (claude-sonnet-4-20250514)
      ↓
Response + fuentes citadas + nivel de confianza
      ↓
Audit log inmutable
```

**Documentos indexados en RAG:**
- Plan de Ordenamiento Territorial (POT) Cartagena
- Plan de Desarrollo Municipal vigente
- Actas del Concejo Distrital (últimos 5 años)
- Normativa DIAN, MinTIC, MinInterior relevante
- Jurisprudencia Corte Constitucional
- Histórico de propuestas y debates de la plataforma

---

### 2.6 Reputation Service
**Responsabilidad:** Sistema de reputación cívica multidimensional.

**Stack:** Node.js + Neo4j (graph) + Redis

**Vectores de reputación:**
```
Reputación_Total = (
  Participación      × 0.25 +   # Votaciones, debates, asistencias
  Impacto_Verificado × 0.35 +   # Problemas resueltos atribuibles
  Calidad            × 0.20 +   # Propuestas aprobadas, upvotes pares
  Consistencia       × 0.10 +   # Participación sostenida anti-burst
  Colaboración       × 0.10     # Endorse acertados, trabajo en red
)
```

**Anti-manipulación:**
- **Decay function:** `R(t) = R₀ × e^(-λt)` — la reputación decae sin actividad
- **Rate limiting:** máximo +X puntos por semana (previene farming)
- **Cooling periods:** grandes acciones tienen delays de validación
- **Graph analysis:** Neo4j detecta clusters sospechosos de validación cruzada
- **Human review:** outliers automáticamente flaggeados para revisión

**Soulbound Tokens (SBT):**
- La reputación cívica es no-transferible
- Implementada como SBT (ERC-5114) en Polygon
- Los logros cívicos se mintean como SBTs verificables

---

## 3. Capa Blockchain

### Dónde SÍ usar blockchain
- ✅ Registro inmutable de resultados de votaciones
- ✅ Atestaciones de identidad verificada (EAS)
- ✅ Compromisos gubernamentales con timestamp criptográfico
- ✅ Contribuciones cívicas verificadas para reputación
- ✅ Documentos públicos en IPFS con hash on-chain

### Dónde NO usar blockchain
- ❌ Almacenamiento de datos personales
- ❌ Lógica que requiere velocidad sub-segundo
- ❌ Sistemas que requieren reversibilidad
- ❌ Operaciones frecuentes sin necesidad de inmutabilidad

### Smart Contracts (Solidity)

```solidity
// VotingRegistry.sol — Registro inmutable de votaciones
contract VotingRegistry {
    struct VotingRecord {
        bytes32 proposalHash;   // Hash de la propuesta
        uint256 timestamp;
        uint256 totalVotes;
        uint256 approveVotes;
        uint256 rejectVotes;
        bool approved;
        string ipfsResultsURI;  // Datos completos en IPFS
    }
    
    mapping(bytes32 => VotingRecord) public records;
    
    event VotingFinalized(
        bytes32 indexed proposalId,
        bool approved,
        uint256 timestamp
    );
    
    function recordVoting(
        bytes32 proposalId,
        bytes32 proposalHash,
        uint256 totalVotes,
        uint256 approveVotes,
        string calldata ipfsURI
    ) external onlyGovernanceEngine {
        // Registro inmutable + emit evento
    }
}
```

```solidity
// CivicSBT.sol — Soulbound Tokens para reputación cívica
contract CivicSBT is ERC5114 {
    // No-transferible, vinculado a DID del ciudadano
    // Representa logros cívicos verificados
}
```

### Chain Selection: Polygon PoS
- **Costo:** ~$0.001 por transacción
- **Finalidad:** ~2 segundos
- **EVM-compatible:** ecosistema de herramientas maduro
- **Presencia en Colombia:** exchanges y on-ramps disponibles

---

## 4. Base de Datos — Schema Principal

### PostgreSQL (datos relacionales + geoespaciales)

```sql
-- Ciudadanos verificados
CREATE TABLE citizens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did TEXT UNIQUE NOT NULL,           -- Decentralized Identifier
    cedula_hash TEXT UNIQUE NOT NULL,   -- Hash SHA-256, nunca texto plano
    locality_id INTEGER REFERENCES localities(id),
    neighborhood TEXT,
    reputation_score DECIMAL(10,4) DEFAULT 0,
    verification_level SMALLINT DEFAULT 0,  -- 0:básico, 1:verificado, 2:validado
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- Reportes territoriales
CREATE TABLE territorial_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID REFERENCES citizens(id),
    category TEXT NOT NULL,             -- infraestructura, seguridad, salud, etc.
    subcategory TEXT,
    description TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,  -- PostGIS
    neighborhood TEXT,
    urgency_score DECIMAL(4,3),         -- 0.0 a 1.0 (ML score)
    cluster_id TEXT,                    -- HDBSCAN cluster
    status TEXT DEFAULT 'open',         -- open, in_progress, resolved, rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT valid_urgency CHECK (urgency_score BETWEEN 0 AND 1)
);

CREATE INDEX idx_reports_location ON territorial_reports USING GIST(location);
CREATE INDEX idx_reports_status ON territorial_reports(status, created_at DESC);

-- Propuestas de gobernanza
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES citizens(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    scope TEXT NOT NULL,                -- barrio, localidad, ciudad, pais
    status TEXT DEFAULT 'idea',
    endorsement_count INTEGER DEFAULT 0,
    quorum_required DECIMAL(4,3),
    approval_threshold DECIMAL(4,3),
    blockchain_tx_hash TEXT,            -- Hash de tx cuando se registra on-chain
    ipfs_uri TEXT,                      -- Documento completo en IPFS
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ
);

-- Votos (el conteo es público, el voto individual es privado)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id),
    citizen_hash TEXT NOT NULL,         -- Hash del ciudadano, no ID directo
    vote_weight DECIMAL(6,4) NOT NULL,  -- Ponderado por reputación
    vote_value SMALLINT NOT NULL,       -- 1=favor, -1=contra, 0=abstención
    nullifier_hash TEXT UNIQUE NOT NULL, -- ZKP nullifier: evita doble voto
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Neo4j (grafo de relaciones cívicas)

```cypher
// Nodos principales
(:Citizen {did, reputation_score, locality})
(:Proposal {id, title, status})
(:TerritorialReport {id, category, cluster})
(:LocalLeader {did, territory, verified})

// Relaciones
(:Citizen)-[:ENDORSED]->(:Proposal)
(:Citizen)-[:VOTED_ON {weight, value}]->(:Proposal)
(:Citizen)-[:REPORTED]->(:TerritorialReport)
(:Citizen)-[:VALIDATES]->(:Citizen)  // Red de validación comunitaria
(:Citizen)-[:DELEGATES_TO {domain}]->(:Citizen)  // Delegación de voto

// Query: detectar clusters de validación sospechosos
MATCH (a:Citizen)-[:VALIDATES]->(b:Citizen)-[:VALIDATES]->(a)
WHERE NOT (a)-[:VALIDATED_BY_EXTERNAL]->()
RETURN a, b, COUNT(*) as mutual_validations
HAVING mutual_validations > 5
```

---

## 5. Seguridad — Zero Trust Architecture

```
Principio: "Nunca confiar, siempre verificar"

Toda comunicación:
├── mTLS entre microservicios
├── JWT + PKCE para clientes
├── API Keys rotadas cada 30 días
└── Vault para gestión de secretos

Datos en reposo:
├── AES-256-GCM para datos sensibles
├── Cédulas nunca almacenadas (solo hash)
├── Biometría procesada localmente
└── Backups cifrados geográficamente distribuidos

Datos en tránsito:
├── TLS 1.3 obligatorio
├── HSTS preloading
└── Certificate Pinning en apps móviles

Monitoreo:
├── SIEM (Elastic Security)
├── Anomaly detection en tiempo real
├── Audit log inmutable para toda acción sensible
└── Penetration testing trimestral
```

---

## 6. Observabilidad

```
Métricas:    Prometheus + Grafana
Logs:        Loki + Grafana
Trazas:      Jaeger (distributed tracing)
Alertas:     PagerDuty
Uptime:      99.9% SLA objetivo (Fase I), 99.99% (Fase III+)
```

---

## 7. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (estructura)
stages:
  - lint          # ESLint, Prettier, mypy
  - test          # Jest, pytest, Go test
  - security      # SAST (Semgrep), Dependency scan
  - build         # Docker build + push
  - deploy-staging
  - integration-tests
  - deploy-production (manual gate)
```

---

## 8. Estimación de Recursos (Fase I — MVP)

| Recurso | Especificación | Costo/mes estimado |
|---------|---------------|-------------------|
| Kubernetes cluster (3 nodos) | 4 vCPU, 16GB RAM c/u | ~$450 USD |
| PostgreSQL (managed) | 2 vCPU, 8GB, 100GB | ~$150 USD |
| MongoDB Atlas | M30 cluster | ~$200 USD |
| Redis (managed) | 1GB cache | ~$50 USD |
| Pinecone | Starter | ~$70 USD |
| Cloudflare | Pro plan | ~$25 USD |
| Claude API | ~500K tokens/día | ~$300 USD |
| Misc (IPFS, CDN, monitoring) | — | ~$100 USD |
| **Total estimado Fase I** | | **~$1,345 USD/mes** |

---

*Documento vivo — actualizar con cada sprint.*  
*Última actualización: v0.1.0*
