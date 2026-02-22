import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SideQuestCatalogEntry, SideQuestRewardProgressEntry } from '../domain/types';
import {
  createItemRepository,
  createSideQuestCatalogRepository,
  createSideQuestRewardProgressRepository
} from '../repositories';
import { createSideQuestCatalogSyncService } from '../services/sideQuestCatalogSyncService';
import { storageService } from '../storage';

interface QuestRewardFormState {
  rewardName: string;
  isMagic: boolean;
  isConsumable: boolean;
  quantity: string;
  notes: string;
}

const defaultQuestRewardFormState = (): QuestRewardFormState => ({
  rewardName: '',
  isMagic: false,
  isConsumable: false,
  quantity: '1',
  notes: ''
});

const toNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

type LoadState = 'loading' | 'ready' | 'error';

export const SideQuestRewardsRoute = () => {
  const navigate = useNavigate();
  const itemRepository = useMemo(() => createItemRepository(storageService), []);
  const sideQuestCatalogRepository = useMemo(() => createSideQuestCatalogRepository(storageService), []);
  const sideQuestRewardProgressRepository = useMemo(
    () => createSideQuestRewardProgressRepository(storageService),
    []
  );
  const sideQuestCatalogSyncService = useMemo(
    () => createSideQuestCatalogSyncService(storageService),
    []
  );
  const [status, setStatus] = useState<LoadState>('loading');
  const [catalogEntries, setCatalogEntries] = useState<SideQuestCatalogEntry[]>([]);
  const [progressEntries, setProgressEntries] = useState<SideQuestRewardProgressEntry[]>([]);
  const [questForms, setQuestForms] = useState<Record<string, QuestRewardFormState>>({});
  const [manualQuestName, setManualQuestName] = useState('');
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const [savePendingByQuest, setSavePendingByQuest] = useState<Record<string, boolean>>({});

  const loadCatalog = useCallback(async (): Promise<void> => {
    const nextEntries = await sideQuestCatalogRepository.list({});
    setCatalogEntries(nextEntries.sort((left, right) => left.name.localeCompare(right.name)));
  }, [sideQuestCatalogRepository]);

  const loadProgress = useCallback(async (): Promise<void> => {
    const nextState = await sideQuestRewardProgressRepository.getState();
    setProgressEntries(nextState.entries);
  }, [sideQuestRewardProgressRepository]);

  const refreshCatalog = useCallback(async (): Promise<void> => {
    setRefreshPending(true);
    setError(null);
    try {
      const syncState = await sideQuestCatalogSyncService.refreshCatalog();
      setCatalogNotice(syncState.message ?? 'Catalog refreshed.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to refresh side quest catalog');
      setCatalogNotice('Catalog refresh failed. Add manual quests below if needed.');
    } finally {
      await loadCatalog();
      setRefreshPending(false);
    }
  }, [loadCatalog, sideQuestCatalogSyncService]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await storageService.init();
        if (cancelled) {
          return;
        }

        await sideQuestRewardProgressRepository.setFlowSeen(true);
        await refreshCatalog();
        await loadProgress();
        if (!cancelled) {
          setStatus('ready');
        }
      } catch (nextError) {
        if (!cancelled) {
          setStatus('error');
          setError(nextError instanceof Error ? nextError.message : 'Unable to open side quest rewards flow');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadProgress, refreshCatalog, sideQuestRewardProgressRepository]);

  const progressByQuestId = useMemo(
    () => new Map(progressEntries.map((entry) => [entry.questId, entry])),
    [progressEntries]
  );

  const needsRewardCount = useMemo(
    () =>
      catalogEntries.filter((entry) => {
        const progress = progressByQuestId.get(entry.id);
        if (progress?.notYetDone) {
          return false;
        }
        return (progress?.rewardItemHistory.length ?? 0) === 0;
      }).length,
    [catalogEntries, progressByQuestId]
  );

  const getQuestForm = (questId: string): QuestRewardFormState =>
    questForms[questId] ?? defaultQuestRewardFormState();

  const onUpdateQuestForm = (
    questId: string,
    patch: Partial<QuestRewardFormState>
  ) => {
    setQuestForms((prev) => ({
      ...prev,
      [questId]: {
        ...(prev[questId] ?? defaultQuestRewardFormState()),
        ...patch
      }
    }));
  };

  const onToggleNotYetDone = async (entry: SideQuestCatalogEntry, checked: boolean) => {
    setError(null);
    setNotice(null);
    try {
      await sideQuestRewardProgressRepository.upsertQuestStatus(entry.id, entry.name, {
        notYetDone: checked
      });
      await loadProgress();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update side quest status');
    }
  };

  const onSaveQuestReward = async (entry: SideQuestCatalogEntry) => {
    const questForm = getQuestForm(entry.id);
    const rewardName = questForm.rewardName.trim();
    if (!rewardName) {
      setError(`Enter a reward item name for ${entry.name}`);
      return;
    }

    const progress = progressByQuestId.get(entry.id);
    if (progress?.notYetDone) {
      setError(`Mark ${entry.name} as done before adding rewards.`);
      return;
    }

    setSavePendingByQuest((prev) => ({ ...prev, [entry.id]: true }));
    setError(null);
    setNotice(null);
    try {
      await itemRepository.create({
        name: rewardName,
        isMagic: questForm.isMagic,
        isComplete: questForm.isMagic ? false : true,
        sourceType: 'sideQuest',
        sourceRef: entry.name,
        tags: [],
        notes: questForm.notes.trim() || undefined,
        isConsumable: questForm.isConsumable,
        quantity: questForm.isConsumable ? toNumber(questForm.quantity) ?? 1 : undefined
      });

      await sideQuestRewardProgressRepository.upsertQuestStatus(entry.id, entry.name, {
        notYetDone: false,
        rewardItemNames: [rewardName]
      });

      await loadProgress();
      setQuestForms((prev) => ({
        ...prev,
        [entry.id]: defaultQuestRewardFormState()
      }));
      setNotice(`Saved reward for ${entry.name}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save reward');
    } finally {
      setSavePendingByQuest((prev) => ({ ...prev, [entry.id]: false }));
    }
  };

  const onSaveManualQuest = async () => {
    const name = manualQuestName.trim();
    if (!name) {
      setError('Enter a side quest name before adding a manual quest.');
      return;
    }

    setError(null);
    setNotice(null);
    try {
      await sideQuestCatalogRepository.upsert({
        name,
        status: 'manual'
      });
      await loadCatalog();
      setManualQuestName('');
      setNotice(`Added manual quest "${name}".`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save manual side quest');
    }
  };

  const onExitFlow = async () => {
    try {
      await sideQuestRewardProgressRepository.setFlowSeen(true);
    } catch {
      // Continue to inventory even if persistence update fails.
    }
    await navigate('/');
  };

  if (status === 'loading') {
    return (
      <section className="panel">
        <h2>Add Rewards</h2>
        <p>Loading side quest setup...</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="panel">
        <div className="side-quest-rewards-header">
          <h2>Add Rewards</h2>
          <button type="button" className="button-secondary" onClick={() => void onExitFlow()}>
            Skip
          </button>
        </div>
        <p>Unable to open side quest setup: {error}</p>
      </section>
    );
  }

  return (
    <section className="panel side-quest-rewards-panel">
      <header className="side-quest-rewards-header">
        <div>
          <h2>Add Rewards</h2>
          <p>
            Enter one reward per side quest. Mark quests as not yet done until they are played.
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={() => void onExitFlow()}>
          Skip
        </button>
      </header>

      <div className="side-quest-rewards-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => void refreshCatalog()}
          disabled={refreshPending}
        >
          {refreshPending ? 'Refreshing...' : 'Refresh Catalog'}
        </button>
      </div>

      {catalogNotice ? <p className="catalog-sync-text">{catalogNotice}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p className="catalog-sync-text">{notice}</p> : null}

      {catalogEntries.length === 0 ? (
        <p className="empty-state">No side quests loaded yet. Add a manual side quest below.</p>
      ) : (
        <ul className="item-list" aria-label="Side quest rewards">
          {catalogEntries.map((entry) => {
            const progress = progressByQuestId.get(entry.id);
            const isNotYetDone = Boolean(progress?.notYetDone);
            const hasReward = (progress?.rewardItemHistory.length ?? 0) > 0;
            const questForm = getQuestForm(entry.id);
            const isSaving = Boolean(savePendingByQuest[entry.id]);
            return (
              <li
                key={entry.id}
                className={`item-card side-quest-reward-card${isNotYetDone ? ' side-quest-reward-card--inactive' : ''}`}
              >
                <div className="item-card__header">
                  <strong>{entry.name}</strong>
                  <span className={`badge ${isNotYetDone ? 'badge-catalog-stale' : hasReward ? 'badge-catalog-manual' : 'badge-catalog-fetched'}`}>
                    {isNotYetDone ? 'Not Yet Done' : hasReward ? 'Reward Entered' : 'Needs Reward'}
                  </span>
                </div>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={isNotYetDone}
                    onChange={(event) => void onToggleNotYetDone(entry, event.target.checked)}
                  />
                  Not yet done
                </label>

                <label className="field">
                  Reward Item Name
                  <input
                    value={questForm.rewardName}
                    onChange={(event) => onUpdateQuestForm(entry.id, { rewardName: event.target.value })}
                    disabled={isNotYetDone}
                  />
                </label>

                <div className="field-grid">
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={questForm.isMagic}
                      onChange={(event) => onUpdateQuestForm(entry.id, { isMagic: event.target.checked })}
                      disabled={isNotYetDone}
                    />
                    Magic Reward
                  </label>
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={questForm.isConsumable}
                      onChange={(event) => onUpdateQuestForm(entry.id, { isConsumable: event.target.checked })}
                      disabled={isNotYetDone}
                    />
                    Consumable
                  </label>
                </div>

                {questForm.isConsumable ? (
                  <label className="field">
                    Quantity
                    <input
                      inputMode="numeric"
                      value={questForm.quantity}
                      onChange={(event) => onUpdateQuestForm(entry.id, { quantity: event.target.value })}
                      disabled={isNotYetDone}
                    />
                  </label>
                ) : null}

                <label className="field">
                  Notes
                  <textarea
                    rows={2}
                    value={questForm.notes}
                    onChange={(event) => onUpdateQuestForm(entry.id, { notes: event.target.value })}
                    disabled={isNotYetDone}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" disabled={isNotYetDone || isSaving} onClick={() => void onSaveQuestReward(entry)}>
                    {isSaving ? 'Saving...' : 'Save Reward'}
                  </button>
                </div>

                {progress?.rewardItemHistory.length ? (
                  <p className="catalog-sync-text">
                    Recorded rewards: {progress.rewardItemHistory.join(', ')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section className="catalog-panel">
        <h3>Manual Side Quest Entry</h3>
        <p className="catalog-sync-text">
          Use this if catalog load fails or you need to track a quest not in the snapshot.
        </p>
        <div className="field-grid">
          <label className="field">
            Side Quest Name
            <input
              value={manualQuestName}
              onChange={(event) => setManualQuestName(event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={() => void onSaveManualQuest()}>
            Add Manual Quest
          </button>
        </div>
      </section>

      {catalogEntries.length > 0 && needsRewardCount === 0 ? (
        <p className="side-quest-complete-banner">
          All listed side quests are configured. You can still edit entries any time.
        </p>
      ) : null}

      <div className="side-quest-rewards-float">
        <button type="button" onClick={() => void onExitFlow()}>
          See your inventory
        </button>
      </div>
    </section>
  );
};
