# VÉRTICE Cross-platform Coherence Contract

VÉRTICE Web y VÉRTICE Mobile son dos clientes del mismo producto. Deben compartir identidad, lenguaje, permisos, capacidades y significado de estados.

## Identidad
1. CTG One es el proveedor federado preferente.
2. Una identidad CTG One debe resolver a un único `citizen_id` de VÉRTICE.
3. Web y mobile deben reutilizar el mismo vínculo de identidad; nunca crear un ciudadano nuevo por dispositivo.
4. El login nativo VÉRTICE permanece como alternativa de compatibilidad.

## Visual
- Fuente canónica: `@vertice/design-tokens`.
- Display: Montserrat; body: Inter; técnico: DM Mono; editorial: Fraunces.
- Iconos: Lucide, outlined, stroke 2px.
- No hardcodear colores institucionales dentro de screens/components.
- Assets de marca deben usar el logo, symbol y wordmark oficiales del repositorio.

## UX
- CTAs, nombres de módulos y estados deben conservar el mismo vocabulario en web y mobile.
- La arquitectura de información puede adaptarse al dispositivo, pero las capacidades core deben mapear 1:1.
- Las pantallas canónicas de paridad son: Login, Inicio, Territorio, Reportes, Reputación/Perfil y Comunidad.

## Release gate
Una release mobile no se considera coherente si falla cualquiera de estos puntos: identidad federada CTG One, tokens institucionales, tipografía, iconografía, vocabulario core o paridad de las golden screens.
