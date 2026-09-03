# Civic Identity Assurance — VÉRTICE OS

> Estado P0.5 · snapshot 3 de septiembre de 2026

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

El ingress exige:

- firma HMAC versionada;
- timestamp firmado con ventana limitada;
- `key-id` firmado;
- secreto aislado por provider y key-id;
- canonicalización determinística del evento;
- rotación sin secreto global compartido entre proveedores.

Este contrato autentica el salto adapter → VÉRTICE. **No sustituye la firma nativa del proveedor KYC.**

### P0.4 — Provider activation boundary

Un nombre configurado en variables de entorno no puede crear autoridad cívica por sí solo. Un provider queda operacional únicamente si coinciden:

1. allowlist de política;
2. adapter compilado en el registry;
3. keyset aislado del ingress interno;
4. elegibilidad del adapter para el runtime actual.

`trusted_kyc` es sintético y no puede activarse en producción.

### P0.5 — Native Provider Adapter Certification Boundary

P0.5 elimina la bandera declarativa `productionEligible`. La elegibilidad productiva ahora deriva de un **adapter nativo ejecutable** creado mediante el contrato de `identity-provider-adapter.ts`.

Todo futuro adapter nativo debe proporcionar código ejecutable para:

- verificar criptográficamente el webhook nativo sobre los **bytes crudos** recibidos;
- devolver un `event_id` y `signed_at` autenticados por ese protocolo;
- realizar un claim atómico de replay para `provider + event_id`;
- normalizar únicamente después de verificar la autenticidad nativa.

El wrapper común de VÉRTICE aplica además:

- límite de tamaño del payload;
- validación del timestamp de recepción;
- ventana máxima de frescura;
- rechazo explícito de replay;
- validación contra `CivicProofingEventSchema`;
- binding del provider normalizado al adapter compilado;
- binding de `event_id` al identificador autenticado del webhook.

Existe un harness de certificación adversarial reutilizable que exige que cada adapter futuro demuestre, con fixtures del protocolo del proveedor:

1. aceptación y normalización exacta de un webhook válido;
2. rechazo de payload manipulado;
3. rechazo de webhook sin autenticación nativa;
4. rechazo de webhook obsoleto;
5. rechazo de replay.

Los cambios a esta frontera disparan un workflow dedicado `Identity Provider Certification` además del CI general.

---

## Assurance y padrón electoral congelado

El modelo protege la votación en dos momentos distintos.

### 1. Apertura de votación

Al pasar una propuesta a `voting`, VÉRTICE construye `proposal_voter_roll` con ciudadanos que satisfacen la política vigente de identidad cívica y alcance territorial.

Ese snapshot fija el universo electoral y, por tanto, el denominador de quórum.

### 2. Ventana de voto

Una vez congelado el padrón, la admisión de votos directos y participación delegada se realiza contra `proposal_voter_roll`.

**No se vuelve a inferir elegibilidad desde una configuración mutable de providers en cada request.**

Esto evita que una modificación de allowlist cambie retroactivamente el electorado, que una revocación/configuración produzca quórums inconsistentes a mitad del proceso o que rutas distintas apliquen políticas divergentes.

Si la propuesta está en votación y no existe padrón congelado, el sistema debe fallar cerrado.

---

## Federación CTG One

CTG One puede autenticar y federar una cuenta, pero:

```text
CTG One SSO ≠ Civic Identity Assurance
```

Login, matching de email, wallet ownership, account age o reputación no sustituyen proofing de identidad.

---

## Regla de onboarding de providers

Un provider productivo solo puede incorporarse cuando cumpla **todas** estas capas:

1. selección y evaluación del proveedor real;
2. implementación del protocolo nativo de firma/webhook usando `raw_body`;
3. normalización PII-minimized al contrato VÉRTICE;
4. replay store compartido y atómico para producción;
5. ejecución satisfactoria del harness P0.5 con fixtures oficiales o reproducibles;
6. registro compilado del adapter nativo;
7. allowlist de política;
8. keyset del salto interno adapter → VÉRTICE;
9. canary y evidencia de revocación/expiración en producción antes de usar el provider para gobernanza real.

Para un piloto en Colombia deben evaluarse además documento oficial aplicable, anti-spoofing/liveness cuando corresponda, duplicidad de persona, referencias auditables, minimización y retención de datos, obligaciones de protección de datos, disponibilidad e incident response.

---

## Delegaciones

La delegación no puede ampliar el electorado.

Un delegador solo puede aportar participación a un delegado si el delegador pertenece al padrón congelado de esa propuesta y la delegación está activa, vigente y dentro del scope aplicable.

La assurance no se hereda desde el delegado: la pertenencia al padrón ya representa la evaluación del delegador realizada al abrir la votación.

---

## Limitaciones actuales

P0.5 deja preparada y fail-closed la frontera para integrar un proveedor real, pero **no activa por sí sola un KYC productivo**.

Pendientes externos/siguiente evolución:

1. seleccionar un proveedor de identity proofing adecuado al piloto;
2. implementar su adapter nativo concreto y su endpoint de webhook sin perder el raw body;
3. conectar `claim_replay` a un store compartido y atómico de producción;
4. ejecutar los vectores de certificación con el protocolo/fixtures reales del proveedor;
5. realizar canary de verified/revoked/expired y evidencia operacional antes de habilitarlo en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`;
6. continuar mejorando onboarding y revisión administrativa en el dashboard ciudadano.

---

## Invariantes de seguridad

**Ningún código puede inferir civic identity assurance únicamente desde login, email, CTG One federation, cédula autodeclarada, firma de wallet, reputación o antigüedad de cuenta.**

**Ninguna variable de entorno puede convertir por sí sola un provider en adapter productivo.**

**Ningún adapter debe normalizar o confiar en un webhook antes de autenticar el payload nativo exacto recibido.**

Para votaciones abiertas, **ningún código puede sustituir el padrón congelado por una reevaluación ad hoc de providers**.
