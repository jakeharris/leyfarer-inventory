import {
  magicRarities,
  saveAbilities,
  sideQuestStatuses,
  sourceTypes,
  type Item,
  type ItemDraft,
  type MagicItemDetails,
  type SideQuestCatalogEntry,
  type SourceType
} from './types';

const MAIN_SESSION_PATTERN = /^(\d{1,2})\.(\d{1,2})$/;
const MIN_CHAPTER = 1;
const MAX_CHAPTER = 16;
const MIN_SESSION = 1;
const MAX_SESSION = 6;

interface ValidationIssue {
  path: string;
  message: string;
}

export class DomainValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'DomainValidationError';
    this.issues = issues;
  }
}

const asObject = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainValidationError('Expected object', [{ path, message: 'Expected object' }]);
  }
  return value as Record<string, unknown>;
};

const optionalTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const requiredString = (value: unknown, path: string): string => {
  const normalized = optionalTrimmedString(value);
  if (!normalized) {
    throw new DomainValidationError('Invalid value', [{ path, message: 'Expected a non-empty string' }]);
  }
  return normalized;
};

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const optionalPositiveInt = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
};

const optionalIsoDateString = (value: unknown): string | undefined => {
  const normalized = optionalTrimmedString(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new DomainValidationError('Invalid value', [
      { path: 'acquiredAt', message: 'Expected an ISO date string' }
    ]);
  }

  return date.toISOString();
};

const asEnum = <T extends string>(
  value: unknown,
  all: readonly T[],
  path: string,
  fallback?: T
): T => {
  if (typeof value === 'string' && all.includes(value as T)) {
    return value as T;
  }
  if (fallback) {
    return fallback;
  }

  throw new DomainValidationError('Invalid value', [
    { path, message: `Expected one of: ${all.join(', ')}` }
  ]);
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
};

const normalizeMagicDetails = (value: unknown): MagicItemDetails | undefined => {
  if (!value) {
    return undefined;
  }

  const input = asObject(value, 'magicDetails');

  const rarity = input.rarity ? asEnum(input.rarity, magicRarities, 'magicDetails.rarity') : undefined;
  const requiresAttunement = optionalBoolean(input.requiresAttunement);
  const attuned = optionalBoolean(input.attuned);

  if (attuned && requiresAttunement === false) {
    throw new DomainValidationError('Invalid attunement state', [
      {
        path: 'magicDetails.attuned',
        message: 'attuned cannot be true when requiresAttunement is false'
      }
    ]);
  }

  const saveDc = optionalPositiveInt(input.saveDc);

  const charges = input.charges
    ? (() => {
        const parsed = asObject(input.charges, 'magicDetails.charges');
        const current = optionalPositiveInt(parsed.current);
        if (current === undefined) {
          throw new DomainValidationError('Invalid value', [
            { path: 'magicDetails.charges.current', message: 'Expected non-negative integer' }
          ]);
        }

        const max = optionalPositiveInt(parsed.max);
        if (max !== undefined && max < current) {
          throw new DomainValidationError('Invalid value', [
            {
              path: 'magicDetails.charges.max',
              message: 'max must be greater than or equal to current'
            }
          ]);
        }

        return {
          current,
          max,
          recharge: optionalTrimmedString(parsed.recharge)
        };
      })()
    : undefined;

  const usesPerDay = input.usesPerDay
    ? (() => {
        const parsed = asObject(input.usesPerDay, 'magicDetails.usesPerDay');
        const current = optionalPositiveInt(parsed.current);
        const max = optionalPositiveInt(parsed.max);
        const resetOn = optionalTrimmedString(parsed.resetOn);
        if (current === undefined || max === undefined || !resetOn) {
          throw new DomainValidationError('Invalid value', [
            {
              path: 'magicDetails.usesPerDay',
              message: 'current, max, and resetOn are required when usesPerDay is provided'
            }
          ]);
        }

        if (current > max) {
          throw new DomainValidationError('Invalid value', [
            {
              path: 'magicDetails.usesPerDay.current',
              message: 'current must be less than or equal to max'
            }
          ]);
        }

        return {
          current,
          max,
          resetOn
        };
      })()
    : undefined;

  const saveAbility = input.saveAbility
    ? asEnum(input.saveAbility, saveAbilities, 'magicDetails.saveAbility')
    : undefined;

  const spells = Array.isArray(input.spells)
    ? input.spells
        .map((spell, index) => {
          const parsed = asObject(spell, `magicDetails.spells.${index}`);
          const name = requiredString(parsed.name, `magicDetails.spells.${index}.name`);
          const level = optionalPositiveInt(parsed.level);
          const notes = optionalTrimmedString(parsed.notes);

          return {
            name,
            level,
            notes
          };
        })
        .filter((spell) => spell.name.length > 0)
    : undefined;

  return {
    rarity,
    requiresAttunement,
    attuned,
    charges,
    usesPerDay,
    saveDc,
    saveAbility,
    spells
  };
};

export const parseMainSessionRef = (value: string): { chapter: number; session: number; normalized: string } => {
  const normalized = value.trim();
  const match = normalized.match(MAIN_SESSION_PATTERN);

  if (!match) {
    throw new DomainValidationError('Invalid main session reference', [
      {
        path: 'sourceRef',
        message: 'Expected format <Chapter>.<Session> (for example: 10.3)'
      }
    ]);
  }

  const chapter = Number.parseInt(match[1], 10);
  const session = Number.parseInt(match[2], 10);

  if (chapter < MIN_CHAPTER || chapter > MAX_CHAPTER) {
    throw new DomainValidationError('Invalid chapter', [
      { path: 'sourceRef', message: `Chapter must be between ${MIN_CHAPTER} and ${MAX_CHAPTER}` }
    ]);
  }

  if (session < MIN_SESSION || session > MAX_SESSION) {
    throw new DomainValidationError('Invalid session', [
      { path: 'sourceRef', message: `Session must be between ${MIN_SESSION} and ${MAX_SESSION}` }
    ]);
  }

  return {
    chapter,
    session,
    normalized: `${chapter}.${session}`
  };
};

export const normalizeSourceRef = (sourceType: SourceType, sourceRef: unknown): string | undefined => {
  const raw = optionalTrimmedString(sourceRef);
  if (!raw) {
    return undefined;
  }

  if (sourceType === 'mainSession') {
    return parseMainSessionRef(raw).normalized;
  }

  return raw;
};

const normalizeItemInternal = (value: unknown, providedId?: string): Item => {
  const input = asObject(value, 'item');

  const id = providedId ?? requiredString(input.id, 'id');
  const name = requiredString(input.name, 'name');
  const isMagic = optionalBoolean(input.isMagic) ?? false;
  const sourceType = asEnum(input.sourceType, sourceTypes, 'sourceType', 'other');
  const sourceRef = normalizeSourceRef(sourceType, input.sourceRef);
  const acquiredAt = optionalIsoDateString(input.acquiredAt);
  const tags = normalizeStringList(input.tags);
  const description = optionalTrimmedString(input.description);
  const notes = optionalTrimmedString(input.notes);
  const isConsumable = optionalBoolean(input.isConsumable);
  const quantityRaw = input.quantity;
  const quantity = quantityRaw === undefined ? undefined : optionalPositiveInt(quantityRaw);

  if (quantityRaw !== undefined && quantity === undefined) {
    throw new DomainValidationError('Invalid value', [
      { path: 'quantity', message: 'Expected a non-negative integer' }
    ]);
  }

  const magicDetails = normalizeMagicDetails(input.magicDetails);

  if (!isMagic && magicDetails) {
    throw new DomainValidationError('Invalid value', [
      { path: 'magicDetails', message: 'magicDetails can only be set when isMagic is true' }
    ]);
  }

  if (!isMagic && optionalBoolean(input.isComplete) === false) {
    throw new DomainValidationError('Invalid value', [
      { path: 'isComplete', message: 'Non-magic items are always complete' }
    ]);
  }

  if (magicDetails?.attuned && !isMagic) {
    throw new DomainValidationError('Invalid value', [
      { path: 'magicDetails.attuned', message: 'Only magic items may be attuned' }
    ]);
  }

  const isComplete = isMagic ? optionalBoolean(input.isComplete) ?? Boolean(magicDetails) : true;

  return {
    id,
    name,
    isMagic,
    isComplete,
    description,
    sourceType,
    sourceRef,
    acquiredAt,
    tags,
    notes,
    quantity,
    isConsumable,
    magicDetails
  };
};

export const normalizeItem = (value: unknown): Item => normalizeItemInternal(value);

export const normalizeItemDraft = (draft: ItemDraft, id: string): Item =>
  normalizeItemInternal(draft, id);

export const normalizeItems = (value: unknown): Item[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeItem(item));
};

export const normalizeSideQuestCatalogEntry = (
  value: unknown,
  providedId?: string
): SideQuestCatalogEntry => {
  const input = asObject(value, 'sideQuestCatalogEntry');

  const id = providedId ?? requiredString(input.id, 'id');
  const name = requiredString(input.name, 'name');
  const status = asEnum(input.status, sideQuestStatuses, 'status', 'manual');

  const thumbnailUrl = optionalTrimmedString(input.thumbnailUrl);
  const sourceUrl = optionalTrimmedString(input.sourceUrl);
  const lastSeenAt = input.lastSeenAt ? optionalIsoDateString(input.lastSeenAt) : undefined;

  return {
    id,
    name,
    thumbnailUrl,
    sourceUrl,
    lastSeenAt,
    status
  };
};

export const normalizeSideQuestCatalog = (value: unknown): SideQuestCatalogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeSideQuestCatalogEntry(entry));
};

export const ensureAttunementLimit = (items: Item[]): void => {
  const attunedCount = items.filter((item) => item.magicDetails?.attuned).length;
  if (attunedCount > 3) {
    throw new DomainValidationError('Attunement limit exceeded', [
      {
        path: 'magicDetails.attuned',
        message: 'No more than 3 items may be attuned at the same time'
      }
    ]);
  }
};
