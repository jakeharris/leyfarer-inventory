import type { Item, ItemDraft, SideQuestCatalogEntry, SideQuestCatalogEntryDraft } from '../domain/types';

let nextId = 0;

const buildId = (prefix: string): string => {
  nextId += 1;
  return `${prefix}-${nextId}`;
};

export const createItem = (overrides: Partial<Item> = {}): Item => ({
  id: buildId('item'),
  name: 'Rope of Climbing',
  isMagic: true,
  isComplete: true,
  sourceType: 'sideQuest',
  sourceRef: 'Beneath the Brewery',
  tags: ['utility'],
  magicDetails: {
    rarity: 'Uncommon',
    requiresAttunement: true,
    attuned: false
  },
  ...overrides
});

export const createItemDraft = (overrides: Partial<ItemDraft> = {}): ItemDraft => {
  const base = createItem();
  return {
    ...base,
    id: undefined,
    ...overrides
  };
};

export const createSideQuestEntry = (
  overrides: Partial<SideQuestCatalogEntry> = {}
): SideQuestCatalogEntry => ({
  id: buildId('quest'),
  name: 'Secrets of the Hollow Cask',
  status: 'manual',
  sourceUrl: 'https://www.tpkbrewing.com/faq',
  ...overrides
});

export const createSideQuestEntryDraft = (
  overrides: Partial<SideQuestCatalogEntryDraft> = {}
): SideQuestCatalogEntryDraft => {
  const base = createSideQuestEntry();
  return {
    ...base,
    id: undefined,
    ...overrides
  };
};

export const resetFactoryIds = (): void => {
  nextId = 0;
};
