# Phase 7G.2 release evidence boundary

Risk class: **R3**.

Candidate evidence must prove, on the exact PR SHA:

- TypeScript/Python lint and typecheck;
- API tests and coverage thresholds without exclusions;
- Golden PostgreSQL migration application;
- current identity + fresh residence eligibility before freeze;
- exact identity/residence provenance in the frozen voter roll;
- frozen-electorate authority after voting opens;
- existing delegation and vote-ledger invariants;
- security, SAST, Railway/runtime and browser contracts.

A green PR establishes `INTEGRATED` eligibility contracts only after merge. It does not establish `DEPLOYED`, `READY` or `CERTIFIED` production election status.
