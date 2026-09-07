# Dashboard Identity Header Convergence v8

## Objetivo

Converger el encabezado del dashboard autenticado con el perfil cívico y la foto pública de la fase Identity Media, evitando crear una segunda fuente de verdad para identidad, visibilidad o verificación.

## Arquitectura

El nuevo `DashboardIdentityHeader` consume exclusivamente contratos canónicos ya existentes:

- `/community/profile/me` para nombre público, tipo de perfil, organización, territorio y visibilidad;
- `/community/profile/me/avatar` para el retrato cívico aprobado;
- `/dashboard/me` para `verification_level`, que continúa siendo la fuente de verdad de identidad verificada.

La lectura de `/dashboard/me` ocurre al mismo tiempo que otros consumidores del dashboard. La deduplicación *in-flight* introducida en v7 comparte esa promesa y evita una segunda petición HTTP concurrente.

## Experiencia

El dashboard muestra, antes de los módulos operativos:

- avatar cívico o fallback determinista;
- nombre de presentación;
- tipo de perfil cívico;
- territorio;
- organización, cuando aplica;
- estado público/privado del perfil;
- estado de identidad verificada;
- acceso directo a editar el perfil cívico;
- acceso a verificación cuando aún está pendiente.

## Invariantes de seguridad y producto

- una fotografía no equivale a identidad verificada;
- el distintivo de identidad depende únicamente de `verification_level`;
- el avatar solo se muestra cuando su estado es `approved`;
- la visibilidad pública continúa dependiendo de `public_profile`;
- no se duplican datos de perfil en almacenamiento local ni en un nuevo endpoint;
- no se incorporan señales de popularidad al score ni al estado de identidad.

## Dependencia

Esta fase está apilada sobre `feat/civic-profile-avatar-identity-media-3` y debe integrarse después de la fase Identity Media.

## Siguiente optimización sugerida

Una vez integrada esta convergencia, la siguiente fase debe consolidar el estado de identidad y perfil en un provider de sesión del dashboard para reutilizarlo en sidebar, navegación móvil y superficies internas sin nuevas lecturas por ruta, manteniendo invalidación explícita después de editar perfil o avatar.
