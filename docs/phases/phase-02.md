# Phase 02: Domain Model, Validation, and Data Store

## Objective

Implement the canonical data model and repository layer that all features must use.

## Depends On

- `docs/phases/phase-01.md`

## Scope

- Define TypeScript domain types from README requirements.
- Implement schema versioning and migration mechanism.
- Build repository layer for items and side quest catalog entries.
- Add validation rules for session format and attunement invariants.

## Deliverables

- `Item`, `MagicItemDetails`, `SideQuestCatalogEntry` types and runtime validators.
- Repository APIs for CRUD/query operations.
- Migration framework with initial version and one migration test fixture.
- Seed/factory helpers for tests.

## Implementation Tasks

1. Create `domain/` types and zod/yup-style runtime schemas.
2. Build `repositories/`:
   - item repository
   - side quest catalog repository
3. Implement validation helpers:
   - session format `<Chapter>.<Session>`
   - chapter range `1-16`
   - session range `1-6`
4. Add migration runner:
   - persisted schema version key
   - forward migration registry
5. Add repository tests covering create/read/update/delete/query and migration.

## Acceptance Criteria

- All app data reads/writes use repository APIs (no direct storage access in UI).
- Invalid session/source data is rejected or normalized deterministically.
- Schema versioning supports safe app upgrade path.

## Test Plan

- Unit tests for validators.
- Repository integration tests with in-memory or test DB adapter.
- Migration test proving old data upgrades to current schema.

## Out of Scope

- UI flows for item entry and inventory management.
- Catalog scraping/network behavior.
