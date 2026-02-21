import type { Item, ItemDraft, ItemQuery } from '../domain/types';
import { STORAGE } from '../config/constants';
import {
  DomainValidationError,
  ensureAttunementLimit,
  normalizeItem,
  normalizeItemDraft,
  normalizeItems
} from '../domain/validators';
import type { StorageService } from '../storage';

const ITEMS_KEY = STORAGE.keys.items;

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const includesNeedle = (value: string | undefined, needle: string): boolean =>
  Boolean(value && value.toLowerCase().includes(needle));

const matchesQuery = (item: Item, query: ItemQuery): boolean => {
  if (query.sourceType && item.sourceType !== query.sourceType) {
    return false;
  }

  if (query.sourceRef && item.sourceRef !== query.sourceRef) {
    return false;
  }

  if (query.isAttuned !== undefined) {
    if (Boolean(item.magicDetails?.attuned) !== query.isAttuned) {
      return false;
    }
  }

  if (query.isConsumable !== undefined) {
    if (Boolean(item.isConsumable) !== query.isConsumable) {
      return false;
    }
  }

  if (query.needsDetails !== undefined) {
    const needsDetails = item.isMagic && !item.isComplete;
    if (needsDetails !== query.needsDetails) {
      return false;
    }
  }

  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    const tagMatch = item.tags.some((tag) => tag.toLowerCase().includes(needle));

    if (
      !(
        includesNeedle(item.name, needle) ||
        includesNeedle(item.description, needle) ||
        includesNeedle(item.notes, needle) ||
        tagMatch
      )
    ) {
      return false;
    }
  }

  return true;
};

export class ItemRepository {
  constructor(private readonly storageService: StorageService) {}

  async list(query: ItemQuery = {}): Promise<Item[]> {
    const items = await this.readAll();
    return items.filter((item) => matchesQuery(item, query));
  }

  async getById(id: string): Promise<Item | undefined> {
    const itemId = id.trim();
    if (!itemId) {
      throw new DomainValidationError('Invalid id', [{ path: 'id', message: 'id is required' }]);
    }

    const items = await this.readAll();
    return items.find((item) => item.id === itemId);
  }

  async create(draft: ItemDraft): Promise<Item> {
    const items = await this.readAll();
    const id = draft.id?.trim() || createId();
    if (items.some((item) => item.id === id)) {
      throw new DomainValidationError('Duplicate id', [{ path: 'id', message: 'id already exists' }]);
    }

    const item = normalizeItemDraft(draft, id);
    const nextItems = [...items, item];
    ensureAttunementLimit(nextItems);
    await this.writeAll(nextItems);
    return item;
  }

  async update(id: string, patch: Partial<Item>): Promise<Item> {
    const itemId = id.trim();
    if (!itemId) {
      throw new DomainValidationError('Invalid id', [{ path: 'id', message: 'id is required' }]);
    }

    const items = await this.readAll();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      throw new DomainValidationError('Missing item', [{ path: 'id', message: 'item was not found' }]);
    }

    const current = items[index];
    const merged = {
      ...current,
      ...patch,
      id: itemId
    };

    const updated = normalizeItem(merged);
    const nextItems = [...items];
    nextItems[index] = updated;
    ensureAttunementLimit(nextItems);
    await this.writeAll(nextItems);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const itemId = id.trim();
    if (!itemId) {
      throw new DomainValidationError('Invalid id', [{ path: 'id', message: 'id is required' }]);
    }

    const items = await this.readAll();
    const filtered = items.filter((item) => item.id !== itemId);
    if (filtered.length !== items.length) {
      await this.writeAll(filtered);
    }
  }

  private async readAll(): Promise<Item[]> {
    const rawItems = await this.storageService.read<unknown>(ITEMS_KEY);
    return normalizeItems(rawItems);
  }

  private async writeAll(items: Item[]): Promise<void> {
    await this.storageService.write(ITEMS_KEY, items);
  }
}

export const createItemRepository = (storageService: StorageService): ItemRepository =>
  new ItemRepository(storageService);
