# Phase 03: Item Entry UX (Freeform + Magic Details)

## Objective

Deliver fast add/edit item workflows, including incomplete magic-item handling.

## Depends On

- `docs/phases/phase-01.md`
- `docs/phases/phase-02.md`

## Scope

- Build add/edit item forms.
- Support both non-magic and magic item paths.
- Enforce `name` required; allow optional description/source.
- Implement `Needs Details` status for incomplete magic items.

## Deliverables

- Quick-add screen for freeform item creation.
- Magic item detail form with optional deferred completion.
- Edit screen for updating any item fields.
- Visual status badge/filter hook for incomplete magic items.

## Implementation Tasks

1. Build `Add Item` flow:
   - required: name
   - optional: source + description
   - toggle `Magic Item`
2. If `Magic Item` enabled:
   - prompt rarity, attunement, charges, uses/day, save/spells, tags/notes
   - allow save with partial data
3. Compute and persist `isComplete` based on minimum magic completeness policy.
4. Build item detail/edit screens for patch updates.
5. Add input ergonomics for iPad/iPhone:
   - large touch targets
   - minimal keyboard churn
   - sensible defaults

## Acceptance Criteria

- Non-magic item can be created in under 3 required inputs.
- Magic item can be saved without all optional fields and shows `Needs Details`.
- Existing items can be edited without data loss.

## Test Plan

- Component tests for conditional magic form fields.
- Unit tests for completeness computation.
- E2E test: create non-magic, create incomplete magic, reopen app, verify persistence.

## Out of Scope

- Side quest catalog ingestion.
- Search/filter list behaviors and attunement slot logic.
