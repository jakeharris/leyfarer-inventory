import { STORAGE } from '../config/constants';
import { normalizeItems } from '../domain/validators';

const toPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });

const readFromStore = async <T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> => {
  const tx = db.transaction(storeName, 'readonly');
  const value = await toPromise(tx.objectStore(storeName).get(key));
  await transactionDone(tx);
  return value as T | undefined;
};

const writeToStore = async (
  db: IDBDatabase,
  storeName: string,
  key: string,
  value: unknown
): Promise<void> => {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value, key);
  await transactionDone(tx);
};

export interface StorageMigration {
  from: number;
  to: number;
  migrate: (db: IDBDatabase) => Promise<void>;
}

const migrateV1ToV2: StorageMigration = {
  from: 1,
  to: 2,
  migrate: async (db) => {
    const items = await readFromStore<unknown>(db, STORAGE.stores.kv, STORAGE.keys.items);
    if (!items) {
      return;
    }

    const normalized = normalizeItems(items);
    await writeToStore(db, STORAGE.stores.kv, STORAGE.keys.items, normalized);
  }
};

export const storageMigrations: StorageMigration[] = [migrateV1ToV2];

const findMigration = (fromVersion: number): StorageMigration | undefined =>
  storageMigrations.find((migration) => migration.from === fromVersion);

export const runStorageMigrations = async (db: IDBDatabase): Promise<void> => {
  const persistedVersion = await readFromStore<number>(
    db,
    STORAGE.stores.meta,
    STORAGE.keys.schemaVersion
  );

  if (persistedVersion === undefined) {
    await writeToStore(db, STORAGE.stores.meta, STORAGE.keys.schemaVersion, STORAGE.schemaVersion);
    return;
  }

  if (persistedVersion > STORAGE.schemaVersion) {
    throw new Error(
      `Persisted schema version ${persistedVersion} is newer than app schema ${STORAGE.schemaVersion}`
    );
  }

  let currentVersion = persistedVersion;

  while (currentVersion < STORAGE.schemaVersion) {
    const migration = findMigration(currentVersion);
    if (!migration) {
      throw new Error(`No migration registered for schema version ${currentVersion}`);
    }

    await migration.migrate(db);
    currentVersion = migration.to;
    await writeToStore(db, STORAGE.stores.meta, STORAGE.keys.schemaVersion, currentVersion);
  }
};
