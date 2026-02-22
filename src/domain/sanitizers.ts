import type { Item, SideQuestCatalogEntry, SideQuestRewardProgressState } from './types';
import {
  normalizeItem,
  normalizeSideQuestCatalogEntry,
  normalizeSideQuestRewardProgressState
} from './validators';

export interface SanitizedArrayResult<T> {
  values: T[];
  changed: boolean;
}

export const sanitizeStoredItems = (value: unknown): SanitizedArrayResult<Item> => {
  if (!Array.isArray(value)) {
    return { values: [], changed: value !== undefined };
  }

  const values: Item[] = [];
  let changed = false;
  let attunedCount = 0;

  for (const raw of value) {
    try {
      const normalized = normalizeItem(raw);
      if (normalized.magicDetails?.attuned) {
        if (attunedCount >= 3) {
          const repaired = normalizeItem({
            ...normalized,
            magicDetails: {
              ...normalized.magicDetails,
              attuned: false
            }
          });
          values.push(repaired);
          changed = true;
          continue;
        }

        attunedCount += 1;
      }

      values.push(normalized);
    } catch {
      changed = true;
    }
  }

  return {
    values,
    changed
  };
};

export const sanitizeStoredSideQuestCatalog = (
  value: unknown
): SanitizedArrayResult<SideQuestCatalogEntry> => {
  if (!Array.isArray(value)) {
    return { values: [], changed: value !== undefined };
  }

  const values: SideQuestCatalogEntry[] = [];
  let changed = false;

  for (const raw of value) {
    try {
      values.push(normalizeSideQuestCatalogEntry(raw));
    } catch {
      changed = true;
    }
  }

  return {
    values,
    changed
  };
};

export const sanitizeStoredSideQuestRewardProgress = (
  value: unknown
): { value: SideQuestRewardProgressState; changed: boolean } => {
  try {
    const normalized = normalizeSideQuestRewardProgressState(value);
    return {
      value: normalized,
      changed: false
    };
  } catch {
    return {
      value: {
        flowSeen: false,
        entries: []
      },
      changed: true
    };
  }
};
