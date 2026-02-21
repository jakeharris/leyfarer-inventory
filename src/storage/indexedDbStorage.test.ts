import { STORAGE } from '../config/constants';
import { createStorageService, type IndexedDbStorageService } from './indexedDbStorage';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('storageService', () => {
  let storageService: IndexedDbStorageService;

  beforeEach(async () => {
    storageService = createStorageService();
    await storageService.init();
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('initializes and persists schema version marker', async () => {
    const schemaVersion = await storageService.getSchemaVersion();
    expect(schemaVersion).toBe(STORAGE.schemaVersion);
  });

  it('supports write/read/delete primitives', async () => {
    await storageService.write('test-key', { value: 12 });

    const stored = await storageService.read<{ value: number }>('test-key');
    expect(stored?.value).toBe(12);

    await storageService.remove('test-key');

    const missing = await storageService.read('test-key');
    expect(missing).toBeUndefined();
  });
});
