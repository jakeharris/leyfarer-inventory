export const magicRarities = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies'
] as const;

export const saveAbilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export const sourceTypes = ['sideQuest', 'mainSession', 'other'] as const;

export const sideQuestStatuses = ['fetched', 'manual', 'stale'] as const;
export const sideQuestSyncStatuses = ['idle', 'success', 'stale', 'error'] as const;

export type MagicRarity = (typeof magicRarities)[number];
export type SaveAbility = (typeof saveAbilities)[number];
export type SourceType = (typeof sourceTypes)[number];
export type SideQuestCatalogStatus = (typeof sideQuestStatuses)[number];
export type SideQuestCatalogSyncStatus = (typeof sideQuestSyncStatuses)[number];

export interface MagicSpell {
  name: string;
  level?: number;
  notes?: string;
}

export interface MagicCharges {
  current: number;
  max?: number;
  recharge?: string;
}

export interface MagicUsesPerDay {
  current: number;
  max: number;
  resetOn: string;
}

export interface MagicItemDetails {
  rarity?: MagicRarity;
  requiresAttunement?: boolean;
  attuned?: boolean;
  charges?: MagicCharges;
  usesPerDay?: MagicUsesPerDay;
  saveDc?: number;
  saveAbility?: SaveAbility;
  spells?: MagicSpell[];
}

export interface Item {
  id: string;
  name: string;
  isMagic: boolean;
  isComplete: boolean;
  description?: string;
  sourceType: SourceType;
  sourceRef?: string;
  acquiredAt?: string;
  tags: string[];
  notes?: string;
  quantity?: number;
  isConsumable?: boolean;
  magicDetails?: MagicItemDetails;
}

export type ItemDraft = Omit<Item, 'id'> & { id?: string };

export interface ItemQuery {
  search?: string;
  sourceType?: SourceType;
  sourceRef?: string;
  isAttuned?: boolean;
  isConsumable?: boolean;
  needsDetails?: boolean;
}

export interface SideQuestCatalogEntry {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  lastSeenAt?: string;
  status: SideQuestCatalogStatus;
}

export type SideQuestCatalogEntryDraft = Partial<Omit<SideQuestCatalogEntry, 'id'>> & { id?: string };

export interface SideQuestCatalogQuery {
  search?: string;
  status?: SideQuestCatalogStatus;
}

export interface SideQuestCatalogSyncState {
  status: SideQuestCatalogSyncStatus;
  lastRefreshAt?: string;
  lastSuccessAt?: string;
  fetchedCount: number;
  errorCount: number;
  message?: string;
}

export interface SideQuestRewardProgressEntry {
  questId: string;
  questName: string;
  notYetDone: boolean;
  rewardItemHistory: string[];
  updatedAt: string;
}

export interface SideQuestRewardProgressState {
  flowSeen: boolean;
  entries: SideQuestRewardProgressEntry[];
}
