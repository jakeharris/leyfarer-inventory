import type {
  SideQuestCatalogEntry,
  SideQuestCatalogEntryDraft,
  SideQuestCatalogQuery
} from '../domain/types';
import { STORAGE } from '../config/constants';
import { DomainValidationError, normalizeSideQuestCatalog, normalizeSideQuestCatalogEntry } from '../domain/validators';
import type { StorageService } from '../storage';
import { sanitizeStoredSideQuestCatalog } from '../domain/sanitizers';

const SIDE_QUEST_CATALOG_KEY = STORAGE.keys.sideQuestCatalog;

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `side-quest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const matchQuery = (entry: SideQuestCatalogEntry, query: SideQuestCatalogQuery): boolean => {
  if (query.status && query.status !== entry.status) {
    return false;
  }

  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return (
      entry.name.toLowerCase().includes(needle) ||
      Boolean(entry.sourceUrl?.toLowerCase().includes(needle))
    );
  }

  return true;
};

export class SideQuestCatalogRepository {
  constructor(private readonly storageService: StorageService) {}

  async list(query: SideQuestCatalogQuery = {}): Promise<SideQuestCatalogEntry[]> {
    const entries = await this.readAll();
    return entries.filter((entry) => matchQuery(entry, query));
  }

  async getById(id: string): Promise<SideQuestCatalogEntry | undefined> {
    const entryId = id.trim();
    if (!entryId) {
      throw new DomainValidationError('Invalid id', [{ path: 'id', message: 'id is required' }]);
    }

    const entries = await this.readAll();
    return entries.find((entry) => entry.id === entryId);
  }

  async upsert(draft: SideQuestCatalogEntryDraft): Promise<SideQuestCatalogEntry> {
    const entries = await this.readAll();
    const draftId = draft.id?.trim();
    const id = draftId || createId();

    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) {
      const nextEntry = normalizeSideQuestCatalogEntry(draft, id);
      await this.writeAll([...entries, nextEntry]);
      return nextEntry;
    }

    const existing = entries[index];
    if (!existing) {
      throw new DomainValidationError('Missing item', [{ path: 'id', message: 'item was not found' }]);
    }

    const merged = normalizeSideQuestCatalogEntry({
      ...existing,
      ...draft,
      id
    });

    const nextEntries = [...entries];
    nextEntries[index] = merged;
    await this.writeAll(nextEntries);
    return merged;
  }

  async remove(id: string): Promise<void> {
    const entryId = id.trim();
    if (!entryId) {
      throw new DomainValidationError('Invalid id', [{ path: 'id', message: 'id is required' }]);
    }

    const entries = await this.readAll();
    const filtered = entries.filter((entry) => entry.id !== entryId);
    if (filtered.length !== entries.length) {
      await this.writeAll(filtered);
    }
  }

  private async readAll(): Promise<SideQuestCatalogEntry[]> {
    const raw = await this.storageService.read(SIDE_QUEST_CATALOG_KEY);
    const sanitized = sanitizeStoredSideQuestCatalog(raw);
    const entries = normalizeSideQuestCatalog(sanitized.values);

    if (sanitized.changed) {
      await this.writeAll(entries);
    }

    return entries;
  }

  private async writeAll(entries: SideQuestCatalogEntry[]): Promise<void> {
    await this.storageService.write(SIDE_QUEST_CATALOG_KEY, entries);
  }
}

export const createSideQuestCatalogRepository = (
  storageService: StorageService
): SideQuestCatalogRepository => new SideQuestCatalogRepository(storageService);
