# Phase 05: Side Quest Catalog Sync and Reward Entry Flow

## Objective

Implement automated side quest catalog ingestion with robust manual fallback, then use that catalog in item entry.

## Depends On

- `docs/phases/phase-01.md`
- `docs/phases/phase-02.md`

## Scope

- Add catalog sync service for TPK sources listed in README/AGENTS.
- Normalize and de-duplicate side quest entries.
- Persist sync status + last refresh timestamp.
- Provide manual add/edit for catalog entries.
- Add side quest reward entry flow that creates inventory items.

## Deliverables

- Catalog sync module with parser adapters per source URL.
- UI action: `Refresh Catalog` with success/error/stale status.
- Catalog management UI for manual fallback edits.
- Reward entry flow from selected side quest into item creation.

## Implementation Tasks

1. Build fetch pipeline with source-specific parsers and shared normalizer.
2. Implement resilient parsing (favor text heuristics over fragile selectors).
3. Merge fetched data with manual entries, preserving manual changes.
4. Add catalog UI:
   - list entries
   - source indicator (`fetched/manual/stale`)
   - manual create/edit
5. Integrate catalog into add-item flow:
   - select side quest source
   - enter reward item(s)
6. Record refresh metadata and surface it to user.

## Acceptance Criteria

- Catalog can be refreshed from configured sources when reachable.
- Manual entry path remains fully functional if fetch/parsing fails.
- Side quest reward flow creates standard `Item` records in canonical model.

## Test Plan

- Parser unit tests with fixed HTML fixtures for each source.
- Integration tests for dedupe + merge rules.
- E2E test: failed sync scenario still allows manual catalog and reward entry.

## Out of Scope

- Bidirectional cloud sync.
- Advanced scraping scheduler beyond user-triggered refresh.
