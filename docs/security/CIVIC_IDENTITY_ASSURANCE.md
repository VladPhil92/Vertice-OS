# Civic Identity Assurance — VÉRTICE OS

> Estado P0 implementado · snapshot 2 de septiembre de 2026

## Objetivo

VÉRTICE separa tres conceptos que no pueden tratarse como equivalentes:

1. **Authentication** — el usuario controla una sesión VÉRTICE/CTG One aceptada.
2. **Contact verification** — el usuario controla el canal/contacto declarado.
3. **Civic identity assurance** — un proveedor independiente y aprobado realizó identity proofing suficientemente fuerte para una acción cívica protegida.

`verification_level` sigue siendo útil para onboarding/contacto, pero no prueba por sí solo que la identidad civil declarada pertenece a la persona que opera la cuenta.

---

## Contrato P0 actual

VÉRTICE reutiliza `external_identities` como punto de vinculación de proveedores externos y aplica una frontera de política adicional:

- solo providers incluidos en `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` cuentan como evidencia de assurance;
- la allowlist está vacía por defecto;
- allowlist vacía significa **fail-closed** para construir el electorado protegido;
- `ctg_one` federation no es un provider de assurance por defecto;
- el ciudadano debe cumplir también las reglas de verificación/contacto exigidas por el proceso electoral;
- `/identity/assurance` expone el estado real sin relabeling engañoso de email o cédula declarada como KYC.

---

## Assurance y padrón electoral congelado

El modelo actual protege la votación en dos momentos distintos:

### 1. Apertura de votación

Al pasar una propuesta a `voting`, VÉRTICE construye un `proposal_voter_roll` con los ciudadanos que satisfacen la política vigente de identidad cívica y alcance territorial.

Ese snapshot fija el universo electoral y, por tanto, el denominador de quórum.

### 2. Ventana de voto

Una vez congelado el padrón, la admisión de votos directos y participación delegada se realiza contra `proposal_voter_roll`.

**No se vuelve a inferir elegibilidad desde una configuración mutable de providers en cada request.**

Esto evita que:

- una modificación de allowlist cambie retroactivamente el electorado de una votación abierta;
- la revocación/configuración de un provider produzca quórums inconsistentes a mitad de proceso;
- rutas HTTP distintas apliquen políticas divergentes.

Si la propuesta está en votación y no existe padrón congelado, el sistema debe fallar cerrado.

---

## Federación CTG One

CTG One puede autenticar y federar una cuenta, pero:

```text
CTG One SSO ≠ Civic Identity Assurance
```

No se debe añadir `ctg_one` a la allowlist salvo que el operador haya auditado y certificado que el flujo concreto de CTG One realiza identity proofing suficiente para el piloto.

Login, matching de email, wallet ownership, account age o reputación no sustituyen proofing de identidad.

---

## Regla de onboarding de providers

Un provider solo puede añadirse a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` cuando la integración garantice que su evidencia externa se crea después de un resultado válido de identity proofing.

Para el piloto de Cartagena deben evaluarse al menos:

- documento oficial aplicable en Colombia;
- anti-spoofing / liveness o control equivalente cuando corresponda;
- resistencia a duplicidad de persona;
- referencia de verificación auditable;
- estados de revisión/revocación/expiración;
- minimización y retención de datos;
- cumplimiento de obligaciones colombianas de protección de datos;
- disponibilidad operativa e incident response.

---

## Delegaciones

La delegación no puede ampliar el electorado.

Un delegador solo puede aportar participación a un delegado si el delegador pertenece al padrón congelado de esa propuesta y la delegación está activa, vigente y dentro del scope aplicable.

La assurance no se hereda desde el delegado: la pertenencia al padrón ya representa la evaluación del delegador realizada al abrir la votación.

---

## Limitaciones actuales

P0 establece la frontera de confianza y la usa para congelar el electorado, pero no implica identidad productiva completa.

Pendientes de evolución:

1. integrar y certificar un provider productivo de identity proofing;
2. persistir lifecycle de assurance (`verified/revoked/expired/review`) con semántica independiente de links de federación genéricos;
3. definir política explícita de assurance para creación de propuestas, endorsements y otras acciones de alto impacto;
4. añadir revisión administrativa, revocación, reconciliación y evidencia operacional;
5. exponer onboarding accionable de assurance en el dashboard ciudadano;
6. definir tratamiento de revocaciones posteriores al snapshot para futuras votaciones sin alterar retrospectivamente elecciones ya abiertas.

---

## Invariante de seguridad

**Ningún código puede inferir civic identity assurance únicamente desde login, email, CTG One federation, cédula autodeclarada, firma de wallet, reputación o antigüedad de cuenta.**

Para votaciones abiertas, **ningún código puede sustituir el padrón congelado por una reevaluación ad hoc de providers**.
