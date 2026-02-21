import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Item, ItemDraft, MagicItemDetails, SaveAbility, SourceType } from '../domain/types';
import { isMagicItemComplete } from '../domain/validators';
import { createItemRepository } from '../repositories';
import { storageService } from '../storage';

interface FormState {
  name: string;
  sourceType: SourceType;
  sourceRef: string;
  description: string;
  tags: string;
  notes: string;
  isMagic: boolean;
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

const defaultFormState = (): FormState => ({
  name: '',
  sourceType: 'other',
  sourceRef: '',
  description: '',
  tags: '',
  notes: '',
  isMagic: false,
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

const toFormState = (item: Item): FormState => ({
  name: item.name,
  sourceType: item.sourceType,
  sourceRef: item.sourceRef ?? '',
  description: item.description ?? '',
  tags: item.tags.join(', '),
  notes: item.notes ?? '',
  isMagic: item.isMagic,
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

  return {
    name: form.name.trim(),
    isMagic: form.isMagic,
    isComplete: form.isMagic ? isMagicItemComplete(magicDetails) : true,
    description: form.description.trim() || undefined,
    sourceType: form.sourceType,
    sourceRef: form.sourceRef.trim() || undefined,
    tags: splitCsv(form.tags),
    notes: form.notes.trim() || undefined,
    magicDetails
  };
};

type LoadState = 'loading' | 'ready' | 'error';

export const HomeRoute = () => {
  const repository = useMemo(() => createItemRepository(storageService), []);
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<FormState>(() => defaultFormState());
  const [needsDetailsOnly, setNeedsDetailsOnly] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (filterNeedsDetails: boolean): Promise<void> => {
      const nextItems = await repository.list(filterNeedsDetails ? { needsDetails: true } : {});
      setItems(nextItems);
    },
    [repository]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await storageService.init();
        if (cancelled) {
          return;
        }
        await loadItems(needsDetailsOnly);
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
  }, [loadItems, needsDetailsOnly]);

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
      await loadItems(needsDetailsOnly);
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
    setError(null);
  };

  const closeComposer = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowComposer(false);
    setShowExtraFields(false);
    setError(null);
  };

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
          <p data-testid="shell-status">{items.length} item(s)</p>
        </div>
        <button type="button" onClick={startAdd}>
          Add Item
        </button>
      </header>

      <div className="inventory-controls">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={needsDetailsOnly}
            onChange={(event) => setNeedsDetailsOnly(event.target.checked)}
          />
          Needs Details Only
        </label>
      </div>

      {items.length > 0 ? (
        <ul className="item-list" aria-label="Inventory items">
          {items.map((item) => (
            <li key={item.id} className="item-card">
              <div className="item-card__header">
                <strong>{item.name}</strong>
                {item.isMagic && !item.isComplete ? (
                  <span className="badge badge-warning">Needs Details</span>
                ) : null}
              </div>
              <p>
                {item.sourceType}
                {item.sourceRef ? ` - ${item.sourceRef}` : ''}
              </p>
              {item.description ? <p>{item.description}</p> : null}
              <button type="button" className="button-secondary" onClick={() => onEdit(item)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No items yet. Use Add Item to capture loot quickly.</p>
      )}

      {showComposer ? (
        <form className="item-form" onSubmit={onSave}>
          <div className="composer-header">
            <h3>{editingId ? 'Edit Item' : 'Quick Add Item'}</h3>
            <button type="button" className="button-secondary" onClick={closeComposer}>
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

          <button
            type="button"
            className="button-secondary"
            onClick={() => setShowExtraFields((prev) => !prev)}
          >
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
    </section>
  );
};
