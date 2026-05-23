# Marco de Gobernanza — VÉRTICE OS

> Documento de gobernanza · v0.1.0  
> Principios, reglas y mecanismos de decisión colectiva

---

## Filosofía de Gobernanza

VÉRTICE OS opera bajo el principio de que **la gobernanza es una infraestructura, no un evento**. Cada mecanismo diseñado aquí busca:

1. **Maximizar participación genuina** — no solo acceso formal
2. **Resistir captura** — por dinero, clientelismo o poder concentrado
3. **Garantizar trazabilidad** — toda decisión debe poder ser auditada
4. **Preservar diversidad** — las minorías tienen voz, no solo mayorías

---

## Modelo de Democracia Líquida

### Definición
La democracia líquida permite a cada ciudadano elegir su modo de participación en cada decisión:

```
OPCIÓN A: Voto Directo
  El ciudadano vota personalmente en cada propuesta.

OPCIÓN B: Delegación Específica
  El ciudadano delega su voto a una persona de confianza
  SOLO para una propuesta o categoría específica.

OPCIÓN C: Delegación General
  El ciudadano delega su voto a un representante
  para todas las propuestas de un dominio (ej: movilidad).

OPCIÓN D: Meta-delegación
  El delegado puede re-delegar (con límite de 3 niveles
  para evitar cadenas infinitas).

REVOCACIÓN: Siempre instantánea, hasta el cierre de la votación.
```

### Ponderación del Voto

El voto no es igual para todos — está ponderado por **reputación cívica**:

```
Peso_Voto = 1.0 + (Reputación_Normalizada × 0.5)

Donde Reputación_Normalizada ∈ [0, 1]

Ejemplo:
  Ciudadano nuevo (rep = 0):      Peso = 1.0
  Ciudadano medio (rep = 0.5):    Peso = 1.25
  Ciudadano top (rep = 1.0):      Peso = 1.5

Límite máximo de peso: 1.5× (nadie puede tener más de
1.5 veces el peso de un ciudadano base)
```

**Justificación:** La participación verificada y el impacto real merecen más peso. Pero ningún ciudadano puede dominar unilateralmente una votación.

---

## Ciclo de Vida de una Propuesta

### Etapa 1: IDEA
**Duración:** Sin límite de tiempo  
**Requisitos para avanzar:** 10 endorsements de ciudadanos verificados

```
REGLAS:
- Cualquier ciudadano verificado puede crear una idea
- Debe incluir: título, descripción, categoría, alcance territorial
- La IA de gobernanza sugiere categoría y posibles duplicados
- Si existe propuesta similar activa, se notifica al autor
```

### Etapa 2: DRAFT
**Duración:** 7 días  
**Acciones permitidas:** Comentarios públicos, enmiendas del autor

```
REGLAS:
- El autor puede modificar la propuesta durante esta etapa
- Los cambios sustanciales reinician el contador de endorsements
- La IA sintetiza los comentarios y los presenta al autor
- Al finalizar: snapshot inmutable del texto va a IPFS
```

### Etapa 3: DEBATE
**Duración:** 72 horas  
**Acciones:** Argumentos a favor y en contra, preguntas al autor

```
REGLAS:
- Formato estructurado: argumento (max 500 palabras) + evidencia
- Cada ciudadano: máximo 3 intervenciones
- El autor responde con derecho a réplica
- IA de gobernanza: síntesis en tiempo real, identificación de consenso
- Moderación automática + revisión humana para casos complejos
```

### Etapa 4: VOTING
**Duración:** Variable según alcance

| Alcance | Duración Mínima | Duración Máxima |
|---------|----------------|----------------|
| Barrio | 24h | 72h |
| Localidad | 48h | 96h |
| Ciudad | 72h | 168h (7 días) |
| Política Mayor | 120h | 240h (10 días) |

```
REGLAS:
- Voto secreto: el ciudadano conoce su voto, nadie más
- Conteo verificable: ZKP permite auditar sin revelar votos individuales
- Delegaciones se resuelven automáticamente al cierre
- No hay extensiones (previene manipulación de tiempo)
```

### Etapa 5: RESULTADO
**Inmediato al cierre de votación**

```
REGISTRO:
1. Resultado calculado y firmado criptográficamente
2. Transacción en Polygon con hash del resultado
3. Datos completos en IPFS (acceso público permanente)
4. Notificación a todos los participantes
5. Asignación automática de responsable si aprobada
```

---

## Quórum y Umbrales

### Quórum Dinámico
El quórum mínimo se calcula sobre los **ciudadanos elegibles** para esa decisión (no sobre todos los ciudadanos de la plataforma):

```
Ciudadanos_Elegibles = Ciudadanos verificados en el territorio
                       que tienen historial de participación
                       (al menos 1 acción en los últimos 90 días)
```

### Umbrales de Aprobación

| Tipo | Quórum Mínimo | Umbral Aprobación |
|------|--------------|------------------|
| Propuesta de Barrio | 15% | 40% votos favor |
| Propuesta de Localidad | 20% | 50% votos favor |
| Propuesta Municipal | 25% | 55% votos favor |
| Política Pública Mayor | 30% | 60% votos favor |
| Reforma de Plataforma | 40% | 66% votos favor |

**Si no se alcanza quórum:** la propuesta entra en estado `QUORUM_FAILED` y puede ser reformulada y reintentada después de 30 días.

---

## Sistema de Delegación

### Reglas de Delegación
```
1. Toda delegación es revocable instantáneamente hasta el cierre
2. Máximo 3 niveles de re-delegación (A→B→C→D es el límite)
3. La delegación circular es imposible (verificación de grafo)
4. Las delegaciones son transparentes (visibles en perfil público)
5. El delegado siempre puede votar en contra del delegante
   (respeta la autonomía del representante)
6. Delegaciones por dominio: "delego todo sobre movilidad a X"
```

### Tipos de Delegación
```
PUNTUAL:    Solo para propuesta específica #1234
DOMINIO:    Todo sobre "infraestructura vial" → delegado Y
TEMPORAL:   Por los próximos 30 días → delegado Z
GENERAL:    Todas mis decisiones → delegado W (no recomendado)
```

---

## Prevención de Manipulación

### Mecanismos Anti-Clientelismo
```
1. El voto ponderado NO considera dinero ni cargo político
2. La reputación se gana con participación verificada, no se compra
3. Las delegaciones son públicas → transparencia de redes de influencia
4. El Agente de Integridad monitorea patrones sospechosos:
   - Picos de delegación justo antes de una votación
   - Grupos de cuentas que siempre votan idénticamente
   - Endorsements masivos desde cuentas creadas recientemente
```

### Mecanismos Anti-Bots
```
1. Verificación de identidad obligatoria (cédula + liveness)
2. Análisis de comportamiento: timing, patrones, device fingerprint
3. Graph analysis: la red de validaciones debe ser orgánica
4. CAPTCHA adaptativo solo cuando hay señales de alerta
5. Cooling periods para cuentas nuevas (no pueden votar en primeras 72h)
```

---

## Gobernanza de la Plataforma

### ¿Quién gobierna VÉRTICE OS?
La plataforma tiene tres capas de gobernanza:

```
CAPA 1 — Gobernanza Técnica (Fase I-II)
  Equipo fundador toma decisiones técnicas
  Con asesoría de un Consejo Técnico independiente

CAPA 2 — Gobernanza de Contenido
  Consejo Cívico: 7 miembros elegidos por la comunidad
  Mandato: 6 meses, renovación parcial
  Responsable: moderación, reglas de participación

CAPA 3 — Gobernanza Plena (Fase IV)
  DAO con tokens de gobernanza no-financieros
  Soulbound: no transferibles, no comprables
  Una persona = máximo X tokens (límite duro)
```

### Consejo Cívico
**Composición:** 7 miembros  
**Selección:** Elección directa en la plataforma (cada 6 meses)  
**Requisitos para candidatos:**
- Reputación cívica mínima: percentil 70
- Mínimo 6 meses de participación activa
- Sin cargos públicos actuales (independencia)
- Declaración pública de conflictos de interés

**Funciones:**
- Aprobar o rechazar cambios a las reglas de gobernanza
- Resolver disputas de moderación
- Proponer mejoras al sistema
- Transparencia: todas las sesiones son públicas y grabadas

---

## Transparencia Radical

### Principio
Todo lo que el sistema decide es auditable. No hay decisiones de caja negra.

### Qué es público
```
✅ Todas las propuestas y su historial completo
✅ El conteo agregado de votos (no los votos individuales)
✅ Las delegaciones activas (quién delega a quién)
✅ Las acciones del Consejo Cívico
✅ Los smart contracts (código open-source)
✅ Las decisiones del Agente de Integridad (sin datos de usuarios)
✅ El algoritmo de reputación (documentado públicamente)
```

### Qué es privado
```
🔒 El voto individual de cada ciudadano
🔒 Los datos personales de verificación
🔒 Las comunicaciones privadas entre ciudadanos
🔒 Los reportes territoriales con datos personales del reportante
```

---

## Marco Legal (Colombia)

### Naturaleza jurídica de las votaciones
Las decisiones en VÉRTICE OS son **consultas ciudadanas**, no actos administrativos vinculantes. Para que una decisión tenga fuerza legal, debe seguir el camino institucional correspondiente (Concejo, Alcaldía, etc.).

**Sin embargo**, el poder de VÉRTICE OS es la **presión cívica legítima y documentada**: una propuesta aprobada con quórum verificable es un mandato político real aunque no sea jurídicamente vinculante.

### Integración con instituciones
```
MODELO CONSULTIVO (Fase I-II):
  La plataforma envía reportes estructurados a instituciones
  Las instituciones responden públicamente
  El incumplimiento queda registrado y es visible

MODELO COLABORATIVO (Fase III):
  Acuerdos formales con Alcaldía/Concejo
  Las propuestas aprobadas entran al proceso institucional
  VÉRTICE OS como canal oficial de participación ciudadana

MODELO INSTITUCIONAL (Fase IV):
  Posible reconocimiento legal como mecanismo de consulta
  Integración con mecanismos de participación ciudadana
  existentes (Ley 134/1994, Ley 1757/2015)
```

---

*Marco de gobernanza vivo — toda modificación requiere aprobación del Consejo Cívico.*  
*v0.1.0 — Cartagena de Indias, Colombia*
