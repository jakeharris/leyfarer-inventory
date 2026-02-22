import { describe, expect, it } from 'vitest';
import type { StorageService, StorageValue } from '../storage';
import type { SideQuestCatalogEntry } from '../domain/types';
import { STORAGE } from '../config/constants';
import {
  SIDE_QUEST_CATALOG_SOURCES,
  SideQuestCatalogSyncService,
  mergeCatalogEntries
} from './sideQuestCatalogSyncService';

class MemoryStorage implements StorageService {
  private readonly map = new Map<string, StorageValue>();

  async init(): Promise<void> {
    return undefined;
  }

  async read<T extends StorageValue>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async write<T extends StorageValue>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getSchemaVersion(): Promise<number | undefined> {
    return 2;
  }
}

describe('mergeCatalogEntries', () => {
  it('dedupes by normalized name and preserves manual overrides', () => {
    const nowIso = '2025-01-10T04:00:00.000Z';
    const existing: SideQuestCatalogEntry[] = [
      {
        id: 'manual-1',
        name: 'Beneath the Brewery',
        status: 'manual',
        sourceUrl: SIDE_QUEST_CATALOG_SOURCES[0]
      },
      {
        id: 'fetched-1',
        name: 'Echoes of Emberwake',
        status: 'fetched',
        sourceUrl: SIDE_QUEST_CATALOG_SOURCES[1],
        lastSeenAt: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'fetched-duplicate',
        name: 'Echoes of Emberwake',
        status: 'stale',
        sourceUrl: SIDE_QUEST_CATALOG_SOURCES[1],
        lastSeenAt: '2024-12-01T00:00:00.000Z'
      },
      {
        id: 'stale-1',
        name: 'Old Quest',
        status: 'fetched',
        sourceUrl: SIDE_QUEST_CATALOG_SOURCES[1],
        lastSeenAt: '2025-01-02T00:00:00.000Z'
      }
    ];

    const merged = mergeCatalogEntries(
      existing,
      [
        {
          name: 'Echoes of Emberwake',
          sourceUrl: SIDE_QUEST_CATALOG_SOURCES[2]
        },
        {
          name: 'New Quest Name',
          sourceUrl: SIDE_QUEST_CATALOG_SOURCES[2]
        },
        {
          name: 'Beneath the Brewery',
          sourceUrl: SIDE_QUEST_CATALOG_SOURCES[2]
        }
      ],
      nowIso
    );

    expect(merged).toHaveLength(4);
    expect(merged.find((entry) => entry.id === 'manual-1')?.status).toBe('manual');

    const fetched = merged.find((entry) => entry.id === 'fetched-1');
    expect(fetched).toMatchObject({
      name: 'Echoes of Emberwake',
      status: 'fetched',
      sourceUrl: SIDE_QUEST_CATALOG_SOURCES[2],
      lastSeenAt: nowIso
    });

    expect(merged.find((entry) => entry.name === 'New Quest Name')?.status).toBe('fetched');
    expect(merged.find((entry) => entry.id === 'stale-1')?.status).toBe('stale');
  });
});

describe('SideQuestCatalogSyncService', () => {
  it('loads catalog from local snapshot and updates metadata', async () => {
    const storage = new MemoryStorage();

    await storage.write(STORAGE.keys.sideQuestCatalog, [
      {
        id: 'old-fetched',
        name: 'Old Quest',
        status: 'fetched',
        sourceUrl: SIDE_QUEST_CATALOG_SOURCES[0]
      }
    ]);

    const service = new SideQuestCatalogSyncService(storage, {
      generatedAt: '2026-02-21T00:00:00.000Z',
      sources: [...SIDE_QUEST_CATALOG_SOURCES],
      entries: [
        {
          name: 'Secrets of the Hollow Cask',
          'booking-url': SIDE_QUEST_CATALOG_SOURCES[0]
        }
      ]
    });

    const state = await service.refreshCatalog();

    expect(state.status).toBe('success');
    expect(state.fetchedCount).toBe(1);
    expect(state.errorCount).toBe(0);
    expect(state.lastSuccessAt).toBeDefined();
    expect(state.message).toContain('Catalog loaded from local snapshot');

    const catalog = (await storage.read<SideQuestCatalogEntry[]>(STORAGE.keys.sideQuestCatalog)) ?? [];
    expect(catalog.some((entry) => entry.name === 'Secrets of the Hollow Cask')).toBe(true);
    expect(catalog.find((entry) => entry.id === 'old-fetched')?.status).toBe('stale');
  });

  it('keeps manual catalog usable when snapshot has no entries', async () => {
    const storage = new MemoryStorage();
    const manualEntry: SideQuestCatalogEntry = {
      id: 'manual-keep',
      name: 'Manually Added Quest',
      status: 'manual',
      sourceUrl: SIDE_QUEST_CATALOG_SOURCES[0]
    };

    await storage.write(STORAGE.keys.sideQuestCatalog, [manualEntry]);

    const service = new SideQuestCatalogSyncService(storage, {
      generatedAt: '2026-02-21T00:00:00.000Z',
      sources: [...SIDE_QUEST_CATALOG_SOURCES],
      entries: []
    });

    const state = await service.refreshCatalog();

    expect(state.status).toBe('error');
    expect(state.message).toContain('npm run catalog:scrape');

    const catalog = await storage.read<SideQuestCatalogEntry[]>(STORAGE.keys.sideQuestCatalog);
    expect(catalog).toEqual([manualEntry]);
  });
});
