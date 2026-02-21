# Phase 01: Project Foundation (React + TS + Vite + PWA)

## Objective

Establish a production-ready app shell optimized for iPad/iPhone, with local persistence infrastructure and test tooling in place.

## Depends On

- None.

## Scope

- Initialize React + TypeScript + Vite project.
- Configure PWA installability (manifest + service worker).
- Set up mobile-first routing/layout shell.
- Add local persistence foundation (IndexedDB wrapper + storage service interface).
- Add baseline test stack (unit + component + e2e smoke).
- Define core app constants and feature flags.

## Deliverables

- Working app scaffold committed in repo.
- PWA manifest with app name/icons/start URL/display settings.
- Offline-capable shell route with install prompt support.
- Storage abstraction layer with typed interface (no business logic yet).
- CI/test scripts for lint/typecheck/unit tests.

## Implementation Tasks

1. Bootstrap app with strict TypeScript settings.
2. Add linting/formatting/test scripts and enforce in CI.
3. Configure PWA plugin and service worker caching strategy for app shell.
4. Implement `storage/` module with:
   - initialization
   - basic read/write/delete primitives
   - schema version marker for future migrations
5. Create app layout primitives:
   - mobile-first top-level page container
   - bottom action/nav pattern suitable for iPhone/iPad
6. Add a health-check screen showing storage init status and app version.

## Acceptance Criteria

- App launches on desktop and mobile viewport without layout breakage.
- PWA can be installed from Safari-compatible flow and loads app shell offline.
- Storage initialization succeeds across page reloads.
- Lint/typecheck/tests pass locally.

## Test Plan

- Unit tests for storage interface initialization and CRUD primitives.
- Component test for app shell rendering.
- E2E smoke test: open app, load shell, reload, still functional.

## Out of Scope

- Item model and inventory features.
- Side quest catalog logic.
- Import/export and PDF generation.
