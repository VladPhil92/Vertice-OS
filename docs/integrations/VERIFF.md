# Veriff — Colombia Civic Identity Provider (P0.8)

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
3. timestamp autenticado está dentro de la ventana P0.7;
4. `provider + event_id` obtiene un claim Redis `NX`;
5. `endUserId` es UUID y existe como binding explícito del ciudadano;
6. solo entonces se normaliza el evento.

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

La referencia durable es `end-user:<citizen UUID>`, estable entre sesiones y libre de PII. La detección de una misma persona física intentando usar varias cuentas sigue siendo un control separado que debe certificarse con las capacidades/política contratadas del provider antes del piloto real.

## Variables

Requeridas para runtime Veriff:

- `VERIFF_BASE_URL`
- `VERIFF_API_KEY`
- `VERIFF_SHARED_SECRET`

Opcionales:

- `VERIFF_CALLBACK_URL`
- `VERIFF_REVOCATION_STATUS_CODE` (default `vertice_revoked`)

`VERIFF_BASE_URL` debe copiarse del Customer Portal; no se debe asumir un dominio por defecto.

## Separación entre readiness y autoridad

Tres estados distintos:

1. **Registered**: adapter `veriff` compilado en el registry.
2. **Runtime ready**: Base URL + API key + shared secret presentes.
3. **Activated for governance**: además `veriff` pertenece a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`.

Esto permite probar sandbox y ejecutar canaries antes de que una prueba Veriff pueda otorgar elegibilidad electoral.

## Activación sandbox manual pendiente

En Veriff Customer Portal:

1. crear/abrir la integración de prueba;
2. copiar Base URL, API key y shared secret;
3. configurar Decision webhook en `https://<api-publica>/identity/providers/veriff/webhook`;
4. configurar User-defined statuses webhook en la misma URL si se utilizará revocación;
5. crear el status personalizado cuyo código coincida con `VERIFF_REVOCATION_STATUS_CODE`;
6. mantener `veriff` fuera de `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`;
7. ejecutar canary `approved → revoked` y un caso `expired/abandoned`;
8. verificar receipts, replay e historial de proofing;
9. solo después de evidencia satisfactoria añadir `veriff` a la allowlist de assurance.

## Definition of Done externa

P0.8 queda plenamente certificada cuando:

`citizen → create session → hosted Veriff flow → signed decision webhook → Redis replay claim → verified proof → assurance visible → revocation/expiry signed → proof no longer active`

con evidencia real de sandbox/producción limitada y sin PII de Veriff persistida en VÉRTICE.
