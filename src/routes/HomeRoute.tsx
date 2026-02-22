import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  Item,
  ItemDraft,
  MagicItemDetails,
  SaveAbility,
  SideQuestCatalogEntry,
  SideQuestCatalogSyncState,
  SourceType
} from '../domain/types';
import { isMagicItemComplete } from '../domain/validators';
import { createItemRepository, createSideQuestCatalogRepository } from '../repositories';
import { createSideQuestCatalogSyncService } from '../services/sideQuestCatalogSyncService';
import { storageService } from '../storage';

interface FormState {
  name: string;
  sourceType: SourceType;
  sourceRef: string;
  description: string;
  tags: string;
  notes: string;
  isMagic: boolean;
  isConsumable: boolean;
  quantity: string;
  rarity: string;
  requiresAttunement: boolean;
  attuned: boolean;
  chargesCurrent: string;
  chargesMax: string;
  chargesRecharge: string;
  usesCurrent: string;
  usesMax: string;
  usesResetOn: string;
  saveDc: string;
  saveAbility: string;
  spells: string;
}

interface ListFilters {
  search: string;
  sourceType: SourceType | 'all';
  sourceRef: string;
  attunedOnly: boolean;
  consumableOnly: boolean;
}

interface CatalogFormState {
  id?: string;
  name: string;
  description: string;
  sourceUrl: string;
  thumbnailUrl: string;
}

interface RewardFormState {
  sideQuestId: string;
  rewardNames: string;
  isMagic: boolean;
  isConsumable: boolean;
  quantity: string;
  notes: string;
}

const ALL_SOURCES_VALUE = '__all_sources__';

const defaultFormState = (): FormState => ({
  name: '',
  sourceType: 'other',
  sourceRef: '',
  description: '',
  tags: '',
  notes: '',
  isMagic: false,
  isConsumable: false,
  quantity: '1',
  rarity: '',
  requiresAttunement: false,
  attuned: false,
  chargesCurrent: '',
  chargesMax: '',
  chargesRecharge: '',
  usesCurrent: '',
  usesMax: '',
  usesResetOn: '',
  saveDc: '',
  saveAbility: '',
  spells: ''
});

const defaultFilters = (): ListFilters => ({
  search: '',
  sourceType: 'all',
  sourceRef: ALL_SOURCES_VALUE,
  attunedOnly: false,
  consumableOnly: false
});

const defaultCatalogFormState = (): CatalogFormState => ({
  name: '',
  description: '',
  sourceUrl: '',
  thumbnailUrl: ''
});

const defaultRewardFormState = (): RewardFormState => ({
  sideQuestId: '',
  rewardNames: '',
  isMagic: false,
  isConsumable: false,
  quantity: '1',
  notes: ''
});

const defaultSyncState = (): SideQuestCatalogSyncState => ({
  status: 'idle',
  fetchedCount: 0,
  errorCount: 0
});

const toNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const splitLines = (value: string): string[] =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const includesNeedle = (value: string | undefined, needle: string): boolean =>
  Boolean(value && value.toLowerCase().includes(needle));

const isAttunedItem = (item: Item): boolean => Boolean(item.magicDetails?.attuned);
const isConsumableItem = (item: Item): boolean => Boolean(item.isConsumable);

const formatTimestamp = (value: string | undefined): string => {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const sortInventoryItems = (left: Item, right: Item): number => {
  const leftPriority = isAttunedItem(left) ? 0 : isConsumableItem(left) ? 1 : 2;
  const rightPriority = isAttunedItem(right) ? 0 : isConsumableItem(right) ? 1 : 2;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.name.localeCompare(right.name);
};

const toFormState = (item: Item): FormState => ({
  name: item.name,
  sourceType: item.sourceType,
  sourceRef: item.sourceRef ?? '',
  description: item.description ?? '',
  tags: item.tags.join(', '),
  notes: item.notes ?? '',
  isMagic: item.isMagic,
  isConsumable: Boolean(item.isConsumable),
  quantity: String(item.quantity ?? 1),
  rarity: item.magicDetails?.rarity ?? '',
  requiresAttunement: Boolean(item.magicDetails?.requiresAttunement),
  attuned: Boolean(item.magicDetails?.attuned),
  chargesCurrent:
    item.magicDetails?.charges?.current !== undefined ? String(item.magicDetails.charges.current) : '',
  chargesMax: item.magicDetails?.charges?.max !== undefined ? String(item.magicDetails.charges.max) : '',
  chargesRecharge: item.magicDetails?.charges?.recharge ?? '',
  usesCurrent:
    item.magicDetails?.usesPerDay?.current !== undefined
      ? String(item.magicDetails.usesPerDay.current)
      : '',
  usesMax:
    item.magicDetails?.usesPerDay?.max !== undefined ? String(item.magicDetails.usesPerDay.max) : '',
  usesResetOn: item.magicDetails?.usesPerDay?.resetOn ?? '',
  saveDc: item.magicDetails?.saveDc !== undefined ? String(item.magicDetails.saveDc) : '',
  saveAbility: item.magicDetails?.saveAbility ?? '',
  spells: item.magicDetails?.spells?.map((spell) => spell.name).join(', ') ?? ''
});

const buildMagicDetails = (form: FormState): MagicItemDetails | undefined => {
  if (!form.isMagic) {
    return undefined;
  }

  const chargesCurrent = toNumber(form.chargesCurrent);
  const chargesMax = toNumber(form.chargesMax);
  const usesCurrent = toNumber(form.usesCurrent);
  const usesMax = toNumber(form.usesMax);
  const saveDc = toNumber(form.saveDc);
  const saveAbility = form.saveAbility.trim() as SaveAbility | '';
  const spellNames = splitCsv(form.spells);
  const rarity = form.rarity.trim();
  const recharge = form.chargesRecharge.trim();
  const resetOn = form.usesResetOn.trim();

  const charges =
    chargesCurrent !== undefined
      ? {
          current: chargesCurrent,
          max: chargesMax,
          recharge: recharge || undefined
        }
      : undefined;

  const usesPerDay =
    usesCurrent !== undefined && usesMax !== undefined && resetOn
      ? {
          current: usesCurrent,
          max: usesMax,
          resetOn
        }
      : undefined;

  return {
    rarity: rarity || undefined,
    requiresAttunement: form.requiresAttunement,
    attuned: form.requiresAttunement ? form.attuned : false,
    charges,
    usesPerDay,
    saveDc,
    saveAbility: saveAbility || undefined,
    spells: spellNames.length > 0 ? spellNames.map((name) => ({ name })) : undefined
  };
};

const toDraft = (form: FormState): ItemDraft => {
  const magicDetails = buildMagicDetails(form);
  const parsedQuantity = toNumber(form.quantity);

  return {
    name: form.name.trim(),
    isMagic: form.isMagic,
    isComplete: form.isMagic ? isMagicItemComplete(magicDetails) : true,
    description: form.description.trim() || undefined,
    sourceType: form.sourceType,
    sourceRef: form.sourceRef.trim() || undefined,
    tags: splitCsv(form.tags),
    notes: form.notes.trim() || undefined,
    isConsumable: form.isConsumable,
    quantity: form.isConsumable ? parsedQuantity ?? 1 : undefined,
    magicDetails
  };
};

type LoadState = 'loading' | 'ready' | 'error';

export const HomeRoute = () => {
  const repository = useMemo(() => createItemRepository(storageService), []);
  const sideQuestCatalogRepository = useMemo(() => createSideQuestCatalogRepository(storageService), []);
  const sideQuestCatalogSyncService = useMemo(
    () => createSideQuestCatalogSyncService(storageService),
    []
  );
  const [items, setItems] = useState<Item[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<SideQuestCatalogEntry[]>([]);
  const [syncState, setSyncState] = useState<SideQuestCatalogSyncState>(() => defaultSyncState());
  const [form, setForm] = useState<FormState>(() => defaultFormState());
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(() => defaultCatalogFormState());
  const [rewardForm, setRewardForm] = useState<RewardFormState>(() => defaultRewardFormState());
  const [filters, setFilters] = useState<ListFilters>(() => defaultFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showRewardComposer, setShowRewardComposer] = useState(false);
  const [showCatalogManager, setShowCatalogManager] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [showCatalogEditor, setShowCatalogEditor] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [attunementTargetId, setAttunementTargetId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState<string>('');
  const [catalogRefreshPending, setCatalogRefreshPending] = useState(false);
  const [status, setStatus] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (): Promise<void> => {
    const nextItems = await repository.list({});
    setItems(nextItems);
  }, [repository]);

  const loadCatalogEntries = useCallback(async (): Promise<void> => {
    const nextEntries = await sideQuestCatalogRepository.list({});
    setCatalogEntries(nextEntries.sort((left, right) => left.name.localeCompare(right.name)));
  }, [sideQuestCatalogRepository]);

  const loadSyncState = useCallback(async (): Promise<void> => {
    const nextState = await sideQuestCatalogSyncService.getSyncState();
    setSyncState(nextState);
  }, [sideQuestCatalogSyncService]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await storageService.init();
        if (cancelled) {
          return;
        }
        await loadItems();
        await loadCatalogEntries();
        await loadSyncState();
        if (!cancelled) {
          setStatus('ready');
        }
      } catch (nextError) {
        if (!cancelled) {
          setStatus('error');
          setError(nextError instanceof Error ? nextError.message : 'Failed to load inventory');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadCatalogEntries, loadItems, loadSyncState]);

  const sourceRefOptions = useMemo(() => {
    const refs = items
      .filter((item) => (filters.sourceType === 'all' ? true : item.sourceType === filters.sourceType))
      .map((item) => item.sourceRef)
      .filter((sourceRef): sourceRef is string => Boolean(sourceRef));

    return Array.from(new Set(refs)).sort((left, right) => left.localeCompare(right));
  }, [filters.sourceType, items]);

  useEffect(() => {
    if (filters.sourceRef === ALL_SOURCES_VALUE) {
      return;
    }

    if (!sourceRefOptions.includes(filters.sourceRef)) {
      setFilters((prev) => ({ ...prev, sourceRef: ALL_SOURCES_VALUE }));
    }
  }, [filters.sourceRef, sourceRefOptions]);

  const attunedItems = useMemo(
    () => items.filter((item) => Boolean(item.magicDetails?.attuned)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const searchNeedle = filters.search.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.sourceType !== 'all' && item.sourceType !== filters.sourceType) {
        return false;
      }

      if (filters.sourceRef !== ALL_SOURCES_VALUE && item.sourceRef !== filters.sourceRef) {
        return false;
      }

      if (filters.attunedOnly && !item.magicDetails?.attuned) {
        return false;
      }

      if (filters.consumableOnly && !item.isConsumable) {
        return false;
      }

      if (!searchNeedle) {
        return true;
      }

      const tagMatch = item.tags.some((tag) => tag.toLowerCase().includes(searchNeedle));

      return (
        includesNeedle(item.name, searchNeedle) ||
        includesNeedle(item.sourceRef, searchNeedle) ||
        includesNeedle(item.description, searchNeedle) ||
        includesNeedle(item.notes, searchNeedle) ||
        tagMatch
      );
    });
  }, [filters, items]);

  const sortedFilteredItems = useMemo(
    () => [...filteredItems].sort(sortInventoryItems),
    [filteredItems]
  );

  const hasSearch = filters.search.trim().length > 0;

  const groupedItems = useMemo(
    () =>
      [
        {
          key: 'attuned',
          title: 'Attuned Items',
          items: sortedFilteredItems.filter((item) => isAttunedItem(item))
        },
        {
          key: 'consumables',
          title: 'Consumables',
          items: sortedFilteredItems.filter((item) => !isAttunedItem(item) && isConsumableItem(item))
        },
        {
          key: 'other',
          title: 'Other Items',
          items: sortedFilteredItems.filter((item) => !isAttunedItem(item) && !isConsumableItem(item))
        }
      ].filter((section) => section.items.length > 0),
    [sortedFilteredItems]
  );

  const hasActiveFilters =
    filters.sourceType !== 'all' ||
    filters.sourceRef !== ALL_SOURCES_VALUE ||
    filters.attunedOnly ||
    filters.consumableOnly;

  const filteredCatalogEntries = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) {
      return catalogEntries;
    }

    return catalogEntries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        Boolean(entry.sourceUrl?.toLowerCase().includes(needle))
    );
  }, [catalogEntries, catalogSearch]);
  const hasCatalogSearch = catalogSearch.trim().length > 0;

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const draft = toDraft(form);
      if (editingId) {
        await repository.update(editingId, draft);
      } else {
        await repository.create(draft);
      }
      setForm(defaultFormState());
      setEditingId(null);
      setShowComposer(false);
      setShowExtraFields(false);
      await loadItems();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save item');
    }
  };

  const onEdit = (item: Item) => {
    setEditingId(item.id);
    setForm(toFormState(item));
    setShowExtraFields(true);
    setShowComposer(true);
    setError(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowExtraFields(false);
    setShowComposer(true);
    setShowRewardComposer(false);
    setError(null);
  };

  const closeComposer = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowComposer(false);
    setShowExtraFields(false);
    setError(null);
  };

  const onToggleAttunement = async (item: Item) => {
    if (!item.isMagic || !item.magicDetails?.requiresAttunement) {
      return;
    }

    setError(null);

    try {
      if (item.magicDetails?.attuned) {
        await repository.setAttuned(item.id, false);
        await loadItems();
        return;
      }

      if (attunedItems.length < 3) {
        await repository.setAttuned(item.id, true);
        await loadItems();
        return;
      }

      setAttunementTargetId(item.id);
      setReplacementId(attunedItems[0]?.id ?? '');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update attunement');
    }
  };

  const closeAttunementModal = () => {
    setAttunementTargetId(null);
    setReplacementId('');
  };

  const onRequestRemove = (item: Item) => {
    setError(null);
    setRemoveTargetId(item.id);
  };

  const closeRemoveModal = () => {
    setRemoveTargetId(null);
  };

  const onConfirmRemove = async () => {
    if (!removeTargetId) {
      return;
    }

    setError(null);

    try {
      await repository.remove(removeTargetId);
      if (editingId === removeTargetId) {
        closeComposer();
      }
      if (attunementTargetId === removeTargetId) {
        closeAttunementModal();
      }
      closeRemoveModal();
      await loadItems();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to remove item');
    }
  };

  const onConfirmReplacement = async () => {
    if (!attunementTargetId || !replacementId) {
      return;
    }

    setError(null);

    try {
      await repository.replaceAttunedItem(attunementTargetId, replacementId);
      closeAttunementModal();
      await loadItems();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to replace attuned item');
    }
  };

  const onSpendConsumable = async (item: Item) => {
    if (!item.isConsumable) {
      return;
    }

    setError(null);

    try {
      await repository.spendConsumable(item.id);
      await loadItems();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to spend consumable');
    }
  };

  const onRefreshCatalog = async () => {
    setCatalogRefreshPending(true);
    setError(null);

    try {
      const nextState = await sideQuestCatalogSyncService.refreshCatalog();
      setSyncState(nextState);
      await loadCatalogEntries();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to refresh side quest catalog');
    } finally {
      setCatalogRefreshPending(false);
    }
  };

  const onSaveCatalogEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await sideQuestCatalogRepository.upsert({
        id: catalogForm.id,
        name: catalogForm.name,
        description: catalogForm.description.trim() || undefined,
        sourceUrl: catalogForm.sourceUrl.trim() || undefined,
        thumbnailUrl: catalogForm.thumbnailUrl.trim() || undefined,
        status: 'manual'
      });

      setCatalogForm(defaultCatalogFormState());
      setShowCatalogEditor(false);
      await loadCatalogEntries();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save catalog entry');
    }
  };

  const onEditCatalogEntry = (entry: SideQuestCatalogEntry) => {
    setCatalogForm({
      id: entry.id,
      name: entry.name,
      description: entry.description ?? '',
      sourceUrl: entry.sourceUrl ?? '',
      thumbnailUrl: entry.thumbnailUrl ?? ''
    });
    setShowCatalogEditor(true);
  };

  const startCatalogEntry = () => {
    setCatalogForm(defaultCatalogFormState());
    setShowCatalogEditor(true);
  };

  const closeCatalogEditor = () => {
    setCatalogForm(defaultCatalogFormState());
    setShowCatalogEditor(false);
  };

  const closeRewardComposer = () => {
    setRewardForm(defaultRewardFormState());
    setShowRewardComposer(false);
  };

  const onSaveRewards = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const selectedQuest = catalogEntries.find((entry) => entry.id === rewardForm.sideQuestId);
    if (!selectedQuest) {
      setError('Choose a side quest before saving rewards');
      return;
    }

    const rewardNames = splitLines(rewardForm.rewardNames);
    if (rewardNames.length === 0) {
      setError('Enter at least one reward item name');
      return;
    }

    try {
      for (const rewardName of rewardNames) {
        await repository.create({
          name: rewardName,
          isMagic: rewardForm.isMagic,
          isComplete: rewardForm.isMagic ? false : true,
          sourceType: 'sideQuest',
          sourceRef: selectedQuest.name,
          tags: [],
          notes: rewardForm.notes.trim() || undefined,
          isConsumable: rewardForm.isConsumable,
          quantity: rewardForm.isConsumable ? toNumber(rewardForm.quantity) ?? 1 : undefined
        });
      }

      closeRewardComposer();
      await loadItems();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save reward items');
    }
  };

  const renderItemCard = (item: Item) => {
    const isAttunable = item.isMagic && Boolean(item.magicDetails?.requiresAttunement);
    const quantity = item.quantity ?? 1;

    return (
      <li key={item.id} className="item-card">
        <div className="item-card__header">
          <strong>{item.name}</strong>
          <div className="badge-row">
            {item.isMagic && !item.isComplete ? <span className="badge badge-warning">Needs Details</span> : null}
            {item.magicDetails?.attuned ? <span className="badge badge-attuned">Attuned</span> : null}
            {item.isConsumable ? <span className="badge badge-consumable">x{quantity}</span> : null}
          </div>
        </div>

        <p>
          {item.sourceType}
          {item.sourceRef ? ` - ${item.sourceRef}` : ''}
        </p>

        {item.description ? <p>{item.description}</p> : null}
        {item.tags.length > 0 ? (
          <div className="tag-pills" aria-label="Item tags">
            {item.tags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="item-actions">
          <button type="button" onClick={() => onEdit(item)}>
            Edit
          </button>

          <button type="button" className="button-secondary" onClick={() => onRequestRemove(item)}>
            Remove
          </button>

          {isAttunable ? (
            <button type="button" onClick={() => void onToggleAttunement(item)}>
              {item.magicDetails?.attuned ? 'Unattune' : 'Attune'}
            </button>
          ) : null}

          {item.isConsumable ? (
            <button type="button" onClick={() => void onSpendConsumable(item)}>
              Spend 1
            </button>
          ) : null}
        </div>

        {item.notes ? (
          <details className="item-details" open>
            <summary>Notes</summary>
            <div className="item-details__content">
              <p>{item.notes}</p>
            </div>
          </details>
        ) : null}
      </li>
    );
  };

  const attunementTarget = attunementTargetId
    ? items.find((item) => item.id === attunementTargetId) ?? null
    : null;
  const removeTarget = removeTargetId ? items.find((item) => item.id === removeTargetId) ?? null : null;

  if (status === 'loading') {
    return (
      <section className="panel">
        <h2>Inventory</h2>
        <p>Loading local inventory...</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="panel">
        <h2>Inventory</h2>
        <p>Storage unavailable: {error}</p>
      </section>
    );
  }

  return (
    <section className="panel inventory-panel">
      <header className="inventory-header">
        <div>
          <h2>Inventory</h2>
          <p data-testid="shell-status">
            {sortedFilteredItems.length} shown / {items.length} total
          </p>
        </div>
        <div className="inventory-header__actions">
          <button
            type="button"
            onClick={() => {
              setShowComposer(false);
              setShowRewardComposer(true);
            }}
          >
            Add Rewards
          </button>
          <button type="button" onClick={startAdd}>
            Add Item
          </button>
        </div>
      </header>

      <div className="inventory-controls inventory-controls--compact">
        <div className="search-filter-row">
          <input
            type="search"
            aria-label="Search inventory"
            placeholder="Search by name, notes, tags..."
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <button
            type="button"
            className="search-filter-row__button"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters
          </button>
        </div>

        <div className="inventory-controls__actions">
          {hasActiveFilters ? (
            <button type="button" onClick={() => setFilters(defaultFilters())}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <section className="filters-modal" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="composer-header">
            <h3>Filters</h3>
            <div className="form-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowCatalogManager((prev) => !prev)}
              >
                {showCatalogManager ? 'Hide Catalog' : 'Catalog'}
              </button>
              <button type="button" onClick={() => setShowFilters(false)}>
                Done
              </button>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              Quest type
              <select
                value={filters.sourceType}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sourceType: event.target.value as SourceType | 'all',
                    sourceRef: ALL_SOURCES_VALUE
                  }))
                }
              >
                <option value="all">All</option>
                <option value="mainSession">Main Session</option>
                <option value="sideQuest">Side Quest</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="field">
              Quest
              <select
                value={filters.sourceRef}
                onChange={(event) => setFilters((prev) => ({ ...prev, sourceRef: event.target.value }))}
              >
                <option value={ALL_SOURCES_VALUE}>All</option>
                {sourceRefOptions.map((sourceRef) => (
                  <option key={sourceRef} value={sourceRef}>
                    {sourceRef}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={filters.attunedOnly}
              onChange={(event) => setFilters((prev) => ({ ...prev, attunedOnly: event.target.checked }))}
            />
            Attuned Only
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={filters.consumableOnly}
              onChange={(event) => setFilters((prev) => ({ ...prev, consumableOnly: event.target.checked }))}
            />
            Consumables Only
          </label>
        </section>
      ) : null}

      {showCatalogManager ? (
        <section className="catalog-panel" aria-label="Side quest catalog">
          <div className="composer-header">
            <h3>Side Quest Catalog</h3>
            <div className="form-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void onRefreshCatalog()}
                disabled={catalogRefreshPending}
              >
                {catalogRefreshPending ? 'Refreshing...' : 'Refresh Catalog'}
              </button>
              <button type="button" className="button-secondary" onClick={startCatalogEntry}>
                Manual Entry
              </button>
              <button type="button" onClick={() => setShowCatalogManager(false)}>
                Close
              </button>
            </div>
          </div>

          <p className="catalog-sync-text">
            Status: <strong>{syncState.status}</strong> | Last Refresh: {formatTimestamp(syncState.lastRefreshAt)}
            {syncState.errorCount > 0 ? ` | Source Errors: ${syncState.errorCount}` : ''}
          </p>
          {syncState.message ? <p className="catalog-sync-text">{syncState.message}</p> : null}

          <label className="field">
            Search Catalog
            <input
              type="search"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Search side quests..."
            />
          </label>

          {hasCatalogSearch && filteredCatalogEntries.length > 0 ? (
            <ul className="item-list" aria-label="Catalog entries">
              {filteredCatalogEntries.map((entry) => (
                <li key={entry.id} className="item-card">
                  <div className="item-card__header">
                    <strong>{entry.name}</strong>
                    <span className={`badge badge-catalog-${entry.status}`}>{entry.status}</span>
                  </div>
                  <p>{entry.description ?? 'No description available.'}</p>
                  <div className="item-actions">
                    <button type="button" onClick={() => onEditCatalogEntry(entry)}>
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : hasCatalogSearch ? (
            <p className="empty-state">No side quest catalog entries yet.</p>
          ) : (
            <p className="empty-state">Search to view side quest catalog entries.</p>
          )}

          {showCatalogEditor ? (
            <form className="item-form catalog-editor" onSubmit={onSaveCatalogEntry}>
              <div className="composer-header">
                <h3>{catalogForm.id ? 'Edit Catalog Entry' : 'Manual Side Quest Entry'}</h3>
                <button type="button" onClick={closeCatalogEditor}>
                  Close
                </button>
              </div>
              <label className="field">
                Name
                <input
                  required
                  value={catalogForm.name}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="field">
                Description
                <textarea
                  rows={3}
                  value={catalogForm.description}
                  onChange={(event) =>
                    setCatalogForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                Source URL
                <input
                  value={catalogForm.sourceUrl}
                  onChange={(event) =>
                    setCatalogForm((prev) => ({ ...prev, sourceUrl: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                Thumbnail URL
                <input
                  value={catalogForm.thumbnailUrl}
                  onChange={(event) =>
                    setCatalogForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))
                  }
                />
              </label>
              <div className="form-actions">
                <button type="submit">Save Manual Entry</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {showRewardComposer ? (
        <form className="item-form reward-form" onSubmit={onSaveRewards}>
          <div className="composer-header">
            <h3>Add Side Quest Rewards</h3>
            <div className="form-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowCatalogManager((prev) => !prev)}
              >
                {showCatalogManager ? 'Hide Catalog' : 'Catalog'}
              </button>
              <button type="button" onClick={closeRewardComposer}>
                Close
              </button>
            </div>
          </div>

          <label className="field">
            Side Quest
            <select
              required
              value={rewardForm.sideQuestId}
              onChange={(event) => setRewardForm((prev) => ({ ...prev, sideQuestId: event.target.value }))}
            >
              <option value="">Select a side quest</option>
              {catalogEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Reward Item Names (one per line)
            <textarea
              required
              rows={3}
              value={rewardForm.rewardNames}
              onChange={(event) => setRewardForm((prev) => ({ ...prev, rewardNames: event.target.value }))}
            />
          </label>

          <div className="field-grid">
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={rewardForm.isMagic}
                onChange={(event) => setRewardForm((prev) => ({ ...prev, isMagic: event.target.checked }))}
              />
              Magic Rewards
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={rewardForm.isConsumable}
                onChange={(event) =>
                  setRewardForm((prev) => ({ ...prev, isConsumable: event.target.checked }))
                }
              />
              Consumable Rewards
            </label>
          </div>

          {rewardForm.isConsumable ? (
            <label className="field">
              Quantity (each reward)
              <input
                inputMode="numeric"
                value={rewardForm.quantity}
                onChange={(event) => setRewardForm((prev) => ({ ...prev, quantity: event.target.value }))}
              />
            </label>
          ) : null}

          <label className="field">
            Notes
            <textarea
              rows={2}
              value={rewardForm.notes}
              onChange={(event) => setRewardForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>

          <div className="form-actions">
            <button type="submit">Save Rewards</button>
          </div>
        </form>
      ) : null}

      {sortedFilteredItems.length > 0 ? (
        hasSearch ? (
          <ul className="item-list" aria-label="Inventory items">
            {sortedFilteredItems.map((item) => renderItemCard(item))}
          </ul>
        ) : (
          <div className="inventory-sections">
            {groupedItems.map((section) => (
              <section key={section.key} className="inventory-section">
                <h3>{section.title}</h3>
                <ul className="item-list" aria-label={`${section.title} items`}>
                  {section.items.map((item) => renderItemCard(item))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : (
        <p className="empty-state">No items match the current filters.</p>
      )}

      {attunementTarget ? (
        <section className="attunement-modal" role="dialog" aria-modal="true" aria-label="Attunement full">
          <h3>Attunement Slots Full</h3>
          <p>
            Choose one attuned item to replace with <strong>{attunementTarget.name}</strong>.
          </p>

          <div className="attunement-replace-list" role="radiogroup" aria-label="Attuned items">
            {attunedItems.map((item) => (
              <label key={item.id} className="checkbox-field">
                <input
                  type="radio"
                  name="attunement-replacement"
                  checked={replacementId === item.id}
                  onChange={() => setReplacementId(item.id)}
                />
                {item.name}
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => void onConfirmReplacement()} disabled={!replacementId}>
              Replace Selected
            </button>
            <button type="button" className="button-secondary" onClick={closeAttunementModal}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {removeTarget ? (
        <section className="attunement-modal" role="dialog" aria-modal="true" aria-label="Remove item">
          <h3>Remove Item?</h3>
          <p>
            Remove <strong>{removeTarget.name}</strong> from inventory?
          </p>

          <div className="form-actions">
            <button type="button" className="button-danger" onClick={() => void onConfirmRemove()}>
              Remove Item
            </button>
            <button type="button" className="button-secondary" onClick={closeRemoveModal}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {showComposer ? (
        <form className="item-form" onSubmit={onSave}>
          <div className="composer-header">
            <h3>{editingId ? 'Edit Item' : 'Quick Add Item'}</h3>
            <button type="button" onClick={closeComposer}>
              Close
            </button>
          </div>

          <label className="field">
            Name
            <input
              required
              name="name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <div className="field-grid">
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={form.isMagic}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isMagic: event.target.checked, attuned: false }))
                }
              />
              Magic Item
            </label>

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={form.isConsumable}
                onChange={(event) => setForm((prev) => ({ ...prev, isConsumable: event.target.checked }))}
              />
              Consumable
            </label>
          </div>

          {form.isConsumable ? (
            <label className="field">
              Quantity
              <input
                inputMode="numeric"
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
              />
            </label>
          ) : null}

          <button type="button" onClick={() => setShowExtraFields((prev) => !prev)}>
            {showExtraFields ? 'Hide Optional Fields' : 'Show Optional Fields'}
          </button>

          {showExtraFields ? (
            <>
              <div className="field-grid">
                <label className="field">
                  Source Type
                  <select
                    value={form.sourceType}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, sourceType: event.target.value as SourceType }))
                    }
                  >
                    <option value="other">Other</option>
                    <option value="mainSession">Main Session</option>
                    <option value="sideQuest">Side Quest</option>
                  </select>
                </label>
                <label className="field">
                  Source Ref
                  <input
                    value={form.sourceRef}
                    onChange={(event) => setForm((prev) => ({ ...prev, sourceRef: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                Description
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <label className="field">
                Tags (comma-separated)
                <input
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
              </label>

              <label className="field">
                Notes
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </>
          ) : null}

          {form.isMagic ? (
            <fieldset className="magic-fields">
              <legend>Magic Details (optional)</legend>
              <label className="field">
                Rarity
                <select
                  value={form.rarity}
                  onChange={(event) => setForm((prev) => ({ ...prev, rarity: event.target.value }))}
                >
                  <option value="">Unknown</option>
                  <option value="Common">Common</option>
                  <option value="Uncommon">Uncommon</option>
                  <option value="Rare">Rare</option>
                  <option value="Very Rare">Very Rare</option>
                  <option value="Legendary">Legendary</option>
                  <option value="Artifact">Artifact</option>
                  <option value="Varies">Varies</option>
                </select>
              </label>

              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={form.requiresAttunement}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      requiresAttunement: event.target.checked,
                      attuned: event.target.checked ? prev.attuned : false
                    }))
                  }
                />
                Requires Attunement
              </label>

              {form.requiresAttunement ? (
                <label className="field checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.attuned}
                    onChange={(event) => setForm((prev) => ({ ...prev, attuned: event.target.checked }))}
                  />
                  Currently Attuned
                </label>
              ) : null}

              <div className="field-grid">
                <label className="field">
                  Charges Current
                  <input
                    inputMode="numeric"
                    value={form.chargesCurrent}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, chargesCurrent: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  Charges Max
                  <input
                    inputMode="numeric"
                    value={form.chargesMax}
                    onChange={(event) => setForm((prev) => ({ ...prev, chargesMax: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                Charge Recharge
                <input
                  value={form.chargesRecharge}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, chargesRecharge: event.target.value }))
                  }
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  Uses/Day Current
                  <input
                    inputMode="numeric"
                    value={form.usesCurrent}
                    onChange={(event) => setForm((prev) => ({ ...prev, usesCurrent: event.target.value }))}
                  />
                </label>
                <label className="field">
                  Uses/Day Max
                  <input
                    inputMode="numeric"
                    value={form.usesMax}
                    onChange={(event) => setForm((prev) => ({ ...prev, usesMax: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                Uses/Day Reset On
                <input
                  value={form.usesResetOn}
                  onChange={(event) => setForm((prev) => ({ ...prev, usesResetOn: event.target.value }))}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  Save DC
                  <input
                    inputMode="numeric"
                    value={form.saveDc}
                    onChange={(event) => setForm((prev) => ({ ...prev, saveDc: event.target.value }))}
                  />
                </label>
                <label className="field">
                  Save Ability
                  <select
                    value={form.saveAbility}
                    onChange={(event) => setForm((prev) => ({ ...prev, saveAbility: event.target.value }))}
                  >
                    <option value="">Unknown</option>
                    <option value="STR">STR</option>
                    <option value="DEX">DEX</option>
                    <option value="CON">CON</option>
                    <option value="INT">INT</option>
                    <option value="WIS">WIS</option>
                    <option value="CHA">CHA</option>
                  </select>
                </label>
              </div>

              <label className="field">
                Spells (comma-separated)
                <input
                  value={form.spells}
                  onChange={(event) => setForm((prev) => ({ ...prev, spells: event.target.value }))}
                />
              </label>
            </fieldset>
          ) : null}

          <div className="form-actions">
            <button type="submit">{editingId ? 'Update Item' : 'Save Item'}</button>
          </div>

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}

      {error && !showComposer ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
