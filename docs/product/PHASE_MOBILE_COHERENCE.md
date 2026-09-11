# Phase — Mobile CTG One + Visual Coherence

Esta fase establece la base transversal para que VÉRTICE Mobile y Web compartan identidad, lenguaje visual y modelo de acceso.

## Alcance entregable
1. Design tokens compartidos y adaptadores web/native.
2. Política de marca, tipografía e iconografía.
3. Contrato de autenticación federada CTG One para mobile con PKCE.
4. Golden screens y checklist de release.
5. Migración inicial de login mobile al lenguaje visual institucional.
6. Integración de `Continuar con CTG One` en mobile sobre callback/deep link seguro.

## Definition of done
- El mismo usuario CTG One resuelve al mismo `citizen_id` en web y mobile.
- Mobile utiliza los colores y tipografías institucionales.
- CTG One es visible como CTA federado principal en login mobile.
- Login nativo VÉRTICE sigue disponible.
- No se introducen colores de marca nuevos hardcodeados fuera de los adaptadores.
- La fase queda protegida por tests/parity gates antes de release.
