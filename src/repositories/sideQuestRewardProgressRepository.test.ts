import { STORAGE } from '../config/constants';
import { createStorageService, type IndexedDbStorageService } from '../storage/indexedDbStorage';
import { SideQuestRewardProgressRepository } from './sideQuestRewardProgressRepository';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('SideQuestRewardProgressRepository', () => {
  let storageService: IndexedDbStorageService;
  let repository: SideQuestRewardProgressRepository;

  beforeEach(async () => {
    storageService = createStorageService();
    await storageService.init();
    repository = new SideQuestRewardProgressRepository(storageService);
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('tracks flow seen state and quest reward history', async () => {
    const initial = await repository.getState();
    expect(initial.flowSeen).toBe(false);
    expect(initial.entries).toHaveLength(0);

    await repository.setFlowSeen(true);
    await repository.upsertQuestStatus('quest-1', 'Beneath the Brewery', {
      notYetDone: false,
      rewardItemNames: ['Clockwork Token']
    });
    await repository.upsertQuestStatus('quest-1', 'Beneath the Brewery', {
      rewardItemNames: ['clockwork token', 'Mossy Key']
    });

    const updated = await repository.getState();
    expect(updated.flowSeen).toBe(true);
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0]?.rewardItemHistory).toEqual(['Clockwork Token', 'Mossy Key']);
  });

  it('repairs invalid stored payloads', async () => {
    await storageService.write(STORAGE.keys.sideQuestRewardProgress, {
      flowSeen: 'invalid',
      entries: [{ questId: 'bad-entry' }, 42]
    } as never);

    const state = await repository.getState();
    expect(state.flowSeen).toBe(false);
    expect(state.entries).toHaveLength(0);
  });
});
