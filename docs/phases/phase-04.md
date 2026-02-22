# Phase 04: Inventory Views, Search, Filters, Attunement, Consumables

## Objective

Deliver session-time inventory usability: fast discovery, attunement controls, and consumable spend actions.

## Depends On

- `docs/phases/phase-02.md`
- `docs/phases/phase-03.md`

## Scope

- Implement primary inventory list and item cards.
- Add keyword search and source filters.
- Add quick filters: Attuned, Consumables, Needs Details.
- Enforce 3-slot attunement policy with replace-or-cancel flow.
- Implement consumable decrement and auto-remove at zero.

## Deliverables

- Inventory home screen with searchable/filterable list.
- Attunement interaction modal/sheet.
- Consumable spend action on list and detail views.
- Persisted view preferences (optional).

## Implementation Tasks

1. Build list rendering optimized for mobile scrolling performance.
2. Implement query controls:
   - keyword search
   - source filter
   - status filters (attuned/consumable/incomplete)
3. Add attunement actions:
   - attune when slots available
   - if full, show picker to unattune one item or cancel
4. Add consumable actions:
   - decrement quantity by 1
   - remove record at 0
5. Add clear visual cues for attunement and consumable quantity.

## Acceptance Criteria

- User can find an item quickly by keyword and source.
- App never allows >3 simultaneously attuned items.
- Consumable spend is one tap from list and zero quantity removes item.

## Test Plan

- Unit tests for attunement slot enforcement logic.
- Unit tests for consumable decrement/removal behavior.
- E2E tests for search/filter flows and attunement replacement flow.

## Out of Scope

- Side quest catalog refresh/scraping.
- Import/export.
