# Civic Identity Assurance — VÉRTICE OS

> Estado P0.7 · snapshot 4 de septiembre de 2026

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
3. keyset aislado del ingress interno cuando ese deployment topology lo utiliza;
4. elegibilidad del adapter para el runtime actual.

`trusted_kyc` es sintético y no puede activarse en producción.

### P0.5 — Native Provider Adapter Certification Boundary

P0.5 elimina la bandera declarativa `productionEligible`. La elegibilidad productiva deriva de un **adapter nativo ejecutable** creado mediante el contrato de `identity-provider-adapter.ts`.

Todo adapter nativo debe proporcionar código ejecutable para:

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

### P0.6 — Distributed replay + lifecycle canary

P0.6 conecta el claim de replay a Redis mediante una operación atómica `SET ... NX ... EX`. El fallo de Redis cierra el ingress del proofing en vez de continuar sin protección distribuida.

El lifecycle canary exige entregas nativas autenticadas `verified`, `revoked` y `expired` para el mismo subject estable, con tiempo monotónico y assurance suficiente en el estado verificado.

El workflow `Identity Provider Certification` ejecuta estas garantías además del CI general.

### P0.7 — Native Provider Webhook Ingress

P0.7 añade el boundary HTTP productivo para adapters nativos compilados:

`POST /identity/providers/:provider/webhook`

El parser JSON de esta ruta está encapsulado en su propio scope Fastify y entrega un `Buffer` al adapter. El payload no se parsea ni reserializa antes de la verificación vendor-native.

El adapter devuelve además un receipt autenticado con `event_id` y `signed_at`. Después de validar y normalizar, VÉRTICE persiste el evento con procedencia diferenciada:

- `ingress_signature_version = 1`: hop HMAC interno adapter → VÉRTICE;
- `ingress_signature_version = 2`: webhook nativo verificado directamente por un adapter compilado.

No se persisten la firma nativa, secretos ni raw payloads. Para procedencia nativa se conserva únicamente el timestamp autenticado requerido para auditoría.

Los replays verificados no se procesan dos veces. La ruta puede reconocer el retry como duplicado para evitar un retry storm del vendor sin debilitar el rechazo de replay en el adapter.

`GET /identity/providers/readiness` permite al superadmin inspeccionar el estado operacional sin exponer secretos.

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
6. lifecycle canary P0.6;
7. registro compilado del adapter nativo;
8. configuración de credenciales y webhook del vendor;
9. uso del ingress nativo P0.7 o del hop HMAC interno, según el deployment topology;
10. allowlist de política;
11. canary productivo acotado antes de usar el provider para gobernanza real.

Para un piloto en Colombia deben evaluarse además documento oficial aplicable, anti-spoofing/liveness cuando corresponda, duplicidad de persona, referencias auditables, minimización y retención de datos, obligaciones de protección de datos, disponibilidad e incident response.

---

## Delegaciones

La delegación no puede ampliar el electorado.

Un delegador solo puede aportar participación a un delegado si el delegador pertenece al padrón congelado de esa propuesta y la delegación está activa, vigente y dentro del scope aplicable.

La assurance no se hereda desde el delegado: la pertenencia al padrón ya representa la evaluación del delegador realizada al abrir la votación.

---

## Limitaciones actuales

P0.7 deja preparada, observable y fail-closed la frontera para integrar un proveedor real, pero **no activa por sí sola un KYC productivo**.

Pendientes externos/siguiente evolución:

1. seleccionar un proveedor de identity proofing adecuado al piloto colombiano;
2. implementar su adapter nativo concreto con el protocolo oficial de firma;
3. aportar fixtures oficiales o reproducibles y credenciales sandbox;
4. configurar el webhook real del proveedor;
5. ejecutar P0.5/P0.6 contra el protocolo vendor-specific;
6. realizar canary `verified/revoked/expired` y evidencia operacional antes de habilitarlo en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`;
7. continuar mejorando onboarding y revisión administrativa en el dashboard ciudadano.

---

## Invariantes de seguridad

**Ningún código puede inferir civic identity assurance únicamente desde login, email, CTG One federation, cédula autodeclarada, firma de wallet, reputación o antigüedad de cuenta.**

**Ninguna variable de entorno puede convertir por sí sola un provider en adapter productivo.**

**Ningún adapter debe normalizar o confiar en un webhook antes de autenticar el payload nativo exacto recibido.**

**Ninguna ruta de webhook nativo puede utilizar el JSON ya parseado por Fastify como material de verificación criptográfica.**

Para votaciones abiertas, **ningún código puede sustituir el padrón congelado por una reevaluación ad hoc de providers**.
