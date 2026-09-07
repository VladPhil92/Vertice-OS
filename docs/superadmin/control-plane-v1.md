# Superadmin Control Plane v1

## Objetivo

Convertir el rol `superadmin` en un plano de control explícito para VÉRTICE, separado de la moderación cotidiana y de la experiencia ciudadana.

El Superadmin administra autoridad, operación y observabilidad de la plataforma. No administra la verdad histórica registrada por VÉRTICE.

## Superficie

`/dashboard/authority` pasa a ser **Control VÉRTICE** y se divide en cuatro dominios:

1. **Centro de control**: estado agregado de cuentas, roles privilegiados, sesiones, reportes, propuestas y auditoría.
2. **Usuarios y autoridad**: búsqueda de ciudadanos y concesión/revocación de `moderator`, `admin` y `superadmin`.
3. **Auditoría**: lectura del registro administrativo append-only con actor, acción, objetivo, resultado, motivo y fecha.
4. **Estado del sistema**: lectura de `/health/ready` para dependencias y capacidades sin revelar secretos.

## API

### `GET /superadmin/overview`

Protegido por `requireSuperadmin`.

Expone únicamente métricas agregadas:

- ciudadanos totales, activos y verificados;
- moderadores, administradores y superadmins vigentes;
- sesiones privilegiadas activas;
- reportes abiertos/en gestión;
- propuestas activas/en votación;
- eventos de auditoría de las últimas 24 horas;
- guardrails del plano de autoridad.

### `GET /superadmin/audit?limit=30`

Protegido por `requireSuperadmin`.

Devuelve hasta 100 eventos recientes del `admin_audit_log`. No existe endpoint de modificación o eliminación de auditoría.

## Guardrails

La interfaz declara y el backend conserva estos límites:

- el último Superadmin no puede ser removido;
- el registro administrativo es append-only desde la aplicación;
- el plano Superadmin no expone mutación de votos;
- el plano Superadmin no expone un override manual de identidad verificada;
- cambiar roles sigue siendo una operación auditada y server-authorized;
- las credenciales, tokens, secretos y API keys nunca se muestran en el dashboard.

## Relación con roles inferiores

- `moderator`: modera contenido, reportes y conflictos dentro de las capacidades autorizadas;
- `admin`: administra operaciones y puede ejecutar capacidades administrativas autorizadas;
- `superadmin`: administra autoridad raíz y supervisa la plataforma completa.

El Superadmin hereda endpoints protegidos por `requireAdmin` y `requireModerator`, pero las funciones de autoridad raíz permanecen detrás de `requireSuperadmin`.

## Operaciones existentes enlazadas

Control VÉRTICE enlaza, pero no duplica:

- `/dashboard/admin` para moderación;
- `/dashboard/admin/pilot` para operación del piloto Cartagena;
- `/auth/role-admin/*` para concesiones de autoridad;
- `/health/ready` para observabilidad de runtime.

## Fuera de alcance de v1

Esta fase no crea todavía:

- administración territorial jerárquica país/departamento/municipio/localidad/barrio;
- revocación interactiva de sesiones privilegiadas;
- feature flags editables;
- panel de incidentes de seguridad;
- dual-control para operaciones críticas;
- administración del proveedor de identidad.

Esas capacidades deben incorporarse en fases posteriores sin convertir el Superadmin en una autoridad capaz de reescribir evidencia, votos o historial.
