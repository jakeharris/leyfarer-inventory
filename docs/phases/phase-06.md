# Phase 06: Backup, Restore, and One-Way QR Transfer

## Objective

Enable safe data portability between devices without cloud sync.

## Depends On

- `docs/phases/phase-02.md`

## Scope

- JSON export/import for full inventory + catalog dataset.
- One-way QR export/import flow for manual transfer between devices.
- Import conflict behavior for one-way sync (replace or merge policy, documented and deterministic).

## Deliverables

- `Export JSON` action producing versioned payload.
- `Import JSON` action with validation and migration.
- `Show QR` export view and `Scan QR` import flow.
- Data portability docs in-app (short guidance text).

## Implementation Tasks

1. Define portable payload schema with explicit `schemaVersion`.
2. Implement full export from repositories.
3. Implement import path:
   - validate payload
   - migrate if old version
   - apply deterministic write strategy
4. Implement QR encoding/decoding:
   - chunking/compression if payload exceeds QR size
   - robust error messaging on failed scan
5. Add confirmation guardrails before destructive import operations.

## Acceptance Criteria

- Exported JSON can restore complete app state on a fresh install.
- QR transfer works for realistic dataset size (~25-100 items) with clear UX.
- Import cannot corrupt existing data silently; failures are explicit.

## Test Plan

- Round-trip tests for JSON export/import equivalence.
- Migration tests with older payload versions.
- E2E transfer test using fixture payloads for QR encode/decode path.

## Out of Scope

- Automatic background sync.
- Multi-device conflict resolution beyond defined one-way policy.
