# Phase 4 — Financial Operations Command Center & Go-Live Readiness

## Estado de release

Mientras esta rama no esté fusionada con todos los gates verdes, el estado es **IMPLEMENTED**.

Un merge con CI + Golden Financial Integrity + Financial Operations Command Center verdes permite declarar **INTEGRATED** para el plano interno de operación financiera. No convierte Mercado Pago, Wompi/BRE-B, settlement, refunds ni payouts productivos en `READY` o `CERTIFIED`.

## Objetivo

Phase 3 certificó la integridad interna de fee, ledger, settlement/reversal sintético y saldo desembolsable. Phase 4 agrega la capa que hace operable ese sistema durante un piloto con dinero:

1. una sola superficie administrativa para observar el estado financiero;
2. SLO guardrails derivados de evidencia durable;
3. emergency stops independientes para nuevas instrucciones de dinero;
4. recovery paths que siguen disponibles durante una incidencia;
5. auditabilidad del control plane;
6. una frontera explícita entre salud interna y certificación externa.

## Command Center

`GET /billing/admin/finance/command-center` requiere una sesión administrativa activa y agrega:

- estado de configuración de Mercado Pago;
- estado de configuración de Wompi Pagos a Terceros/BRE-B;
- release switches de collection y payouts;
- controles runtime durables;
- pagos pendientes y pagos stale;
- operaciones cuyo provider state quedó `unknown`;
- COP pagados en las últimas 24 horas;
- fees VÉRTICE liquidados en las últimas 24 horas;
- webhooks fallidos y backlog `received`;
- refunds pendientes o que requieren conciliación;
- payouts en vuelo o que requieren conciliación;
- risk flags abiertos, escalados y críticos;
- última evidencia de conciliación;
- estado de certificación operativa de payouts.

La UI vive en `/dashboard/admin/finance`.

## SLO guardrails

El Command Center no inventa disponibilidad. Deriva seis guardrails básicos:

| Guardrail | Condición nominal |
| --- | --- |
| `stalePaymentsClear` | 0 pagos `pending/authorized` sin cambio por más de 30 minutos |
| `webhookBacklogClear` | 0 webhooks `received` sin procesar por más de 5 minutos |
| `webhookFailures24hClear` | 0 webhooks fallidos en 24 horas |
| `refundReconciliationClear` | 0 refunds en `reconciliation_required` |
| `payoutReconciliationClear` | 0 payouts en `reconciliation_required` |
| `criticalRiskClear` | 0 risk flags críticos abiertos/escalados |

Estado agregado:

- `blocked`: al menos un emergency stop activo;
- `degraded`: ningún stop activo, pero al menos un SLO está incumplido;
- `nominal`: sin stops y todos los SLO guardrails en verde.

`nominal` **no** significa proveedor externo certificado.

## Emergency stops

Tabla durable: `finance_runtime_controls`.

Capacidades independientes:

- `pro_checkout`;
- `crowdfunding_collection`;
- `crowdfunding_payouts`.

Solo una sesión `superadmin` activa puede cambiar estos controles mediante:

`PUT /billing/admin/finance/controls/:capability`

Activar un stop exige una razón operativa de mínimo 8 caracteres y genera `admin_audit_log`.

### Principio de containment

Los stops bloquean solamente **nuevas instrucciones de dinero**.

No bloquean:

- cancelación de suscripciones existentes;
- conciliación de Mercado Pago;
- provider webhooks;
- solicitud/verificación de refunds;
- conciliación de payouts ya instruidos;
- lectura de estados y exportes contables.

Esto evita que la medida de contención impida reparar la propia incidencia.

### Fail-closed

Una operación nueva también se bloquea si:

- la tabla/control plane no puede leerse; o
- falta la fila canónica de la capacidad.

No existe fallback a “permitir dinero” ante incertidumbre del control plane.

## Least privilege

- `admin`: puede observar Command Center, reconciliar, revisar riesgo, gestionar refunds y operar las herramientas existentes que su rol ya autorizaba;
- `superadmin`: además puede activar/restaurar emergency stops.

El control runtime no reemplaza los feature flags de despliegue ni la certificación de proveedor. Es una capa adicional de defensa en profundidad.

## Invariantes

- dinero, subscription tier, KYC/KYB, tips, fees, refunds y payouts nunca escriben reputación cívica;
- los emergency stops no alteran ranking, voto, identity assurance, autoridad ni organic reach;
- browser state no es evidencia financiera;
- provider redirect no es settlement;
- `nominal` en el dashboard no certifica settlement externo;
- collection y payout son rails separados;
- un outage de payout no exige apagar Pro ni el dominio cívico;
- un stop jamás debe bloquear recovery/reconciliation;
- ninguna credencial productiva se versiona.

## Golden Operations journeys

`Financial Operations Command Center` usa PostgreSQL real y aplica el esquema financiero histórico completo más la migración Phase 4.

- **FO-01**: controles seeded permiten los tres rails; estado faltante falla cerrado.
- **FO-02**: stop durable + audit trail + aislamiento por rail + restore.
- **FO-03**: pago stale + provider unknown + webhook fallido + riesgo crítico degradan el Command Center.
- **FO-04**: todas las operaciones anteriores dejan reputación y `reputation_events` intactos.

El gate también verifica estructuralmente que reconciliation, refunds y webhooks siguen fuera de los guards de emergency stop.

## Certificación externa pendiente

Para promover un rail a `READY/CERTIFIED` todavía se requiere evidencia externa, según el rail:

1. credenciales de sandbox/producción configuradas fuera del repositorio;
2. canary de bajo monto con SHA desplegado conocido;
3. recepción y verificación de webhook real;
4. conciliación del provider contra el ledger local;
5. refund real y reconciliado para collection;
6. resolución BRE-B + payout real + receipt/reconciliation para payout;
7. evidencia operativa durable con timestamp, provider reference y revisión humana;
8. rollback/kill-switch drill.

Hasta entonces, el código y los gates de esta fase son **INTERNAL OPERATIONAL READINESS**, no certificación bancaria/proveedor.

## Rollback

1. Revertir UI, rutas y guards vuelve al comportamiento previo.
2. La tabla `finance_runtime_controls` es aditiva y puede quedar inerte durante rollback de aplicación.
3. No eliminar la tabla mientras exista una revisión de aplicación que consulte los guards.
4. Si se requiere limpieza posterior, hacerlo en una migración explícita separada.
5. Un rollback de Phase 4 nunca debe borrar ledger, refunds, payouts, audit logs ni certificaciones históricas.
