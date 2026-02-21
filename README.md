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
- Export printable PDF pages (8.5"x11") in card layout for appending to the existing character sheet.

## Product Decisions (Locked for V1)

- Platform: React + TypeScript + Vite + PWA, usable in iPad/iPhone Safari.
- Storage: local-only (IndexedDB/local storage), no mandatory cloud backend.
- Sync: one-way QR transfer (export on device A, import on device B).
- Side quest catalog: attempted fetch/scrape from TPK pages with manual fallback.
- Attunement: max 3 slots; if full, attuning prompts replace-one-or-cancel.
- Consumables: stack quantity model; quantity reaching 0 removes item.
- Incomplete magic items: explicit `Needs Details` badge and filter.
- PDF export: 8.5"x11", card-oriented pages for readability.
- V1 includes automation/scraping support (not deferred).

## Core User Flows

1. Add Item (Quick)
- Enter `name` (required), `source` (quest or session), optional `description`.
- Toggle `Magic Item`.
- If not magic: save immediately.
- If magic: prompt for magic fields, but allow skip-and-save as incomplete.

2. Add Item From Side Quest
- Pick known quest from catalog.
- Select reward(s) received.
- Save item entries in the unified item model.

3. Session Use
- Fast views for:
  - Attuned items
  - Consumables
  - Source filter (quest/session)
  - Keyword search

4. Consumable Spend
- Tap spend action decrements quantity by 1.
- Hitting 0 removes item from active inventory.

5. Attunement Management
- Attune item if slots available.
- If all 3 slots used, require choosing one currently attuned item to unattune or cancel.

6. Export/Backup
- Export JSON backup.
- Import JSON backup.
- Export/import by QR for manual device sync.
- Export PDF pages in card layout.

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

- Build a lightweight quest catalog sync that:
  - Attempts to fetch side quest names from:
    - `https://www.tpkbrewing.com/faq`
    - `https://www.tpkbrewing.com/service-page/private-game-leyfarer-content-4-hr?category=36816173-529a-40ff-b6d5-769c978b58a3`
    - `https://www.tpkbrewing.com/book-online?category=b90cf4ec-ae00-4071-9766-9ea7454a5708` (for thumbnails when available)
  - Normalizes and de-duplicates entries.
  - Falls back gracefully to manual catalog management.
- Add simple refresh automation in-app (manual "Refresh Catalog" action with status and timestamp).

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
6. PDF card export (8.5"x11").

## Quality Bar

- Fast interaction on iPad/iPhone in-session.
- No data loss on refresh/reopen.
- Clear indicators for incomplete magic items.
- Attunement state always consistent with slot rules.
- Export/import paths tested with realistic inventory data.
