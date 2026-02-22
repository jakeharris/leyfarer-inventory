# Phase 07: Hardening, Performance, and Release Readiness

## Objective

Stabilize V1 with migration safety, mobile performance, and complete acceptance coverage.

## Depends On

- `docs/phases/phase-01.md`
- `docs/phases/phase-02.md`
- `docs/phases/phase-03.md`
- `docs/phases/phase-04.md`
- `docs/phases/phase-05.md`
- `docs/phases/phase-06.md`

## Scope

- End-to-end validation across all core flows.
- Performance tuning for iPad/iPhone interaction speed.
- Error handling and UX polish for failure cases.
- Documentation updates and release checklist.

## Deliverables

- Full test suite passing (unit/integration/e2e).
- Performance pass on list rendering, form interactions, and exports.
- Finalized user-facing error/empty/loading states.
- Release checklist and known limitations section.

## Completion Notes

- Added end-to-end coverage for:
  - quick add + incomplete magic save + later completion via edit
  - consumable spend-to-zero removal
  - attunement replace flow
  - side quest catalog refresh/manual fallback + reward creation
  - QR transfer import/export path
- Hardened persisted data reads:
  - invalid/corrupt `items` entries are dropped
  - invalid/corrupt side quest catalog entries are dropped
  - attunement overflow in stored data is repaired to max 3 attuned items
  - invalid sync metadata is reset to idle defaults
- Added migration safety tests for:
  - persisted schema newer than app schema
  - missing migration path
- Updated README with release checklist and known limitations.

## Implementation Tasks

1. Build end-to-end scenarios:
   - add freeform and magic items
   - mark incomplete and complete later
   - attunement limit enforcement
   - consumable spend-to-zero
   - side quest sync + manual fallback
   - JSON/QR portability
2. Profile and optimize mobile-critical paths.
3. Add defensive handling for partial/corrupt stored payloads.
4. Verify migration safety across version transitions.
5. Update README implementation status and operational notes.

## Acceptance Criteria

- No P0/P1 defects in core user flows.
- Data durability validated across refresh, reinstall restore, and version migration.
- Session-time interactions remain responsive on iPad/iPhone targets.

## Test Plan

- Full regression matrix using realistic dataset sizes.
- Cross-browser checks (Safari iOS priority).
- Manual QA checklist run before release tag.

## Out of Scope

- New feature expansion not required for V1.
