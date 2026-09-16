# Google Play — ficha de tienda y formularios (borrador)

> Generado a partir del comportamiento real del código en esta fecha. Los textos legales/de cumplimiento (política de privacidad, Data Safety, clasificación de contenido) son un **borrador técnico** que debe pasar por revisión legal/compliance del negocio antes de enviarse — ver la regla del repositorio de no declarar como certificado algo que solo compila o existe en código.

## Qué ya está listo

| Ítem | Estado | Dónde |
|---|---|---|
| Ícono 512×512 | ✅ generado | `docs/product/store-assets/google-play/icon-512.png` |
| Feature graphic 1024×500 | ✅ generado | `docs/product/store-assets/google-play/feature-graphic-1024x500.png` |
| Política de privacidad pública (sin login) | ✅ implementada | `apps/web/app/privacy-policy/page.tsx` → se publica en `https://<dominio-web>/privacy-policy` |
| Recurso público de eliminación de cuenta | ✅ ya existía | `/account-deletion` |
| Descripción corta/larga | ✅ borrador abajo | — |
| Borrador de Data Safety | ✅ borrador abajo | — |
| Clasificación de contenido recomendada | ✅ borrador abajo | — |
| Capturas de pantalla del teléfono | ⛔ pendiente | requiere un build firmado o un simulador corriendo la app real |
| Cuenta de servicio de Google Play (API) | ⛔ pendiente | la crea el operador en Play Console |
| Firma de la app (Play App Signing) | ⛔ pendiente | decisión de propiedad del operador |

## Ficha de la tienda

**Nombre de la app:** Vértice OS

**Categoría sugerida:** Gobierno (o Social, si Google restringe "Gobierno" a entidades públicas verificadas — confirmar en Play Console al crear la ficha).

**Descripción corta (máx. 80 caracteres):**

```
Reporta, participa y sigue la gestión cívica de tu ciudad en Colombia.
```

**Descripción larga (máx. 4000 caracteres):**

```
VÉRTICE OS es la plataforma cívica de CTG One para participar activamente en tu municipio colombiano.

Con VÉRTICE puedes:
• Reportar incidentes en tu territorio con ubicación GPS y evidencia fotográfica.
• Seguir el expediente de tu reporte: análisis, propuesta, deliberación y control público.
• Participar en propuestas de gobernanza cívica de tu comunidad.
• Seguir a otros ciudadanos, ver un feed público y construir reputación basada en evidencia — nunca en dinero, seguidores o popularidad.
• Crear tu propia campaña de recaudo comunitario (el cobro de aportes llega en octubre de 2026, mientras se certifican los proveedores de pago).
• Gestionar tu identidad cívica y tu perfil desde un único lugar.

VÉRTICE separa claramente autenticación, verificación de contacto e identidad cívica asegurada: iniciar sesión o tener buena reputación no te da por sí solo autoridad de voto. Tus datos de reportes y evidencia nunca se usan para inferir tu sentido de voto.

Puedes eliminar tu cuenta de forma irreversible en cualquier momento desde la app, sin contactar soporte.

VÉRTICE OS es un producto de CTG One Corporation.
```

## Borrador de Data Safety (formulario de seguridad de los datos)

Basado en lo que el código realmente recolecta hoy (`apps/api/prisma/schema.prisma`, `apps/mobile/app.json`, módulo de notificaciones):

| Categoría de dato | ¿Se recolecta? | ¿Se comparte con terceros? | Propósito declarado |
|---|---|---|---|
| Ubicación precisa (GPS) | Sí, solo al crear un reporte | No | Funcionalidad de la app (georreferenciar el reporte) |
| Fotos/videos | Sí, opcional (evidencia de reporte, foto de perfil) | Sí — Cloudflare Images (almacenamiento) | Funcionalidad de la app |
| Correo electrónico | Sí | No (salvo CTG One, si el usuario vincula esa cuenta) | Cuenta/autenticación |
| Contraseña | Sí (solo hash) | No | Autenticación |
| Identificador de documento (cédula) | Sí (solo hash irreversible) | No | Prevención de duplicados/identidad |
| Nombre | Sí (nombre a mostrar, autodeclarado) | No | Perfil público |
| Identificadores de dispositivo/publicidad | Sí — token de push Expo (`mobile_push_devices`), solo si el usuario activa notificaciones; no es un identificador de publicidad | Sí — Expo/Google/Apple (entrega técnica de la notificación) | Funcionalidad de la app |
| Información de app activity (interacciones) | Parcial (reportes, propuestas, follows — no analítica de terceros) | No | Funcionalidad de la app |
| Dirección IP / user-agent de sesión | Sí — se guarda en el registro de cada sesión (`sessions`); no se purga automáticamente al expirar/revocar | No | Seguridad y prevención de fraude |
| Datos financieros | No todavía (crear campaña no mueve dinero; el cobro no está activo) | No | — |

Declaraciones sugeridas:
- **¿La app recopila o comparte alguno de los tipos de datos requeridos?** Sí.
- **¿Los datos se cifran en tránsito?** Sí (HTTPS).
- **¿Puede el usuario solicitar que se elimine su información?** Sí — flujo de autoservicio en la propia app, sin pasar por soporte.
- **¿Esta app sigue la Política de Familias?** No aplica / dirigida a adultos y mayores de edad legal para participación cívica (confirmar edad mínima con el negocio).

## Clasificación de contenido (IARC) — respuestas recomendadas

- Violencia: Ninguna (contenido generado por usuarios se modera; no hay violencia representada por la app misma).
- Contenido sexual: Ninguno.
- Lenguaje ofensivo: Ninguno provisto por la app; existe contenido generado por usuarios con moderación (Trust & Safety) — declarar "contenido generado por el usuario con moderación".
- Sustancias controladas: Ninguna.
- Juego con dinero real / simulado: Ninguno (el crowdfunding no procesa dinero real todavía).
- Interacción entre usuarios: Sí (feed público, follow/unfollow, comentarios de reportes) → declarar controles de moderación/bloqueo/reporte ya implementados.
- Compartir ubicación: Sí, con el propio reporte, no en tiempo real con otros usuarios.

## Pendiente que requiere tu decisión de negocio (no técnico)

1. Confirmar `privacidad@ctgone.com` como buzón real y monitoreado, o reemplazarlo por el correo de contacto de privacidad correcto (`apps/web/app/privacy-policy/page.tsx`).
2. Edad mínima declarada para usar VÉRTICE (afecta la clasificación de contenido y el formulario de audiencia objetivo).
3. Confirmar si "Gobierno" es la categoría correcta o si Google exige verificación adicional por tratarse de participación cívica/gubernamental — si la exige, "Social" o "Noticias y revistas" son alternativas seguras mientras se resuelve esa verificación.
4. Revisión legal/compliance del texto completo de la política de privacidad antes de considerarla definitiva.
