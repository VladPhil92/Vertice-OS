# CTG One → VÉRTICE Mobile Auth Contract

## Objetivo
Permitir que la misma identidad CTG One usada en VÉRTICE Web inicie sesión en VÉRTICE Mobile sin crear una cuenta separada.

## Flujo requerido
1. Mobile genera `state`, `code_verifier` y `code_challenge` (PKCE S256).
2. Mobile abre el endpoint de autorización CTG One en un navegador seguro del sistema.
3. CTG One autentica al usuario y redirige al callback universal/deep link de VÉRTICE Mobile.
4. Mobile valida `state` y entrega `code` + `code_verifier` a la API VÉRTICE.
5. API VÉRTICE valida el código con CTG One, resuelve/provisiona el vínculo de identidad y emite la sesión móvil VÉRTICE.
6. Mobile persiste únicamente tokens VÉRTICE en almacenamiento seguro.
7. `/auth/me` debe resolver al mismo `citizen_id` usado por web.

## Invariantes
- VÉRTICE Mobile nunca captura la contraseña CTG One en sus propios campos.
- Un `ctg_one_subject` no puede crear más de un `citizen_id`.
- Si existe una cuenta VÉRTICE previa con identidad verificable compatible, se debe vincular mediante flujo explícito y seguro, no duplicar.
- Logout VÉRTICE revoca la sesión VÉRTICE local; el logout global CTG One debe ser una acción separada.

## UI
`Continuar con CTG One` es la acción federada principal. Debajo se mantiene el divisor `o usa tu cuenta VÉRTICE` y el login nativo como alternativa.
