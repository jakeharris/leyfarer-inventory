# AGENTS.md

This file defines how agents should operate in this repository.

## Project Intent

Build and maintain a local-first inventory web app for Mocha (catfolk sorcerer) in *The Leyfarer's Chronicle* campaign, optimized for iPad/iPhone use during play.

## Product Constraints (Do Not Drift)

- Stack: React + TypeScript + Vite + PWA.
- Primary use: quick viewing/editing on iPad/iPhone.
- Source of truth: this app's local data, not Procreate sheet.
- Data storage: local-only by default.
- Device sync: manual one-way QR export/import.
- Inventory modes:
  - Side quest reward flow.
  - Freeform item entry flow.
- Non-magic items allowed with minimal schema (`name` required).
- Magic items should support rich fields; incomplete magic entries are allowed but must be clearly marked.
- Attunement:
  - Max 3 attuned items.
  - On attune when full, force replace-one-or-cancel.
- Consumables:
  - Use stack quantity.
  - Spending down to zero removes item.
- Exports:
  - JSON backup/import.
  - PDF 8.5"x11" card-style pages.
- V1 includes side quest catalog automation/scraping with manual fallback.

## Domain Rules

- Main campaign session naming format: `<Chapter>.<Session>`.
- Chapter range: `1-16`.
- Session range: `1-6`.
- Side quest catalog sources to support:
  - `https://www.tpkbrewing.com/faq`
  - `https://www.tpkbrewing.com/service-page/private-game-leyfarer-content-4-hr?category=36816173-529a-40ff-b6d5-769c978b58a3`
  - `https://www.tpkbrewing.com/book-online?category=b90cf4ec-ae00-4071-9766-9ea7454a5708` (thumbnails where available)

## Implementation Guidance

- Prefer resilient parsing over brittle selectors for catalog scraping.
- Keep a manual catalog editor available even if scraping succeeds.
- Preserve backward compatibility for persisted data with versioned migrations.
- Design forms for rapid in-session entry:
  - required first, optional second.
  - sensible defaults.
  - minimal taps for common actions.
- Expose explicit filters for:
  - Attuned items
  - Consumables
  - Source (quest/session)
  - `Needs Details` magic items
- Treat data durability as critical; test app reload and export/import paths.

## UX Priorities

- Mobile-first layout; no desktop-only assumptions.
- Readability over density for item detail views.
- Fast access to common play actions (search, spend consumable, attunement state).
- Clear visual status for incomplete records.

## Out of Scope Unless Requested

- Cloud sync/backends.
- Replacing core character-sheet workflow.
- Complex rules automation beyond requested inventory logic.

## When Modifying This Repo

- Keep README and product behavior aligned.
- If a change alters any locked constraint above, call it out explicitly before implementation.
- Always run Node/npm commands with the project's `.nvmrc` version active.
  - Use: `source ~/.nvm/nvm.sh && nvm use && <command>`
  - Example: `source ~/.nvm/nvm.sh && nvm use && npm run lint`
- Add or update tests when behavior changes in data model, attunement rules, import/export, or consumable handling.
- Before asserting work is complete, always run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e:smoke`
- If any of the required checks fail, the agent must continue iterating until all required checks pass.
