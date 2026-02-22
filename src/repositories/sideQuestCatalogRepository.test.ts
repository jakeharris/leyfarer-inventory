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
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe('Leyline Cart');
  });

  it('repairs corrupt catalog payloads by dropping invalid entries', async () => {
    await storageService.write(STORAGE.keys.sideQuestCatalog, [
      createSideQuestEntryDraft({ id: 'manual-1', name: 'Valid Quest' }),
      { id: 'broken-entry', status: 'manual' },
      42
    ] as never);

    const entries = await repository.list({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('Valid Quest');

    const persisted = await storageService.read<Array<{ id: string }>>(STORAGE.keys.sideQuestCatalog);
    expect(persisted).toHaveLength(1);
    expect(persisted?.[0]?.id).toBe('manual-1');
  });
});
