import sideQuestCatalogSnapshot from '../data/sideQuestCatalog.snapshot.json';
import { STORAGE } from '../config/constants';
import type { SideQuestCatalogEntry, SideQuestCatalogSyncState } from '../domain/types';
import {
  normalizeSideQuestCatalog,
  normalizeSideQuestCatalogEntry,
  normalizeSideQuestCatalogSyncState
} from '../domain/validators';
import type { StorageService } from '../storage';

export const SIDE_QUEST_CATALOG_SOURCES = [
  'https://www.tpkbrewing.com/faq',
  'https://www.tpkbrewing.com/service-page/private-game-leyfarer-content-4-hr?category=36816173-529a-40ff-b6d5-769c978b58a3',
  'https://www.tpkbrewing.com/book-online?category=b90cf4ec-ae00-4071-9766-9ea7454a5708'
] as const;
const BOOK_ONLINE_FALLBACK_SOURCE = SIDE_QUEST_CATALOG_SOURCES[2];

export interface ParsedQuest {
  name: string;
  sourceUrl: string;
  description?: string;
  thumbnailUrl?: string;
}

interface SideQuestSnapshotEntry {
  name: string;
  description?: string;
  'booking-url'?: string;
}

interface SideQuestCatalogSnapshot {
  generatedAt: string;
  sources: string[];
  entries: SideQuestSnapshotEntry[];
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `side-quest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeQuestKey = (value: string): string =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const dedupeParsedQuests = (quests: ParsedQuest[]): ParsedQuest[] => {
  const byKey = new Map<string, ParsedQuest>();

  for (const quest of quests) {
    const normalizedName = normalizeWhitespace(quest.name);
    const key = normalizeQuestKey(normalizedName);
    if (!key || !normalizedName) {
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        name: normalizedName,
        sourceUrl: quest.sourceUrl,
        description: quest.description,
        thumbnailUrl: quest.thumbnailUrl
      });
      continue;
    }

    if (!existing.thumbnailUrl && quest.thumbnailUrl) {
      byKey.set(key, { ...existing, thumbnailUrl: quest.thumbnailUrl });
      continue;
    }

    if (!existing.description && quest.description) {
      byKey.set(key, { ...existing, description: quest.description });
    }
  }

  return Array.from(byKey.values());
};

const dedupeExistingEntries = (entries: SideQuestCatalogEntry[]): Map<string, SideQuestCatalogEntry> => {
  const byKey = new Map<string, SideQuestCatalogEntry>();

  for (const entry of entries) {
    const key = normalizeQuestKey(entry.name);
    if (!key) {
      continue;
    }

    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, entry);
      continue;
    }

    if (previous.status !== 'manual' && entry.status === 'manual') {
      byKey.set(key, entry);
      continue;
    }

    if (previous.status === 'stale' && entry.status === 'fetched') {
      byKey.set(key, entry);
    }
  }

  return byKey;
};

const buildSyncMessage = (
  status: SideQuestCatalogSyncState['status'],
  fetchedCount: number,
  generatedAt: string
): string => {
  if (status === 'success') {
    return `Catalog loaded from local snapshot (${fetchedCount} quests, generated ${new Date(generatedAt).toLocaleString()}).`;
  }

  return 'Catalog snapshot is empty. Run npm run catalog:scrape to refresh snapshot data.';
};

export const mergeCatalogEntries = (
  existingEntries: SideQuestCatalogEntry[],
  fetchedEntries: ParsedQuest[],
  nowIso: string
): SideQuestCatalogEntry[] => {
  const currentByKey = dedupeExistingEntries(existingEntries);
  const seenFetchedKeys = new Set<string>();

  const mergedByKey = new Map<string, SideQuestCatalogEntry>();

  for (const [key, entry] of currentByKey.entries()) {
    if (entry.status === 'manual') {
      mergedByKey.set(key, entry);
    }
  }

  for (const fetchedEntry of dedupeParsedQuests(fetchedEntries)) {
    const key = normalizeQuestKey(fetchedEntry.name);
    if (!key || seenFetchedKeys.has(key)) {
      continue;
    }

    seenFetchedKeys.add(key);
    const existing = currentByKey.get(key);

    if (existing?.status === 'manual') {
      continue;
    }

    const next = normalizeSideQuestCatalogEntry(
      {
        id: existing?.id,
        name: fetchedEntry.name,
        sourceUrl: fetchedEntry.sourceUrl,
        description: fetchedEntry.description ?? existing?.description,
        thumbnailUrl: fetchedEntry.thumbnailUrl ?? existing?.thumbnailUrl,
        status: 'fetched',
        lastSeenAt: nowIso
      },
      existing?.id ?? createId()
    );

    mergedByKey.set(key, next);
  }

  for (const [key, entry] of currentByKey.entries()) {
    if (entry.status === 'manual') {
      continue;
    }

    if (seenFetchedKeys.has(key)) {
      continue;
    }

    mergedByKey.set(
      key,
      normalizeSideQuestCatalogEntry(
        {
          ...entry,
          status: 'stale'
        },
        entry.id
      )
    );
  }

  return Array.from(mergedByKey.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export class SideQuestCatalogSyncService {
  constructor(
    private readonly storageService: StorageService,
    private readonly snapshot: SideQuestCatalogSnapshot = sideQuestCatalogSnapshot
  ) {}

  async getSyncState(): Promise<SideQuestCatalogSyncState> {
    const raw = await this.storageService.read<unknown>(STORAGE.keys.sideQuestCatalogSyncState);
    return normalizeSideQuestCatalogSyncState(raw);
  }

  async refreshCatalog(): Promise<SideQuestCatalogSyncState> {
    const currentState = await this.getSyncState();
    const nowIso = new Date().toISOString();
    const fetchedEntries = dedupeParsedQuests(
      (this.snapshot.entries ?? []).map((entry) => ({
        name: entry.name,
        description: entry.description,
        sourceUrl: entry['booking-url'] ?? BOOK_ONLINE_FALLBACK_SOURCE
      }))
    );
    const fetchedCount = fetchedEntries.length;

    const existingEntries = normalizeSideQuestCatalog(
      await this.storageService.read<unknown>(STORAGE.keys.sideQuestCatalog)
    );

    const mergedEntries = mergeCatalogEntries(existingEntries, fetchedEntries, nowIso);
    await this.storageService.write(STORAGE.keys.sideQuestCatalog, mergedEntries);

    const status: SideQuestCatalogSyncState['status'] = fetchedCount > 0 ? 'success' : 'error';
    const nextState: SideQuestCatalogSyncState = {
      status,
      lastRefreshAt: nowIso,
      lastSuccessAt: status === 'error' ? currentState.lastSuccessAt : nowIso,
      fetchedCount,
      errorCount: status === 'error' ? 1 : 0,
      message: buildSyncMessage(status, fetchedCount, this.snapshot.generatedAt)
    };

    await this.storageService.write(STORAGE.keys.sideQuestCatalogSyncState, nextState);

    return nextState;
  }
}

export const createSideQuestCatalogSyncService = (
  storageService: StorageService,
  snapshot?: SideQuestCatalogSnapshot
): SideQuestCatalogSyncService => new SideQuestCatalogSyncService(storageService, snapshot);
