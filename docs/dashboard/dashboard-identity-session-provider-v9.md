# Dashboard Identity Session Provider v9

## Estado

`✅ Implementado en código · pendiente de certificación productiva tras merge`

## Objetivo

Consolidar el estado de identidad visible del dashboard en una única sesión de UI reutilizable durante la navegación autenticada. La fase evita que el encabezado, el sidebar y la navegación móvil mantengan lecturas o estados paralelos de perfil, avatar y verificación.

## Fuente de verdad

`DashboardIdentityProvider` no crea un nuevo modelo de identidad ni persiste una copia local. Compone, en memoria y durante la vida del layout autenticado, tres contratos canónicos:

- `GET /community/profile/me`: nombre público, tipo de perfil, organización, territorio y visibilidad;
- `GET /community/profile/me/avatar`: avatar cívico y estado de publicación;
- `GET /dashboard/me`: `verification_level`, que continúa siendo la única fuente de verdad para el distintivo de identidad verificada.

La capa `apiFetch` conserva deduplicación exclusivamente *in-flight*. El provider mantiene el snapshot únicamente mientras el layout del dashboard está montado; no usa `localStorage`, cookies adicionales ni una segunda API.

## Superficies convergidas

La sesión se reutiliza en:

- `DashboardIdentityHeader`;
- tarjeta compacta de identidad del sidebar;
- territorio activo del sidebar;
- avatar del encabezado móvil;
- futuras superficies internas que necesiten el mismo estado sin nuevas lecturas por ruta.

## Invalidación

Las mutaciones canónicas de perfil disparan `vertice:dashboard-identity-changed` después de una respuesta exitosa:

- `PATCH /community/profile/me`;
- `POST /community/profile/me/avatar/confirm`;
- `DELETE /community/profile/me/avatar`.

El provider escucha ese evento y vuelve a leer los tres contratos canónicos. Esto hace que un cambio de foto, visibilidad, tipo de perfil, organización o biografía se propague al resto del dashboard sin recargar la página.

La creación de una intención de carga no invalida la sesión porque todavía no cambia el avatar público.

## Invariantes

- foto de perfil ≠ identidad verificada;
- `verification_level` mantiene autoridad exclusiva sobre `identityVerified`;
- solo un avatar con `status = approved` se presenta como imagen pública;
- `public_profile` mantiene autoridad sobre la visibilidad pública;
- el provider es estado efímero de presentación, no almacenamiento canónico;
- un fallo de refresco no debe fabricar identidad ni degradar silenciosamente el nivel de verificación;
- no se crean embeddings, plantillas faciales ni biometría propia.

## Riesgos controlados

El provider preserva el último snapshot válido durante un fallo transitorio de refresco y expone el error al consumidor. En el primer fallo de carga, las superficies de identidad degradan a fallback sin bloquear la navegación operativa del dashboard.

La secuencia de requests se versiona internamente para impedir que una respuesta anterior sobrescriba un refresh más reciente.

## Criterio de cierre

La fase puede marcarse como certificada cuando:

1. CI, typecheck, lint, tests y gates del dashboard estén verdes;
2. el PR esté integrado a `main`;
3. Vercel haya desplegado el commit integrado;
4. el dashboard productivo confirme avatar/nombre/territorio coherentes entre header, sidebar y móvil;
5. una edición de perfil/avatar actualice esas superficies sin reload manual.
