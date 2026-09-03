# Marco de Gobernanza — VÉRTICE OS

> Contrato de gobernanza implementado · snapshot 2 de septiembre de 2026

VÉRTICE OS trata la gobernanza como infraestructura continua. Este documento describe las reglas que el código actual intenta hacer cumplir y separa esas reglas de mecanismos futuros o experimentales.

---

## 1. Principios

1. **Una persona no debe ejercer doble influencia en una misma propuesta.**
2. **La elegibilidad electoral debe ser estable durante la ventana de votación.**
3. **La autenticación no equivale a identidad cívica asegurada.**
4. **La delegación debe ser explícita, revocable y acotada.**
5. **El sentido individual del voto debe permanecer privado.**
6. **El conteo agregado y el proceso de admisión deben ser auditables.**
7. **La reputación puede modular participación según la política vigente, pero no sustituye identidad ni crea autoridad administrativa.**
8. **Las decisiones de VÉRTICE son mecanismos cívicos/consultivos y no sustituyen los procedimientos jurídicos vinculantes aplicables en Colombia.**

---

## 2. Ciclo de una propuesta

El dominio de gobernanza mantiene una máquina de estados de propuesta. Las transiciones relevantes incluyen creación, deliberación, apertura de votación y resultado.

La regla crítica para abrir una votación es la creación de un **padrón electoral congelado** (`proposal_voter_roll`).

```text
propuesta
   ↓
preparación / deliberación
   ↓
transición a voting
   ├── evaluar política de identidad cívica
   ├── seleccionar electorado territorial elegible
   ├── congelar proposal_voter_roll
   └── fijar parámetros de votación
   ↓
ventana de voto
   └── admisión contra el padrón congelado
   ↓
resultado
```

La transición no debe abrir una votación sin padrón válido.

---

## 3. Identidad cívica y padrón

### 3.1 Separación de conceptos

VÉRTICE distingue:

- **authentication:** control de una sesión;
- **contact verification:** control del email/canal declarado;
- **civic identity assurance:** proofing fuerte de identidad realizado por un provider aprobado.

El acceso mediante CTG One no concede automáticamente assurance cívica.

### 3.2 Allowlist de assurance

`CIVIC_IDENTITY_ASSURANCE_PROVIDERS` define qué providers externos pueden servir como evidencia de identidad cívica para construir el electorado protegido.

- allowlist vacía → fail-closed;
- `ctg_one` no se acepta por defecto;
- un provider solo debe añadirse después de auditar su proceso real de identity proofing.

### 3.3 Snapshot electoral

La assurance se evalúa al construir el padrón para una propuesta. Durante la ventana de votación, `proposal_voter_roll` es la autoridad de admisión.

Esto evita que una modificación posterior de configuración, provider o perfil altere retroactivamente quién podía votar en una elección ya abierta.

Si una propuesta en `voting` no tiene padrón congelado, el sistema debe fallar cerrado.

---

## 4. Democracia líquida

VÉRTICE permite participación directa y delegada.

### 4.1 Tipos de delegación

Scopes implementados:

- `general` — delegación general;
- `domain` — delegación para una categoría/dominio;
- `proposal` — delegación para una propuesta concreta.

### 4.2 Precedencia

Cuando un delegador tiene scopes superpuestos, la resolución debe ser determinística:

```text
proposal > domain > general
```

La delegación más específica prevalece.

### 4.3 Validez

Solo cuentan delegaciones:

- activas;
- con `valid_from <= now`;
- sin expiración o con `valid_until > now`;
- compatibles con categoría/propuesta;
- cuyo delegador pertenece al padrón congelado.

Una delegación no puede ampliar el electorado: únicamente puede trasladar la forma de participación de alguien ya elegible.

---

## 5. Ledger canónico de participación

La gobernanza actual usa un ledger durable para coordinar voto directo y participación delegada.

### Objetivos

- impedir doble influencia;
- preservar privacidad mediante nullifiers opacos;
- contabilizar participantes reales para quórum;
- soportar concurrencia sin depender de contadores incrementales frágiles;
- centralizar la admisión electoral en un único contrato de servicio.

### 5.1 Voto directo

El ciudadano debe:

1. existir;
2. pertenecer al `proposal_voter_roll`;
3. votar dentro de una ventana activa;
4. no haber consumido ya su participación directa de forma definitiva.

El sentido del voto se registra separado de la identidad pública del ciudadano mediante un nullifier derivado.

### 5.2 Participación delegada

Cuando un delegado vota, el sistema resuelve delegaciones efectivas y reclama la participación de delegadores elegibles.

Cada participación delegada debe quedar representada de forma durable y no solo como incremento transitorio de un agregado.

### 5.3 Override directo

Si un ciudadano fue contado previamente por delegación y luego decide votar directamente durante la ventana válida, el contrato canónico permite que su decisión directa sustituya la participación delegada **sin crear un segundo participante**.

La regla conceptual es:

```text
1 ciudadano elegible = máximo 1 participación efectiva por propuesta
```

### 5.4 Tally

Los agregados deben derivarse del ledger durable de participación/votos, no de simples contadores mutados por cada request.

`total_votes` representa participantes efectivos, incluidos los delegados válidamente reclamados, y por ello debe permanecer coherente con el cálculo de quórum.

---

## 6. Peso de voto y reputación

El código mantiene una función de peso para participación directa basada en reputación cívica, con límites definidos por la implementación.

Reglas de política:

- la reputación **no** compra elegibilidad;
- la reputación **no** sustituye proofing de identidad;
- la reputación **no** puede convertir una cuenta fuera del padrón en votante;
- cualquier modificación a la fórmula debe acompañarse de tests, documentación y evaluación de efectos distributivos.

No debe asumirse que un modelo de reputación ponderada es jurídicamente equivalente a `una persona = un voto` en mecanismos electorales oficiales. En VÉRTICE se usa dentro de un sistema cívico consultivo.

---

## 7. Privacidad

### Público o auditable

- propuesta y su historial;
- parámetros de votación;
- tamaño del electorado cuando corresponda;
- tally agregado;
- reglas de delegación y admisión documentadas;
- eventos administrativos/auditoría que no revelen PII.

### Privado

- sentido individual del voto;
- cédula y datos de proofing;
- secretos de providers;
- asociación pública entre ciudadano y nullifier de voto;
- evidencia biométrica o documental sensible.

La existencia de blockchain no autoriza almacenar PII o votos individuales on-chain.

---

## 8. Autoridad administrativa

El gobierno operativo de la plataforma usa roles persistentes:

- `citizen`
- `moderator`
- `admin`
- `superadmin`

El usuario puede cambiar su `active_role` únicamente dentro de los grants que posee.

Los privilegios de alto nivel deben revalidarse contra la autoridad persistida y la sesión. No confiar exclusivamente en claims antiguos de JWT.

### Superadmin

- el primer superadmin se bootstrappea mediante autoridad federada server-managed de CTG One;
- después del bootstrap, nuevos grants `superadmin` se administran desde VÉRTICE;
- el último superadmin no puede eliminarse;
- grants, bootstrap y cambios de rol deben dejar evidencia de auditoría.

La federación CTG One es una autoridad de bootstrap controlada; no convierte a cualquier cuenta CTG One en administrador.

---

## 9. Deliberación, IA y neutralidad

Los agentes de IA pueden:

- sintetizar argumentos;
- detectar temas y duplicados;
- ayudar a convertir demandas en borradores;
- analizar patrones territoriales;
- asistir en control público/legal;
- señalar patrones de integridad.

No deben:

- emitir votos;
- inventar identidad o elegibilidad;
- cambiar el padrón electoral;
- conceder roles;
- decidir por sí solos el resultado de una propuesta;
- presentarse como autoridad pública.

Toda automatización con efecto de gobernanza debe producir trazabilidad suficiente para revisión humana.

---

## 10. Relación con expedientes cívicos

El workflow ciudadano conecta gobernanza con reportes y control público:

```text
Reporte territorial
  ↓
Análisis IA
  ↓
Borrador / propuesta
  ↓
Deliberación
  ↓
Votación y decisión
  ↓
Control público / acción legal
```

El expediente preserva provenance y ownership. La creación de un workflow no debe duplicar eventos de reputación que ya pertenecen al reporte o propuesta canónicos.

---

## 11. Estado de mecanismos avanzados

Los siguientes conceptos pueden formar parte de la evolución de VÉRTICE, pero **no** deben documentarse como garantías productivas actuales sin implementación/certificación verificable:

- ZKP completo para auditoría de cada voto;
- identidad biométrica productiva;
- integración certificada con Registraduría;
- DAO de plataforma;
- The Graph como indexador canónico;
- ejecución automática vinculante de decisiones sobre instituciones públicas.

---

## 12. Marco legal colombiano

VÉRTICE puede apoyar y documentar participación ciudadana, derecho de petición, tutela, acciones populares y otros mecanismos según el módulo correspondiente.

Las votaciones internas son consultas cívicas y evidencia de voluntad agregada. Para producir efectos jurídicos propios de una elección, consulta popular, acto administrativo u otro mecanismo vinculante, deben cumplirse los procedimientos y autoridades establecidos por la Constitución y la legislación colombiana.

---

## 13. Invariantes para futuros cambios

Antes de fusionar un cambio de gobernanza, comprobar:

- [ ] ¿Preserva el padrón congelado durante la ventana de voto?
- [ ] ¿Evita doble participación directa/delegada?
- [ ] ¿Respeta precedencia y vigencia de delegaciones?
- [ ] ¿No infiere assurance desde SSO/email/wallet/reputación?
- [ ] ¿Mantiene privada la relación identidad ↔ voto individual?
- [ ] ¿Mantiene coherentes `total_votes`, tally y quórum?
- [ ] ¿Centraliza la admisión en el ledger/servicio canónico?
- [ ] ¿Incluye tests de regresión para concurrencia y fail-closed?
- [ ] ¿Actualiza este documento y `docs/CURRENT_STATE.md`?
