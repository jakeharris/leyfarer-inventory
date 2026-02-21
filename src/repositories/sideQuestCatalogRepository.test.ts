import { STORAGE } from '../config/constants';
import { createSideQuestEntryDraft, resetFactoryIds } from '../test/factories';
import { createStorageService, type IndexedDbStorageService } from '../storage/indexedDbStorage';
import { SideQuestCatalogRepository } from './sideQuestCatalogRepository';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('SideQuestCatalogRepository', () => {
  let storageService: IndexedDbStorageService;
  let repository: SideQuestCatalogRepository;

  beforeEach(async () => {
    resetFactoryIds();
    storageService = createStorageService();
    await storageService.init();
    repository = new SideQuestCatalogRepository(storageService);
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('supports upsert/get/list/remove', async () => {
    const created = await repository.upsert(
      createSideQuestEntryDraft({
        name: 'Cask and Compass',
        status: 'fetched'
      })
    );

    const found = await repository.getById(created.id);
    expect(found?.name).toBe('Cask and Compass');

    const updated = await repository.upsert({ id: created.id, status: 'stale' });
    expect(updated.status).toBe('stale');

    const staleEntries = await repository.list({ status: 'stale' });
    expect(staleEntries).toHaveLength(1);

    await repository.remove(created.id);
    const missing = await repository.getById(created.id);
    expect(missing).toBeUndefined();
  });

  it('filters by search text', async () => {
    await repository.upsert(createSideQuestEntryDraft({ name: 'Silent Taproom' }));
    await repository.upsert(createSideQuestEntryDraft({ name: 'Leyline Cart' }));

    const results = await repository.list({ search: 'ley' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Leyline Cart');
  });
});
