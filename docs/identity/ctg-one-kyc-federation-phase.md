# CTG One KYC federation — identity reuse boundary

VÉRTICE reuses a CTG One KYC verification only when CTG One attests it server-to-server during the authenticated federation exchange.

The attestation raises the legacy/basic VÉRTICE verification level to 2 so the citizen is not asked to upload or re-enter identity documents already verified by CTG One. No cédula number, document URL or document image is copied into VÉRTICE.

This reuse does **not** by itself create governance-grade civic identity assurance. Voting eligibility remains governed by the proof-backed `civic_identity_proofs` boundary, operational provider ingress and provider certification/revocation controls.

Malformed attestations fail closed. Missing attestations never elevate the local verification level and do not block ordinary federated authentication.
