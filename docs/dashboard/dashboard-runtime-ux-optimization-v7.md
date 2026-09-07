# Dashboard Runtime & UX Optimization v7

## Objetivo

Reducir trabajo redundante en el arranque del dashboard autenticado y mejorar su arquitectura de información sin alterar los contratos funcionales de Civic Actions, evidencia, reputación, identidad o gobernanza.

## Problemas observados

1. `DashboardExperienceLayer` y `CitizenCommandCenter` consumen `/dashboard/me` de forma independiente. Esa separación aporta resiliencia, pero podía producir lecturas HTTP idénticas concurrentes durante el primer render.
2. El sidebar presentaba once destinos de primer nivel en una lista plana. El usuario debía inferir cuáles pertenecían a gestión cotidiana, participación, herramientas o cuenta.
3. Next.js podía iniciar prefetch de múltiples rutas visibles del sidebar aunque muchas fueran de baja probabilidad de uso durante la sesión actual.
4. La navegación visual no exponía `aria-current` en todos los puntos relevantes.

## Cambios

### 1. Dedupe de lecturas concurrentes

`apps/web/lib/api.ts` incorpora deduplicación *in-flight* para `GET` y `HEAD` sin body ni `AbortSignal`.

- comparte únicamente la promesa activa de una lectura idéntica;
- la clave incluye método, alcance público/autenticado y ruta;
- no persiste respuestas después de completar la petición;
- no aplica a `POST`, `PATCH`, `PUT`, `DELETE` ni otras mutaciones;
- no modifica la lógica existente de refresh token;
- mantiene fail-closed el flujo de 401.

Esto permite que superficies independientes sigan siendo resilientes sin duplicar tráfico durante el montaje concurrente.

### 2. Arquitectura de información del sidebar

La navegación de escritorio queda agrupada en:

- **Principal:** Inicio, Red cívica, Gestión social, Mapa y reportes.
- **Participación:** Iniciativas, Consultas, Control público.
- **Herramientas:** IA cívica.
- **Cuenta:** Identidad, Perfil cívico.
- **Administración:** Moderación, visible únicamente para roles autorizados.

La agrupación es únicamente de experiencia de usuario; no modifica permisos ni el modelo de roles.

### 3. Prefetch controlado

Se mantiene prefetch para las rutas de uso más frecuente:

- Inicio;
- Red cívica;
- Gestión social;
- creación de Acción cívica en navegación móvil.

Las rutas secundarias usan `prefetch={false}` para evitar cargar anticipadamente bundles de baja probabilidad durante el arranque del dashboard.

### 4. Accesibilidad

- navegación principal y móvil reciben nombres accesibles;
- la ruta activa expone `aria-current="page"`;
- se mantienen los controles existentes de menú móvil y salida.

## Certificación

`apps/web/e2e/dashboard-experience.spec.ts` añade cobertura para:

1. deduplicación de dos consumidores concurrentes de `/dashboard/me`;
2. visibilidad de las nuevas agrupaciones del sidebar;
3. exposición semántica de la ruta activa.

## Invariantes

Esta fase no cambia:

- el algoritmo de reputación;
- el principio evidence-first;
- las transiciones de Civic Actions;
- los requisitos de identidad para gobernanza;
- la separación entre tipo de perfil cívico y rol de autorización;
- los endpoints canónicos existentes.

## Siguiente fase sugerida

Una vez certificada esta optimización, el siguiente avance debe converger el encabezado de identidad del dashboard con el perfil cívico público y el avatar de la fase de Identity Media, sin introducir una segunda fuente de verdad ni hacer que una foto equivalga a identidad verificada.
