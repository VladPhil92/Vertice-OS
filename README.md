# VÉRTICE OS

> **Sistema Operativo Cívico de Nueva Generación**  
> *Diferentes en cada región, unidos en un solo país.*

[![Estado](https://img.shields.io/badge/Estado-Alpha%20v0.1.0-gold?style=flat-square)](https://github.com/VladPhil92/Vertice-OS)
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-navy?style=flat-square)](./LICENSE)
[![Ciudad Piloto](https://img.shields.io/badge/Piloto-Cartagena%20de%20Indias-red?style=flat-square)](https://es.wikipedia.org/wiki/Cartagena_de_Indias)

---

## ¿Qué es VÉRTICE OS?

VÉRTICE OS es una infraestructura cívica de próxima generación diseñada para transformar la participación política en Colombia y América Latina. No es una aplicación política tradicional — es un **sistema operativo para la democracia continua**.

> *"La política no debería ocurrir solo cada cuatro años."*

### Principios Fundacionales

- **Participación continua** — no solo en ciclos electorales
- **Inteligencia territorial** — datos del territorio en tiempo real
- **Gobernanza transparente** — cada decisión es trazable y auditable
- **Identidad soberana** — los ciudadanos controlan sus propios datos
- **IA al servicio de lo público** — no de intereses privados

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        VÉRTICE OS                           │
├──────────────┬──────────────┬───────────────┬──────────────┤
│   Identidad  │  Territorio  │  Gobernanza   │  Reputación  │
│    Cívica    │  Inteligente │   & Decisión  │    Cívica    │
├──────────────┴──────────────┴───────────────┴──────────────┤
│                    CAPA MULTI-AGENTE IA                     │
│  Ciudadano · Gobernanza · Política · Territorio · Integridad│
├─────────────────────────────────────────────────────────────┤
│              BLOCKCHAIN & CAPA DE CONFIANZA                 │
│         Polygon PoS · EAS · IPFS · Soulbound Tokens        │
├──────────────┬──────────────┬───────────────┬──────────────┤
│  PostgreSQL  │   MongoDB    │    Neo4j      │   Pinecone   │
│  + PostGIS   │  (NoSQL)     │   (Graph)     │  (Vectors)   │
└──────────────┴──────────────┴───────────────┴──────────────┘
```

---

## Módulos del Sistema

| # | Módulo | Estado | Tech Stack |
|---|--------|--------|------------|
| 01 | Identidad Cívica Digital | 🟡 En diseño | DID, ZKP, W3C VC |
| 02 | Motor de Inteligencia Territorial | 🟡 En diseño | PostGIS, Mapbox, HDBSCAN |
| 03 | Motor de Gobernanza y Decisión | 🔴 Planificado | Liquid Democracy, On-chain |
| 04 | Capa Multi-Agente IA | 🟡 En diseño | LangGraph, Claude API |
| 05 | Blockchain & Capa de Confianza | 🔴 Planificado | Polygon, EAS |
| 06 | Reputación y Contribución Cívica | 🔴 Planificado | Neo4j, Graph Analysis |
| 07 | Infraestructura de Automatización | 🔴 Planificado | Temporal.io, n8n |
| 08 | Ecosistema de Medios y Narrativa | 🔴 Planificado | Streaming, CDN |

---

## Stack Tecnológico

### Frontend
- **Next.js 14** (App Router + Server Components)
- **React 18** con Suspense
- **Framer Motion** — animaciones cinematicas
- **Mapbox GL JS** — visualización territorial
- **Tailwind CSS** + Radix UI primitives
- **PWA** — acceso móvil sin fricción

### Backend
- **Node.js / TypeScript** — microservicios alta frecuencia
- **Python** — servicios AI/ML
- **Go** — voting engine (alta performance)
- **GraphQL** (Apollo Federation) — API gateway
- **gRPC** — comunicación interna

### Bases de Datos
- **PostgreSQL + PostGIS** — datos relacionales + geoespaciales
- **MongoDB** — datos no estructurados
- **Neo4j** — grafo de relaciones y reputación
- **Pinecone / Weaviate** — vector DB para RAG
- **Redis** — caché, sesiones, rate limiting
- **IPFS** — documentos públicos descentralizados

### IA
- **Claude API** (Anthropic) — LLM principal
- **LangGraph** — orquestación multi-agente
- **Hugging Face** — modelos fine-tuned en español
- **Temporal.io** — workflows de larga duración

### Blockchain
- **Polygon PoS** — transacciones ~$0.001 USD
- **EAS** (Ethereum Attestation Service)
- **Hardhat** — desarrollo de contratos
- **The Graph** — indexación de eventos on-chain

### Infraestructura
- **AWS + GCP** (multi-cloud)
- **Kubernetes** (EKS/GKE)
- **Terraform** IaC
- **Cloudflare** — DDoS, CDN, Workers
- **HashiCorp Vault** — gestión de secretos

---

## Agentes IA

```
┌─────────────────────────────────────────────────────┐
│              ROUTER AGENT (Orquestador)              │
└──────────┬──────────┬────────────┬──────────────────┘
           │          │            │
    ┌──────▼──┐ ┌────▼────┐ ┌────▼──────┐
    │Ciudadano│ │Gobernanza│ │  Política  │
    └─────────┘ └─────────┘ └───────────┘
    ┌──────────────┐ ┌──────────┐ ┌──────┐
    │  Territorial │ │Integridad│ │Comms │
    └──────────────┘ └──────────┘ └──────┘
           │
    ┌──────▼──────────────────────────────┐
    │  Memory Layer (Redis + Pinecone)     │
    └─────────────────────────────────────┘
```

| Agente | Función |
|--------|---------|
| **Ciudadano** | Guía de participación y preguntas cívicas |
| **Gobernanza** | Síntesis de debates e identificación de consenso |
| **Política** | Conversión de demandas ciudadanas en propuestas de política |
| **Territorial** | Análisis de tendencias y prioridades por territorio |
| **Integridad** | Detección de bots, manipulación y desinformación coordinada |
| **Comunicación** | Discursos, informes y narrativa estratégica |

---

## Hoja de Ruta

### Fase I — Fundación (Meses 1–4)
- [ ] MVP de identidad cívica digital
- [ ] Sistema de reporte territorial básico
- [ ] Onboarding primeros 500 ciudadanos (Cartagena piloto)
- [ ] Agente ciudadano IA (beta)
- [ ] Dashboard territorial piloto

### Fase II — Gobernanza (Meses 5–10)
- [ ] Motor de gobernanza y votación verificable
- [ ] Sistema de reputación cívica
- [ ] Capa blockchain básica
- [ ] 4 agentes IA adicionales
- [ ] Módulo de co-creación de políticas públicas

### Fase III — Escala (Meses 11–18)
- [ ] Inteligencia territorial predictiva
- [ ] Integración institucional pública
- [ ] Sistema anti-corrupción automatizado
- [ ] Arquitectura multi-ciudad
- [ ] Agente de integridad completo

### Fase IV — Latinoamérica (Mes 19+)
- [ ] Protocolo open-source VÉRTICE
- [ ] SDK para gobiernos aliados
- [ ] Expansión a 5 países
- [ ] DAO de gobernanza de la plataforma

---

## Estructura del Repositorio

```
vertice-os/
├── apps/
│   ├── web/              # Frontend Next.js
│   ├── api/              # Backend microservicios
│   └── ai/               # Servicios de IA y agentes
├── docs/
│   ├── architecture/     # Documentación de arquitectura
│   ├── api/              # Documentación de APIs
│   └── governance/       # Marco de gobernanza
├── infrastructure/
│   ├── terraform/        # IaC
│   ├── kubernetes/       # Manifiestos K8s
│   └── docker/           # Dockerfiles
├── design/
│   ├── landing/          # Landing page (HTML cinematic)
│   └── assets/           # Assets de diseño
└── contracts/            # Smart contracts Solidity
```

---

## Implicaciones Legales (Colombia)

- **Ley 1581/2012** — Protección de datos personales (habeas data)
- **Decreto 1377/2013** — Reglamentación tratamiento de datos
- **CPACA** — Para integraciones con entidades públicas
- Los procesos de votación son **consultas ciudadanas**, no actos administrativos vinculantes

---

## Monetización Ética

- **B2G** — Licenciamiento a municipios y departamentos
- **Consulting institucional** — Implementación territorial
- **Formación y certificación** — Liderazgo cívico digital
- **API pública premium** — Datos territoriales anonimizados
- **Grants internacionales** — BID, USAID, Open Society, CAF Digital

> ⚠️ **Lo que NUNCA se monetiza:** datos individuales de ciudadanos, atención publicitaria, o acceso diferenciado por dinero.

---

## Contribuir

Este proyecto está en fase alpha privada. Para solicitar acceso como colaborador técnico o aliado institucional:

📧 Contactar a través del repositorio oficial.

---

## Créditos

**Fundador y Arquitecto de Producto:** Juan Pablo Valderrama Pino  
**Ciudad Piloto:** Cartagena de Indias, Colombia  
**Organización:** CTG One Corporation

---

*VÉRTICE OS — Infraestructura para la democracia continua.*  
*Diferentes en cada región, unidos en un solo país.*
