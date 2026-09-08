# Dashboard Phase 5 — Command Center v2

## Objetivo

Transformar la portada autenticada de VÉRTICE desde una suma de bloques independientes hacia una única jerarquía operacional. La página debe responder, en este orden, tres preguntas:

1. ¿Qué tengo que hacer ahora?
2. ¿Qué está ocurriendo con mis gestiones?
3. ¿Qué está ocurriendo a mi alrededor?

La Phase 5 se apoya en el runtime compartido introducido en Phase 4 y no crea nuevas lecturas paralelas de `/dashboard/me`.

## Arquitectura de portada

`apps/web/app/dashboard/page.tsx` monta únicamente `DashboardCommandCenterV2`.

El Command Center v2 consume `useDashboardRuntime()` y compone:

- identidad cívica compacta;
- siguiente mejor acción;
- acciones rápidas;
- centro de pendientes;
- señales de gestión y reputación;
- plan de resolución transaccional existente;
- gestiones en seguimiento;
- snapshot territorial;
- actividad unificada reciente.

Los componentes históricos `DashboardIdentityHeader`, `DashboardExperienceLayer` y `CitizenCommandCenterRuntime` dejan de formar parte de la portada. Se conservan temporalmente en el repositorio para evitar eliminar superficies antes de comprobar referencias externas y para permitir una retirada posterior controlada.

## Siguiente mejor acción

La portada deriva una única acción dominante utilizando información ya disponible en el runtime. La prioridad es:

1. verificación básica pendiente;
2. acciones incluidas en el plan de resolución;
3. acciones sin evidencia suficiente;
4. consultas pendientes;
5. control público pendiente;
6. reportes en seguimiento;
7. perfil cívico incompleto;
8. creación de una nueva acción cívica cuando no hay pendientes.

El objetivo no es crear una puntuación opaca sino ordenar obligaciones operativas explícitas. La lógica permanece determinista y puede auditarse desde el cliente.

## Gestión y evidencia

El plan de resolución existente se mantiene dentro de la jerarquía v2 porque contiene mutaciones de negocio ya certificadas:

- reabrir una acción en ejecución;
- declarar un resultado observable;
- redirigir a evidencia compleja dentro del workspace trazable.

La simplificación de interfaz no elimina capacidades ni mueve cargas de evidencia compleja a componentes rápidos sin trazabilidad.

## Actividad unificada

La primera versión de actividad combina los objetos que ya forman parte del contrato de `/dashboard/me`:

- acciones cívicas recientes;
- reportes territoriales recientes;
- propuestas recientes.

Se ordenan por fecha y se muestran como historial operativo. La Phase 6 deberá ampliar este modelo hacia un Civic Inbox y una actividad persistente con eventos de voto, endorsement, verificación, workflows y cambios de estado.

## Territorio

El snapshot territorial introduce contexto dentro de la portada sin obligar al usuario a abrir el módulo de mapa:

- territorio del usuario;
- total de reportes de ciudad;
- reportes resueltos;
- consultas en votación;
- reportes propios en gestión.

No sustituye el mapa ni la inteligencia territorial profunda prevista para Phase 7.

## Browser release contract

`apps/web/e2e/dashboard-command-center-v2.spec.ts` verifica:

- que existe una sola jerarquía Command Center v2;
- que los macrocomponentes históricos ya no se montan;
- que se presentan siguiente mejor acción, pendientes, gestión, territorio y actividad;
- que el plan de resolución continúa disponible;
- que cuando no existen pendientes la acción dominante vuelve a creación de acción cívica.

El Dashboard Browser Release Gate ejecuta este contrato junto con las pruebas existentes de dashboard, runtime, media, avatar y resiliencia.

## Criterios de salida

Phase 5 se considera lista para merge cuando:

- build de producción del frontend finaliza sin errores;
- el browser contract completo está verde;
- `/dashboard/me` continúa convergiendo en una lectura efectiva por montaje;
- el plan de resolución mantiene sus mutaciones existentes;
- no se reintroducen los macrocomponentes históricos en `dashboard/page.tsx`;
- el preview de despliegue no presenta regresiones críticas.

## Fase siguiente

Phase 6 — Civic Inbox + Unified Activity:

- sustituir notificaciones pasivas por una bandeja accionable;
- converger polling y eventos server-sent;
- priorizar acciones que requieren intervención;
- convertir actividad reciente en historial cívico persistente y verificable.
