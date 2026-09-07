# Civic Profile Avatar Identity Media

## Scope

This phase adds public civic profile portraits without turning a profile image into an identity-proofing primitive. `verification_level` remains the source of truth for verified identity. The avatar only controls public presentation in the civic network.

## Publication policy

A person profile portrait must:

- contain one clearly visible human face;
- be recent and represent the account holder;
- use JPEG, PNG, or WebP;
- be at least 640 × 640 px;
- stay under 10 MB in the web client;
- avoid group photos, logos, illustrations, heavy filters, masks, or objects that materially cover the face.

The browser performs image-format, file-size, resolution, and—when the native `FaceDetector` API is available—single-face checks before it requests an upload session. The API requires explicit policy attestation. No face embedding, biometric template, or facial identity match is stored by this feature.

Identity verification remains a separate flow (for example, a certified identity-proofing provider such as Veriff).

## Storage architecture

The API issues Cloudflare Images direct-upload sessions. Image bytes flow from browser to Cloudflare and do not transit the VÉRTICE API process or PostgreSQL. PostgreSQL stores only the opaque asset id, delivery URL, lifecycle status, and attestation timestamps.

Required Railway/API variables to enable uploads:

```env
CLOUDFLARE_IMAGES_ACCOUNT_ID=<32-char Cloudflare account id>
CLOUDFLARE_IMAGES_API_TOKEN=<token with Cloudflare Images write/read/delete permissions>
CLOUDFLARE_IMAGES_DELIVERY_URL=https://imagedelivery.net/<account-delivery-hash>
CLOUDFLARE_IMAGES_VARIANT=public
```

All variables are optional at process boot. If the capability is not configured, the API remains healthy and profile editing still works, but avatar upload endpoints fail closed with `CIVIC_AVATAR_STORAGE_UNAVAILABLE`.

## API

Authenticated owner lifecycle:

```text
GET    /community/profile/me/avatar
POST   /community/profile/me/avatar/upload-intent
POST   /community/profile/me/avatar/confirm
DELETE /community/profile/me/avatar
```

Public batch lookup used by feed, ranking, and public profile surfaces:

```text
GET /community/avatars?ids=<uuid>,<uuid>,...
```

The public endpoint only returns records for active citizens who explicitly enabled `public_civic_profile`.

## Upload sequence

```text
select image
  -> client validation
  -> POST upload-intent
  -> direct browser upload to Cloudflare Images
  -> POST confirm + policy attestation + client quality checks
  -> provider ownership/asset confirmation
  -> approved public avatar reference
```

Replacing a photo keeps the previous approved avatar visible until the new asset is confirmed. After confirmation, the old provider asset is deleted best-effort. Removing the avatar clears the public database reference first, so privacy does not depend on provider cleanup succeeding synchronously.

## Identity semantics

Do not conflate the following states:

- **Public portrait approved:** the image passed publication/technical controls.
- **Public civic profile:** the citizen opted into public attribution.
- **Identity verified:** `verification_level >= 1`, backed by the identity subsystem.
- **Action verified:** the civic action has its own evidence/result verification state.

UI badges must label these concepts distinctly.
