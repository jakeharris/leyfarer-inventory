import { useEffect, useState } from 'react';
import { storageService } from '../storage';

export type StorageHealthState =
  | { status: 'loading' }
  | { status: 'ready'; schemaVersion?: number }
  | { status: 'error'; message: string };

export const useStorageHealth = (): StorageHealthState => {
  const [state, setState] = useState<StorageHealthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await storageService.init();
        const schemaVersion = await storageService.getSchemaVersion();
        if (!cancelled) {
          setState({ status: 'ready', schemaVersion });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown storage initialization error'
          });
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
