import { STORAGE } from '../config/constants';
import { DomainValidationError } from '../domain/validators';
import { createItemDraft, resetFactoryIds } from '../test/factories';
import { createStorageService, type IndexedDbStorageService } from '../storage/indexedDbStorage';
import { ItemRepository } from './itemRepository';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('ItemRepository', () => {
  let storageService: IndexedDbStorageService;
  let repository: ItemRepository;

  beforeEach(async () => {
    resetFactoryIds();
    storageService = createStorageService();
    await storageService.init();
    repository = new ItemRepository(storageService);
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('supports create/read/update/delete flow', async () => {
    const created = await repository.create(createItemDraft({ sourceType: 'mainSession', sourceRef: '08.2' }));
    expect(created.sourceRef).toBe('8.2');

    const found = await repository.getById(created.id);
    expect(found?.name).toBe(created.name);

    const updated = await repository.update(created.id, { name: 'Renamed Item' });
    expect(updated.name).toBe('Renamed Item');

    await repository.remove(created.id);
    const missing = await repository.getById(created.id);
    expect(missing).toBeUndefined();
  });

  it('supports list query filters', async () => {
    await repository.create(
      createItemDraft({
        name: 'Potion of Healing',
        isConsumable: true,
        quantity: 4,
        isMagic: false,
        magicDetails: undefined,
        sourceType: 'other',
        tags: ['potion']
      })
    );

    await repository.create(
      createItemDraft({
        name: 'Attuned Amulet',
        sourceType: 'sideQuest',
        isComplete: true,
        magicDetails: { requiresAttunement: true, attuned: true }
      })
    );

    await repository.create(
      createItemDraft({
        name: 'Unidentified Relic',
        isComplete: false,
        sourceType: 'sideQuest',
        magicDetails: undefined
      })
    );

    const consumables = await repository.list({ isConsumable: true });
    expect(consumables).toHaveLength(1);

    const attuned = await repository.list({ isAttuned: true });
    expect(attuned).toHaveLength(1);

    const needsDetails = await repository.list({ needsDetails: true });
    expect(needsDetails).toHaveLength(1);

    const bySearch = await repository.list({ search: 'potion' });
    expect(bySearch).toHaveLength(1);
  });

  it('enforces attunement max of three', async () => {
    for (const index of [1, 2, 3]) {
      await repository.create(
        createItemDraft({
          name: `Attuned-${index}`,
          magicDetails: { requiresAttunement: true, attuned: true }
        })
      );
    }

    await expect(
      repository.create(
        createItemDraft({ name: 'Attuned-4', magicDetails: { requiresAttunement: true, attuned: true } })
      )
    ).rejects.toThrow(DomainValidationError);
  });

  it('supports replacing an attuned item when slots are full', async () => {
    const one = await repository.create(
      createItemDraft({ name: 'Attuned-1', magicDetails: { requiresAttunement: true, attuned: true } })
    );
    const two = await repository.create(
      createItemDraft({ name: 'Attuned-2', magicDetails: { requiresAttunement: true, attuned: true } })
    );
    const three = await repository.create(
      createItemDraft({ name: 'Attuned-3', magicDetails: { requiresAttunement: true, attuned: true } })
    );
    const candidate = await repository.create(
      createItemDraft({ name: 'Candidate', magicDetails: { requiresAttunement: true, attuned: false } })
    );

    await repository.replaceAttunedItem(candidate.id, two.id);

    const attunedItems = await repository.list({ isAttuned: true });
    expect(attunedItems.map((item) => item.name).sort()).toEqual(
      [one.name, three.name, candidate.name].sort()
    );
  });

  it('decrements consumables and removes at zero', async () => {
    const stack = await repository.create(
      createItemDraft({
        name: 'Potion Stack',
        isMagic: false,
        magicDetails: undefined,
        isConsumable: true,
        quantity: 2
      })
    );

    const single = await repository.create(
      createItemDraft({
        name: 'Potion Single',
        isMagic: false,
        magicDetails: undefined,
        isConsumable: true,
        quantity: 1
      })
    );

    const updated = await repository.spendConsumable(stack.id);
    expect(updated?.quantity).toBe(1);

    const removed = await repository.spendConsumable(single.id);
    expect(removed).toBeUndefined();

    const remaining = await repository.list({ isConsumable: true });
    expect(remaining).toHaveLength(1);
    const firstRemaining = remaining[0];
    expect(firstRemaining).toBeDefined();
    expect(firstRemaining?.id).toBe(stack.id);
    expect(firstRemaining?.quantity).toBe(1);
  });

  it('repairs corrupt stored payloads by dropping invalid entries and detuning overflow attuned items', async () => {
    await storageService.write(STORAGE.keys.items, [
      createItemDraft({ id: 'attuned-1', name: 'Attuned One', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItemDraft({ id: 'attuned-2', name: 'Attuned Two', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItemDraft({ id: 'attuned-3', name: 'Attuned Three', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItemDraft({ id: 'attuned-4', name: 'Attuned Four', magicDetails: { requiresAttunement: true, attuned: true } }),
      { id: 'broken-entry', isMagic: true },
      'invalid'
    ] as never);

    const items = await repository.list({});
    expect(items).toHaveLength(4);

    const attuned = items.filter((item) => item.magicDetails?.attuned);
    expect(attuned).toHaveLength(3);
    expect(items.find((item) => item.id === 'attuned-4')?.magicDetails?.attuned).toBe(false);

    const persisted = await storageService.read<Array<{ id: string }>>(STORAGE.keys.items);
    expect(persisted).toHaveLength(4);
    expect(persisted?.some((item) => item.id === 'broken-entry')).toBe(false);
  });
});
