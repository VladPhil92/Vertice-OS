# CTG One ↔ VÉRTICE OS

> Integración federada actual · snapshot 2 de septiembre de 2026

## 1. Orígenes canónicos

- CTG One: `https://ctgone.com`
- VÉRTICE OS: `https://vertice.ctgone.com`

VÉRTICE es una aplicación conectada al ecosistema CTG One, pero conserva despliegue, sesión, observabilidad y ciclo de release propios.

---

## 2. Estado actual

La integración ya superó la fase puramente navegacional. El punto de entrada de VÉRTICE expone `Continuar con CTG One` y reutiliza el flujo federado existente.

Flujo conceptual:

```text
VÉRTICE /auth/login
   ↓
/auth/ctgone/start
   ↓
CTG One authorization / federation
   ↓
/auth/ctgone/callback
   ↓
server-side validation
   ↓
/auth/ctgone/exchange
   ↓
sesión propia de VÉRTICE
```

El mismo entrypoint sirve para:

- iniciar sesión en una cuenta VÉRTICE ya vinculada;
- crear/vincular una cuenta VÉRTICE en el primer acceso cuando el contrato lo permite.

El login local por correo/contraseña permanece disponible como alternativa.

---

## 3. Límites de seguridad

### VÉRTICE mantiene sesión propia

La federación no significa compartir sesión de navegador entre subdominios.

No:

- establecer cookies de auth con `Domain=.ctgone.com` únicamente para compartir sesión;
- copiar access tokens en query strings o URL fragments;
- intentar leer `localStorage` de otra aplicación;
- considerar el dominio padre compartido como prueba de identidad;
- exponer secretos de federación al browser.

### No vinculación por email

Una coincidencia de correo entre CTG One y una cuenta local VÉRTICE **no** es suficiente para enlazar identidades automáticamente.

Ante colisión con una cuenta local, el sistema debe exigir evidencia explícita del flujo de vinculación definido por auth.

---

## 4. Federación ≠ civic identity assurance

Este es un invariante crítico.

Una sesión CTG One demuestra que el usuario controla una identidad/sesión aceptada por CTG One. No demuestra por sí sola que exista proofing fuerte suficiente para acciones de gobernanza protegida.

Por tanto:

```text
CTG One authentication
        ≠
email/contact verification
        ≠
civic identity assurance
```

El provider federado persistido como `ctg_one` no debe añadirse automáticamente a `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`.

Solo podría convertirse en provider de assurance después de una auditoría explícita que confirme un proceso de identity proofing compatible con la política cívica de VÉRTICE.

---

## 5. Bootstrap del superadmin

CTG One también funciona como autoridad externa controlada para el **bootstrap inicial** del root superadmin de VÉRTICE.

Esto no implica que CTG One administre permanentemente los roles de VÉRTICE.

Contrato:

1. el primer superadmin puede bootstrappearse mediante evidencia federada server-managed prevista por VÉRTICE;
2. una vez existe la autoridad raíz, nuevos grants `superadmin` se conceden desde VÉRTICE;
3. el root identifier no debe codificarse públicamente ni derivarse del email;
4. el último superadmin no puede eliminarse;
5. bootstrap, grants y cambios de rol generan auditoría.

Una cuenta CTG One normal nunca debe obtener privilegios administrativos simplemente por federarse.

---

## 6. Responsabilidades por sistema

### CTG One

- autenticar dentro de su propio dominio;
- producir la evidencia/assertion federada acordada;
- mantener sus secretos y credenciales fuera de VÉRTICE cliente;
- actuar como autoridad de bootstrap únicamente donde el contrato server-side lo autoriza.

### VÉRTICE

- validar issuer/audience/expiry/state/nonce según el protocolo vigente;
- mapear el subject externo sin usar email como identidad canónica;
- crear su propia sesión;
- persistir vínculo externo/audit evidence;
- mantener grants y `active_role` en su propia autoridad;
- aplicar su propia política de civic identity assurance.

---

## 7. Fallos que deben cerrarse de forma segura

El intercambio debe fallar sin crear sesión privilegiada cuando ocurra cualquiera de estos casos:

- state/nonce inválido;
- assertion expirada;
- issuer o audience incorrectos;
- subject ausente/no válido;
- secreto o firma inválidos;
- colisión con cuenta local no resuelta;
- intento de elevar rol a partir de datos federados no autorizados.

La disponibilidad temporal de CTG One no debe transformar errores de federación en bypass de autenticación local o de autorización.

---

## 8. Producción

La integración debe evaluarse por separado en cuatro capas:

1. **UI:** CTA y redirección correctos;
2. **protocolo:** intercambio federado válido;
3. **cuenta:** linkage consistente y sin colisiones inseguras;
4. **sesión/autoridad:** sesión VÉRTICE emitida con grants correctos.

No marcar la integración como “completa” basándose únicamente en que la redirección vuelve a VÉRTICE.

---

## 9. Referencias internas

- `apps/api/src/modules/auth/`
- `apps/web/app/auth/`
- `docs/security/CIVIC_IDENTITY_ASSURANCE.md`
- `docs/CURRENT_STATE.md`
- `docs/architecture/ARCHITECTURE.md`
