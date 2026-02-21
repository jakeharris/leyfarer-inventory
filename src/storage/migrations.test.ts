import { STORAGE } from '../config/constants';
import { createStorageService, type IndexedDbStorageService } from './indexedDbStorage';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

const seedVersionOneData = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(STORAGE.dbName, STORAGE.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE.stores.kv)) {
        db.createObjectStore(STORAGE.stores.kv);
      }
      if (!db.objectStoreNames.contains(STORAGE.stores.meta)) {
        db.createObjectStore(STORAGE.stores.meta);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction([STORAGE.stores.meta, STORAGE.stores.kv], 'readwrite');
      const meta = tx.objectStore(STORAGE.stores.meta);
      const kv = tx.objectStore(STORAGE.stores.kv);

      meta.put(1, STORAGE.keys.schemaVersion);
      kv.put(
        [
          {
            id: 'legacy-item',
            name: 'Legacy Wand',
            isMagic: true,
            sourceType: 'mainSession',
            sourceRef: '10.03',
            tags: [' wand ']
          }
        ],
        STORAGE.keys.items
      );

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed v1 data'));
      tx.onabort = () => reject(tx.error ?? new Error('Seeding v1 data aborted'));
    };

    request.onerror = () => reject(request.error ?? new Error('Failed to open test database'));
  });
};

describe('runStorageMigrations', () => {
  let storageService: IndexedDbStorageService;

  beforeEach(async () => {
    await deleteDb();
    await seedVersionOneData();
    storageService = createStorageService();
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('upgrades legacy schema and normalizes legacy item payloads', async () => {
    await storageService.init();

    const schemaVersion = await storageService.getSchemaVersion();
    expect(schemaVersion).toBe(STORAGE.schemaVersion);

    const items = await storageService.read<Array<Record<string, unknown>>>(STORAGE.keys.items);
    expect(items).toHaveLength(1);
    expect(items?.[0].isComplete).toBe(false);
    expect(items?.[0].sourceRef).toBe('10.3');
    expect(items?.[0].tags).toEqual(['wand']);
  });
});
