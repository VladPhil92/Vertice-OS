# VÉRTICE Product Language Contract

Status: **normative** for web and native clients.

VÉRTICE is one product with multiple clients. `apps/web` and `apps/mobile` may adapt layout and interaction to their platform, but they MUST share identity semantics, product vocabulary, visual language and capability meaning.

## 1. Identity and authentication

CTG One is the preferred ecosystem identity entry point. A citizen who already uses VÉRTICE through CTG One on the web MUST NOT be required to create a separate mobile account.

Canonical model:

`CTG One subject -> VÉRTICE federation link -> citizen_id -> web/mobile sessions`

Native federation uses the same CTG One federation exchange and the same VÉRTICE citizen/session services as web. Native refresh tokens are stored only in the OS-backed secure store. VÉRTICE never embeds or collects the citizen's CTG One password.

Native email/password remains a compatibility option. A matching email alone MUST NOT silently merge identities; an existing unlinked native identity requires an explicit secure linking flow.

## 2. Color system

The canonical colors are defined by the web tokens and mirrored by `apps/mobile/theme/vertice.ts`.

| Role | Value |
| --- | --- |
| Background | `#F7F9FC` |
| Surface | `#FFFFFF` |
| Secondary surface | `#F0F4F9` |
| Border | `#E1E7EF` |
| VÉRTICE Navy | `#0A2A66` |
| Navy light | `#163F86` |
| Citizen / Gold | `#F5B700` |
| Civic red | `#D72638` |
| Azure | `#4A90E2` |
| Emerald | `#2BA745` |
| Cyan | `#178C8C` |
| Primary text | `#0A2A66` |
| Secondary text | `#4B5870` |
| Tertiary text | `#7B8799` |

Module colors are also shared: mobility/azure, water/cyan, security/red, health/emerald, education/gold, services/purple, culture/orange, economy/navy.

Product screens MUST use semantic tokens instead of inventing brand colors locally. The former beige/green mobile identity (`#F6F4EE`, `#1C3D2E`, `#24573E`) is retired.

## 3. Typography

Canonical family roles:

- **Montserrat**: display, major headings, product identity.
- **Inter**: body, labels, buttons, forms and navigation.
- **DM Mono**: identifiers, machine-readable values and technical readouts.
- **Fraunces**: editorial/expressive web moments only; never default application chrome.

Native semantic sizes, weights and line heights live in `apps/mobile/theme/vertice.ts`. Until the exact Montserrat/Inter font binaries are shipped in the signed native bundle, native uses platform-safe fallbacks while preserving the same hierarchy. A release that bundles the exact families must do so centrally, not screen by screen.

## 4. Iconography

The VÉRTICE icon grammar is **Lucide-style outline**:

- 24 px base grid.
- 2 px default stroke.
- Round caps and joins.
- Compact 16 px, standard 20 px, navigation 22 px, feature 24 px.
- No emoji as navigation icons.
- No arbitrary filled icon families mixed with outline icons.
- Color follows semantic context; navigation active state uses VÉRTICE Navy.

Web already uses Lucide. Native components must follow the same grammar and should adopt the compatible Lucide native implementation when the dependency is promoted into the mobile lockfile.

## 5. Brand imagery

Canonical assets originate from VÉRTICE brand sources and must preserve aspect ratio and clear space:

- `vertice-wordmark.webp`
- `vertice-symbol.webp`
- `vertice-logo.png`
- civic network / territorial illustrations where the platform supports them

The mobile copies under `apps/mobile/assets/brand/` are binary-identical to the canonical web assets. Screens use `VerticeBrand`; they do not create text-only approximations of the logo.

Images are functional brand assets, not decorative noise. Authentication, onboarding, empty states and public product surfaces may use them when they improve hierarchy or context. Dense operational screens should favor information clarity over illustration.

## 6. Components and interaction

Common semantics apply even when web and native implementations differ:

- Primary action: VÉRTICE Navy background, white text.
- Citizen/accent action: Gold where civic participation needs emphasis.
- Error: civic red semantic treatment.
- Cards: white surface, subtle border, restrained navy-tinted elevation.
- Inputs: white surface, semantic border, clear focus/error state.
- Minimum touch target: 44 px.
- Standard native button/input height: 52 px.
- Rounded geometry: 12–24 px according to hierarchy.

Web hover states may not exist on native; native press/gesture feedback may not exist on web. This is platform adaptation, not product divergence.

## 7. Product vocabulary

Core nouns and navigation labels keep the same meaning across clients: **Inicio, Comunidad, Acciones, Territorio, Reportes, Gobernanza, Reputación, Perfil, Identidad, Propuestas, Notificaciones, Crowdfunding**.

A capability may have platform-specific placement, but its data model, permission meaning and status vocabulary must remain consistent.

## 8. Authentication hierarchy

Authentication surfaces use this order:

1. `Continuar con CTG One` — preferred ecosystem identity.
2. Divider: `O usa tu cuenta VÉRTICE`.
3. Native VÉRTICE email/password compatibility flow.
4. Registration/recovery secondary actions.

Registration must explicitly tell an existing CTG One user not to create a duplicate account.

## 9. Release gate

`apps/mobile/scripts/verify-product-parity.mjs` is a release contract. It verifies:

- canonical palette and typography declarations;
- iconography policy;
- presence of canonical brand assets;
- removal of legacy mobile colors from core auth/navigation surfaces;
- CTG One as a mobile auth capability;
- native callback registration;
- one-time PKCE/BFF handoff;
- web-to-native callback relay;
- reuse of canonical federation/session services.

The `Mobile Core Parity` workflow runs this gate whenever mobile, federation API or CTG One web callback code changes.

## 10. Non-negotiable rules

Do not create separate citizen identities for web and mobile. Do not accept CTG One passwords inside VÉRTICE. Do not silently link accounts using email alone. Do not introduce new brand colors inside individual screens. Do not substitute the official brand assets with ad-hoc wordmarks. Do not mix icon families without a design-system decision. Do not treat visual parity as pixel identity: platform-native layout is allowed, semantic divergence is not.
