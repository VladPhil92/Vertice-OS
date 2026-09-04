# Civic Identity Assurance — VÉRTICE OS

> Estado P0.8 · snapshot 4 de septiembre de 2026

## Objetivo

VÉRTICE separa tres conceptos que no pueden tratarse como equivalentes:

1. **Authentication** — el usuario controla una sesión VÉRTICE/CTG One aceptada.
2. **Contact verification** — el usuario controla el canal/contacto declarado.
3. **Civic identity assurance** — un proveedor independiente y aprobado realizó identity proofing suficientemente fuerte para una acción cívica protegida.

`verification_level` sigue siendo útil para onboarding/contacto, pero no prueba por sí solo que la identidad civil declarada pertenece a la persona que opera la cuenta.

---

## Estado de la frontera P0

### P0.1 — Assurance policy y padrón congelado

- solo providers incluidos en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` pueden contar como evidencia de assurance;
- la allowlist está vacía por defecto;
- allowlist vacía significa **fail-closed** para construir el electorado protegido;
- `ctg_one` federation no es un provider de assurance por defecto;
- `/identity/assurance` expone el estado real sin relabeling engañoso de email o cédula declarada como KYC;
- al abrir votación se congela `proposal_voter_roll`, que se convierte en la autoridad de admisión durante la elección.

### P0.2 — Lifecycle durable de proofing

VÉRTICE persiste pruebas y eventos de identity proofing con estados normalizados:

`pending → review → verified / rejected / expired / revoked`

La referencia del proveedor queda ligada a un único ciudadano y los eventos son idempotentes por `provider + event_id`. Los identificadores externos no se exponen al frontend.

### P0.3 — Auth del ingress normalizado

`POST /identity/proofing/events` es un salto **interno server-to-server** para eventos que ya fueron verificados por un adapter de proveedor.

El ingress exige firma HMAC versionada, timestamp limitado, `key-id` firmado, secreto aislado por provider/key-id y canonicalización determinística. Este contrato autentica adapter → VÉRTICE; **no sustituye la firma nativa del proveedor**.

### P0.4 — Provider activation boundary

Un nombre configurado en variables de entorno no puede crear autoridad cívica por sí solo. Un provider queda operacional únicamente si coinciden:

1. allowlist de política;
2. adapter compilado;
3. credenciales/runtime readiness del adapter nativo o keyset interno cuando aplique;
4. elegibilidad del adapter para el runtime actual.

`trusted_kyc` es sintético y no puede activarse en producción.

### P0.5 — Native Provider Adapter Certification Boundary

La elegibilidad productiva deriva de un **adapter nativo ejecutable**, no de una bandera declarativa. Todo adapter debe autenticar bytes crudos, devolver `event_id`/`signed_at` autenticados, reclamar replay atómico y normalizar solo después de autenticar.

El harness adversarial exige: webhook válido, payload manipulado rechazado, ausencia de autenticación rechazada, stale rechazado y replay rechazado.

### P0.6 — Distributed replay + lifecycle canary

Redis implementa `SET ... NX ... EX` para el replay distribuido. Fallo de Redis = fail-closed. El lifecycle canary exige `verified`, `revoked` y `expired` para el mismo subject estable con tiempos monotónicos.

### P0.7 — Native Provider Webhook Ingress

`POST /identity/providers/:provider/webhook` preserva el body exacto como `Buffer` dentro de un scope Fastify encapsulado. La procedencia durable distingue:

- `ingress_signature_version = 1`: hop HMAC interno;
- `ingress_signature_version = 2`: webhook nativo autenticado por adapter compilado.

No se persisten firmas, secretos ni raw payloads del vendor.

### P0.8 — Veriff Colombia Integration

P0.8 introduce el primer adapter vendor-specific: `veriff`.

La integración implementa:

- `x-auth-client` ligado a la API key de Veriff;
- HMAC-SHA256 sobre los bytes crudos mediante `x-hmac-signature`;
- validación antes de cualquier parsing/normalización;
- decision lifecycle `approved / declined / resubmission_requested / review / expired / abandoned`;
- user-defined status para revocación autenticada;
- replay Redis compartido;
- binding del ciudadano exclusivamente mediante el `endUserId` firmado;
- referencia durable PII-free `end-user:<citizen UUID>`;
- creación de sesión alojada por Veriff mediante `POST /identity/providers/veriff/session`;
- HMAC de request y verificación de `vrf-auth-client` + `vrf-hmac-signature` en la respuesta;
- retorno al frontend únicamente de `session_id` y URL alojada, sin exponer `sessionToken`;
- separación explícita entre `registered`, `runtime_ready` y `activated`.

La creación de sesión envía únicamente `callback`, `vendorData` y `endUserId`, usando el UUID interno como valor opaco. VÉRTICE no debe enviar ni persistir desde este flujo número de documento, nombre, selfie, foto de documento o payload biométrico del proveedor.

#### Activación P0.8

`veriff` puede estar **compilado** sin estar habilitado para gobernanza.

- `registered`: adapter incluido en código;
- `runtime_ready`: `VERIFF_BASE_URL`, `VERIFF_API_KEY` y `VERIFF_SHARED_SECRET` presentes;
- `activated`: además `veriff` está explícitamente en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`.

Las credenciales pueden configurarse primero para sandbox/canary manteniendo `veriff` fuera de la allowlist. Esa es la secuencia requerida.

---

## Assurance y padrón electoral congelado

Al pasar una propuesta a `voting`, VÉRTICE construye `proposal_voter_roll` con ciudadanos que satisfacen la política vigente de identidad cívica y alcance territorial. Ese snapshot fija el universo electoral y el denominador de quórum.

Durante la ventana de voto, la admisión usa el padrón congelado. **No se vuelve a inferir elegibilidad desde una configuración mutable de providers en cada request.**

---

## Federación CTG One

```text
CTG One SSO ≠ Civic Identity Assurance
```

Login, email, wallet ownership, antigüedad o reputación no sustituyen proofing de identidad.

---

## Regla de onboarding de providers

Un provider productivo solo puede incorporarse cuando cumpla todas estas capas:

1. evaluación de jurisdicción/política;
2. protocolo nativo sobre raw body;
3. normalización PII-minimized;
4. replay distribuido;
5. P0.5 adversarial certification;
6. P0.6 lifecycle canary;
7. adapter compilado;
8. credenciales y webhook real;
9. runtime readiness verificable;
10. allowlist explícita;
11. bounded production canary antes de construir un nuevo electorado real.

Para Colombia deben evaluarse además documento aplicable, liveness/anti-spoofing según el flujo contratado, prevención de duplicidad de persona, minimización/retención, obligaciones de protección de datos, disponibilidad e incident response.

---

## Limitaciones actuales

P0.8 integra Veriff en código, pero **no equivale a provider real certificado** mientras falten credenciales y evidencia sandbox/productiva limitada.

Pendientes externos:

1. obtener Base URL, API key y shared secret de la integración Veriff;
2. configurar Decision webhook;
3. configurar User-defined statuses webhook/status code para revocación si se usa ese mecanismo;
4. ejecutar canary real `approved → revoked` y un caso `expired/abandoned`;
5. certificar controles de duplicidad de persona y política de retención/privacidad del producto contratado;
6. añadir `veriff` a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` únicamente después de evidencia satisfactoria.

---

## Invariantes de seguridad

**Ningún código puede inferir civic identity assurance únicamente desde login, email, CTG One federation, cédula autodeclarada, firma de wallet, reputación o antigüedad de cuenta.**

**Ninguna variable de entorno puede convertir por sí sola un provider en autoridad cívica.**

**Ningún adapter debe normalizar un webhook antes de autenticar el payload nativo exacto.**

**Ninguna ruta de webhook nativo puede utilizar JSON reserializado como material de verificación.**

**Las credenciales Veriff no deben exponerse al frontend ni almacenarse en `NEXT_PUBLIC_*`.**

Para votaciones abiertas, **ningún código puede sustituir el padrón congelado por una reevaluación ad hoc de providers**.
