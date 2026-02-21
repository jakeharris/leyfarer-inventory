# Phase 07: PDF Card Export (8.5 x 11)

## Objective

Generate printable card-style inventory pages that can be appended to the existing character sheet.

## Depends On

- `docs/phases/phase-03.md`
- `docs/phases/phase-04.md`

## Scope

- Implement 8.5"x11" PDF export in card layout.
- Include key fields for at-table readability.
- Support multi-page output for larger inventories.

## Deliverables

- `Export PDF` action.
- Styled card template for item summaries.
- Pagination rules and print-safe margins.
- Optional filters for export set (all, attuned only, consumables only, by source).

## Implementation Tasks

1. Define card template sections:
   - name/type/source
   - magic metadata (rarity, attunement, charges/uses)
   - highlighted saves/spells
   - notes/tags
2. Implement print stylesheet or PDF rendering pipeline.
3. Add pagination logic for consistent card placement across pages.
4. Ensure output dimensions exactly map to US Letter (8.5"x11").
5. Validate mobile-triggered export flow on iPad/iPhone browsers.

## Acceptance Criteria

- Generated PDF is US Letter with predictable margins and readable text.
- Multi-page exports preserve formatting and do not clip content.
- Export content reflects current inventory state and selected filters.

## Test Plan

- Snapshot/regression tests for PDF layout templates.
- Manual print-preview checks in Safari on iPad and desktop browser.
- Fixture-based tests for long text and high-card-count edge cases.

## Out of Scope

- Direct editing inside exported PDFs.
- Procreate-specific import automation.
