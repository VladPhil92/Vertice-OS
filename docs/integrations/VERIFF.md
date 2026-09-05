# Veriff — Colombia Civic Identity Provider (P0.8 → P1.0)

> Estado: **Integrado en código / pendiente de credenciales sandbox y canary real**  
> Snapshot: 4 de septiembre de 2026

## Objetivo

Veriff es el primer provider vendor-specific integrado a la frontera de civic identity assurance de VÉRTICE OS para el piloto colombiano.

La integración está diseñada para que VÉRTICE no recolecte ni persista el payload documental/biométrico de Veriff. El ciudadano inicia un flujo alojado por Veriff y VÉRTICE conserva únicamente evidencia normalizada y mínima para gobernanza.

## Contrato implementado

### Creación de sesión

Endpoint ciudadano:

`POST /identity/providers/veriff/session`

VÉRTICE envía a Veriff únicamente:

- `callback`;
- `vendorData = citizen UUID`;
- `endUserId = citizen UUID`.

No envía desde su base de datos:

- número de cédula;
- nombre;
- fecha de nacimiento;
- fotografía;
- selfie;
- imágenes de documentos.

La petición a Veriff se autentica con `X-AUTH-CLIENT` y `X-HMAC-SIGNATURE`. La respuesta debe retornar `vrf-auth-client` y `vrf-hmac-signature`; VÉRTICE verifica ambos sobre el body exacto antes de aceptar `verification.id` y `verification.url`.

### Webhook nativo

Endpoint:

`POST /identity/providers/veriff/webhook`

El adapter valida antes de parsear:

1. `x-auth-client` coincide con la API key configurada;
2. `x-hmac-signature` es HMAC-SHA256 válido sobre los bytes crudos;
3. timestamp autenticado está dentro de la ventana permitida;
4. `provider + event_id` obtiene un claim Redis `NX`;
5. `endUserId` es UUID y existe como binding explícito del ciudadano;
6. solo entonces se normaliza y persiste el evento con `ingress_signature_version=2`.

## Mapeo de lifecycle

Decision webhook:

| Veriff | VÉRTICE | Assurance |
| --- | --- | ---: |
| `approved` | `verified` | 2 |
| `declined` | `rejected` | 0 |
| `resubmission_requested` | `review` | 0 |
| `review` | `review` | 0 |
| `expired` | `expired` | 0 |
| `abandoned` | `expired` | 0 |

User-defined status webhook:

- si `statusCode === VERIFF_REVOCATION_STATUS_CODE` → `revoked`;
- cualquier otro status personalizado → `review` para fallar cerrado.

La referencia durable es `end-user:<citizen UUID>`, estable entre sesiones y libre de datos documentales. La detección de una misma persona física intentando usar varias cuentas sigue siendo un control separado que debe certificarse con las capacidades/política contratadas del provider antes del piloto real.

## Variables

Requeridas para runtime Veriff:

- `VERIFF_BASE_URL`
- `VERIFF_API_KEY`
- `VERIFF_SHARED_SECRET`

Opcionales:

- `VERIFF_CALLBACK_URL`
- `VERIFF_REVOCATION_STATUS_CODE` (default `vertice_revoked`)

`VERIFF_BASE_URL` debe copiarse del Customer Portal; no se debe asumir un dominio por defecto.

## Separación entre readiness, promoción, evidencia y autoridad

P1.0 separa cinco estados:

1. **Registered**: adapter `veriff` compilado en el registry.
2. **Runtime ready**: Base URL + API key + shared secret presentes.
3. **Promoted**: `veriff` aparece en `CIVIC_IDENTITY_CERTIFIED_PROVIDERS` después de revisión operativa.
4. **Evidence certified**: existe un registro activo en `civic_identity_provider_certifications`, creado únicamente desde webhooks nativos autenticados y persistidos.
5. **Governance ready**: además `veriff` pertenece a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` y existe evidencia P1.0 activa.

La autoridad efectiva para un provider nativo requiere:

`compiled adapter ∩ runtime credentials ∩ P0.9 promotion ∩ governance allowlist ∩ P1.0 durable evidence`

Por tanto, una variable de entorno mal configurada no puede convertir por sí sola un proof Veriff en elegibilidad electoral.

`GET /identity/providers/readiness` expone sin secretos:

- `registered_native_providers`;
- `runtime_ready_native_providers`;
- `certified_native_providers` (promoción P0.9);
- `evidence_certified_native_providers`;
- `activated_providers`;
- `governance_ready_providers`.

## Ledger de certificación P1.0

El ledger `civic_identity_provider_certifications` almacena únicamente:

- provider;
- versión del contrato;
- `evidence_digest` SHA-256;
- `subject_binding_hash` SHA-256;
- event IDs `verified`, `revoked`, `expired`;
- actor y timestamp de certificación;
- revocación y razón, si aplica.

No almacena raw webhooks, firmas, número de documento, imágenes ni biometría.

Para crear una certificación, los tres event IDs deben existir previamente en `civic_identity_proof_events` y cumplir simultáneamente:

- `ingress_signature_version = 2`;
- exactamente un estado `verified`, uno `revoked` y uno `expired`;
- mismo `citizen_id` y `provider_reference`;
- `assurance_level >= 2` en `verified`;
- tiempos monotónicos `verified <= revoked <= expired`.

## Controles superadmin

Base:

`/identity/provider-certifications`

Endpoints:

- `GET /` — historial de certificaciones;
- `POST /:provider/certify` — crea certificación desde event IDs persistidos;
- `POST /:provider/revoke` — revoca inmediatamente la certificación activa con razón auditada.

La certificación y su revocación se registran también en `admin_audit_log`.

## Activación sandbox pendiente

En Veriff Customer Portal:

1. crear/abrir la integración de prueba;
2. copiar Base URL, API key y shared secret;
3. configurar Decision webhook en `https://<api-publica>/identity/providers/veriff/webhook`;
4. configurar User-defined statuses webhook en la misma URL;
5. crear el status personalizado cuyo código coincida con `VERIFF_REVOCATION_STATUS_CODE`;
6. mantener `veriff` fuera de `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` durante el canary;
7. ejecutar evidencia real que produzca `approved`, revocación y `expired/abandoned` para el mismo binding opaco;
8. tomar los tres event IDs persistidos;
9. ejecutar `POST /identity/provider-certifications/veriff/certify` como superadmin;
10. verificar `evidence_certified_native_providers` en readiness;
11. promover `veriff` en `CIVIC_IDENTITY_CERTIFIED_PROVIDERS` y añadirlo a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` únicamente después de la revisión final.

## Definition of Done externa

P1.0 queda externamente cerrada cuando:

`citizen → hosted Veriff flow → signed native webhook → persisted native receipt → verified → revoked → expired → evidence certification ledger → governance-ready`

con evidencia real de sandbox/producción limitada, auditoría durable y sin PII documental/biométrica persistida en VÉRTICE.

Mientras no existan credenciales y eventos reales, el ledger permanece vacío y VÉRTICE continúa fail-closed por diseño.
