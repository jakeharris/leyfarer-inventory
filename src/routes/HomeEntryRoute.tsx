import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createSideQuestRewardProgressRepository } from '../repositories';
import { storageService } from '../storage';
import { HomeRoute } from './HomeRoute';

type EntryState = 'loading' | 'showHome' | 'showRewards' | 'error';

export const HomeEntryRoute = () => {
  const sideQuestRewardProgressRepository = useMemo(
    () => createSideQuestRewardProgressRepository(storageService),
    []
  );
  const [state, setState] = useState<EntryState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await storageService.init();
        if (cancelled) {
          return;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('skipRewards') === '1') {
          await sideQuestRewardProgressRepository.setFlowSeen(true);
          if (!cancelled) {
            setState('showHome');
          }
          return;
        }

        const progressState = await sideQuestRewardProgressRepository.getState();
        if (cancelled) {
          return;
        }

        setState(progressState.flowSeen ? 'showHome' : 'showRewards');
      } catch (nextError) {
        if (!cancelled) {
          setState('error');
          setError(nextError instanceof Error ? nextError.message : 'Unable to initialize app');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [sideQuestRewardProgressRepository]);

  if (state === 'loading') {
    return (
      <section className="panel">
        <h2>Inventory</h2>
        <p>Loading local inventory...</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="panel">
        <h2>Inventory</h2>
        <p>Storage unavailable: {error}</p>
      </section>
    );
  }

  if (state === 'showRewards') {
    return <Navigate to="/side-quest-rewards" replace />;
  }

  return <HomeRoute />;
};
