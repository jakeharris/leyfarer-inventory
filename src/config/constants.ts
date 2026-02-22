export const APP_NAME = 'Leyfarer Inventory';
// `__APP_VERSION__` is injected by Vite at build time; in test/non-Vite runtime it may be absent.
// Fallback to `0.0.0` so constants remain safe to import in all environments.
const definedBuildVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined;
export const APP_VERSION =
  import.meta.env.VITE_APP_VERSION?.trim() || definedBuildVersion || '0.0.0';

export const STORAGE = {
  dbName: 'leyfarer-inventory',
  dbVersion: 1,
  stores: {
    kv: 'kv',
    meta: 'meta'
  },
  keys: {
    schemaVersion: 'schemaVersion',
    items: 'items',
    sideQuestCatalog: 'sideQuestCatalog',
    sideQuestCatalogSyncState: 'sideQuestCatalogSyncState'
  },
  schemaVersion: 2
} as const;
