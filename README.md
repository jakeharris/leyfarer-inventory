# Leyfarer Inventory

Web app for managing Mocha's inventory in *The Leyfarer's Chronicle* (2024 5E), designed for fast use on iPad and iPhone.

## Goals

- Replace cramped character-sheet inventory space with a readable, structured inventory.
- Support two input modes:
  - Side-quest flow: select quest, record reward(s), create items.
  - Freeform flow: add any item quickly, then enrich later.
- Keep app data as source of truth.
- Store data locally on-device.
- Allow manual cross-device transfer by QR code (one-way export/import).

## Product Decisions (Locked for V1)

- Platform: React + TypeScript + Vite + PWA, usable in iPad/iPhone Safari.
- Storage: local-only (IndexedDB/local storage), no mandatory cloud backend.
- Sync: one-way QR transfer (export on device A, import on device B).
- Side quest catalog: developer-generated local snapshot from TPK pages with manual fallback in-app.
- Attunement: max 3 slots; if full, attuning prompts replace-one-or-cancel.
- Consumables: stack quantity model; quantity reaching 0 removes item.
- Incomplete magic items: explicit `Needs Details` badge and filter.
- V1 includes automation/scraping support (not deferred).

## Core User Flows

1. Add Item (Quick)

- Enter `name` (required), `source` (quest or session), optional `description`.
- Toggle `Magic Item`.
- If not magic: save immediately.
- If magic: prompt for magic fields, but allow skip-and-save as incomplete.

1. Add Item From Side Quest

- Pick known quest from catalog.
- Select reward(s) received.
- Save item entries in the unified item model.

1. Session Use

- Fast views for:
  - Attuned items
  - Consumables
  - Source filter (quest/session)
  - Keyword search
- Remove action available on item cards with confirmation before deletion.

1. Consumable Spend

- Tap spend action decrements quantity by 1.
- Hitting 0 removes item from active inventory.

1. Attunement Management

- Attune item if slots available.
- If all 3 slots used, require choosing one currently attuned item to unattune or cancel.

1. Export/Backup

- Export JSON backup.
- Import JSON backup.
- Export/import by QR for manual device sync.

## Data Model (Initial)

### Item

- `id: string`
- `name: string` (required)
- `isMagic: boolean`
- `isComplete: boolean` (for magic items with missing details)
- `description?: string`
- `sourceType: "sideQuest" | "mainSession" | "other"`
- `sourceRef?: string` (quest id/name or `Chapter.Session` like `10.3`)
- `acquiredAt?: string` (ISO datetime)
- `tags: string[]`
- `notes?: string`
- `quantity?: number` (default 1, used for consumables/stacks)
- `isConsumable?: boolean`

### MagicItemDetails (optional when `isMagic = true`)

- `rarity?: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact" | "Varies"`
- `requiresAttunement?: boolean`
- `attuned?: boolean`
- `charges?: { current: number; max?: number; recharge?: string }`
- `usesPerDay?: { current: number; max: number; resetOn: string }`
- `saveDc?: number`
- `saveAbility?: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA"`
- `spells?: Array<{ name: string; level?: number; notes?: string }>`

### SideQuestCatalogEntry

- `id: string`
- `name: string`
- `thumbnailUrl?: string`
- `sourceUrl?: string`
- `lastSeenAt?: string`
- `status: "fetched" | "manual" | "stale"`

## Source Rules

- Main campaign session names should follow `<Chapter>.<Session>`, where:
  - Chapter is `1-16` (currently 10).
  - Session is `1-6`.
- Side quests come from TPK catalog sources when available; manual entry is always allowed.

## Scraping/Automation Scope (V1)

- Provide a developer-run snapshot scraper:
  - `npm run catalog:scrape`
  - Scrapes the supported TPK URLs and writes `src/data/sideQuestCatalog.snapshot.json`
  - Discovers Leyfarer side quest names across FAQ/service-page/book-online text.
  - Follows `Read more` links on matching `book-online` entries to capture optional booking description and booking URL.
  - Emits entries as `{ "name": string, "description"?: string, "booking-url"?: string }`.
- In-app `Refresh Catalog` now loads this checked-in snapshot into local app state, with manual catalog fallback/editing always available.

## Non-Goals (For Now)

- Full bidirectional live sync across devices.
- Replacing the main character sheet UX.
- Rules-engine validation beyond basic attunement slot enforcement.

## Suggested Milestones

1. App shell + PWA installability + local persistence.
2. Unified item model + quick add + magic-item detail flow.
3. Search, filters, attunement management, consumable spend.
4. Side quest catalog fetch + manual fallback.
5. QR export/import + JSON backup/restore.

## Quality Bar

- Fast interaction on iPad/iPhone in-session.
- No data loss on refresh/reopen.
- Clear indicators for incomplete magic items.
- Attunement state always consistent with slot rules.
- Export/import paths tested with realistic inventory data.

## Local Development

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e:smoke`
- `npm run catalog:scrape` (when updating side quest catalog snapshot)

## Current Foundation Status

- React + TypeScript + Vite app shell with mobile-first layout and bottom navigation.
- PWA manifest/service worker via `vite-plugin-pwa`.
- Local persistence foundation with typed IndexedDB storage service and schema version marker.
- Canonical domain model + runtime validators for items, side quest catalog entries, source/session rules, and attunement limits.
- Repository layer for inventory items and side quest catalog CRUD/query operations.
- Storage migration runner with forward migration from schema v1 to v2.
- Health check route for storage initialization and app version visibility.
- Phase 03 item entry UX:
  - quick add + edit form for freeform items
  - optional magic details with deferred completeness
  - `Needs Details` badge and filter for incomplete magic items
- Phase 04 inventory usage UX:
  - keyword search + source type/source reference filters
  - quick filters for `Attuned`, `Consumables`, and `Needs Details`
  - attunement controls with replace-one-or-cancel flow when all 3 slots are full
  - one-tap consumable spend actions (including auto-remove when quantity reaches zero)
- Phase 05 side quest catalog + rewards UX:
  - developer-run snapshot scraper for configured TPK sources (`npm run catalog:scrape`)
  - user-triggered `Refresh Catalog` action loads the checked-in snapshot into local app data
  - de-duplicated catalog merge preserving manual entries, with `fetched/manual/stale` source status
  - persisted catalog sync status and refresh metadata surfaced in-app
  - manual catalog create/edit fallback always available when sync fails
  - side quest reward flow to create standard inventory `Item` records from a selected quest
- Phase 06 backup/restore + one-way transfer:
  - versioned inventory-only payload export/import with deterministic `replace` or `merge` strategy
  - import validation with schema migration support for legacy payloads
  - in-app `Transfer` panel with `Export JSON`, `Import JSON`, `Show QR`, and `Scan QR` actions
  - `Show QR` renders camera-scannable chunk QR images; `Start Camera Scan` captures chunks where browser support exists
  - QR transfer chunking/assembly with explicit error messages for corrupt or incomplete scans
  - destructive import guardrail requiring replace confirmation before inventory overwrite
- Phase 07 hardening + release readiness:
  - local payload sanitization for corrupt/partial persisted `items` and side quest catalog arrays
  - automatic repair for attunement overflow in persisted inventory (max 3 attuned)
  - invalid side quest sync metadata reset to safe idle defaults
  - expanded migration safety and corrupt-data regression coverage
  - expanded smoke flow coverage for complete-later magic edits and spend-to-zero consumables

## Release Checklist (V1)

- Run required verification commands (with project `.nvmrc` active):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e:smoke`
- Validate durability manually:
  - create/edit/remove items, then reload app and confirm data persists
  - export JSON and restore using both `replace` and `merge`
  - run QR transfer between two browser contexts/devices
- Validate gameplay-critical behaviors:
  - attunement replace-one-or-cancel when 3 slots are full
  - consumable spend removes item at zero quantity
  - incomplete magic records are clearly marked and filterable
- Validate catalog behavior:
  - `Refresh Catalog` loads snapshot data
  - manual catalog entry/edit still works even if snapshot is empty or stale
- Run mobile QA pass:
  - Safari on iPad/iPhone priority
  - check search/filter responsiveness with realistic inventory size
  - verify transfer panel and form controls remain usable in portrait orientation

## Known Limitations (V1)

- Data is local-first and local-only by default. There is no automatic cloud sync.
- QR transfer is manual and one-way; users must explicitly export/import.
- Camera QR scanning depends on browser support; manual chunk paste is the fallback.
- Side quest catalog sync is snapshot-based (`npm run catalog:scrape`) and not live remote fetch.
- Persisted corrupt records are repaired by dropping invalid entries; dropped entries are not recoverable unless a backup exists.
