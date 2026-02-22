import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { STORAGE } from '../config/constants';
import { createItem } from '../test/factories';
import { createStorageService, type IndexedDbStorageService } from '../storage/indexedDbStorage';
import { createTransferService, PortableTransferError } from './transferService';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('TransferService', () => {
  let storageService: IndexedDbStorageService;

  beforeEach(async () => {
    storageService = createStorageService();
    await storageService.init();
  });

  afterEach(async () => {
    await storageService.close();
    await deleteDb();
  });

  it('exports JSON payload with reward progress and restores with replace strategy', async () => {
    const item = createItem({ id: 'item-a', name: 'Moon Charm' });

    await storageService.write(STORAGE.keys.items, [item]);
    await storageService.write(STORAGE.keys.sideQuestRewardProgress, {
      flowSeen: true,
      entries: [
        {
          questId: 'quest-a',
          questName: 'Beneath the Brewery',
          notYetDone: false,
          rewardItemHistory: ['Moon Charm'],
          updatedAt: new Date().toISOString()
        }
      ]
    });

    const transfer = createTransferService(storageService);
    const exportedJson = await transfer.exportJson();
    const parsed = JSON.parse(exportedJson) as Record<string, unknown>;

    expect(parsed.items).toBeTruthy();
    expect(parsed.sideQuestRewardProgress).toBeTruthy();

    await storageService.write(STORAGE.keys.items, []);
    await storageService.write(STORAGE.keys.sideQuestRewardProgress, {
      flowSeen: false,
      entries: []
    });

    const result = await transfer.importJson(exportedJson, 'replace');
    expect(result.strategy).toBe('replace');
    expect(result.importedItems).toBe(1);

    const restoredItems = (await storageService.read(STORAGE.keys.items)) as Array<{ name: string }>;
    expect(restoredItems).toHaveLength(1);
    expect(restoredItems[0]?.name).toBe('Moon Charm');

    const restoredProgress = (await storageService.read(STORAGE.keys.sideQuestRewardProgress)) as {
      flowSeen: boolean;
      entries: Array<{ questId: string }>;
    };
    expect(restoredProgress.flowSeen).toBe(true);
    expect(restoredProgress.entries[0]?.questId).toBe('quest-a');
  });

  it('migrates schema v1 payloads during import', async () => {
    const transfer = createTransferService(storageService);

    const legacyPayload = JSON.stringify({
      schemaVersion: 1,
      items: [
        {
          id: 'legacy-item',
          name: 'Legacy Wand',
          isMagic: true,
          sourceType: 'other',
          isComplete: true,
          tags: []
        }
      ]
    });

    const result = await transfer.importJson(legacyPayload, 'replace');
    expect(result.importedItems).toBe(1);

    const restoredItems = (await storageService.read(STORAGE.keys.items)) as Array<{ id: string }>;
    expect(restoredItems[0]?.id).toBe('legacy-item');
  });

  it('accepts legacy schema v2 payloads while importing items only', async () => {
    const transfer = createTransferService(storageService);

    const legacyV2Payload = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      items: [createItem({ id: 'legacy-v2', name: 'Legacy V2 Item' })],
      sideQuestCatalog: [{ id: 'quest-1', name: 'Should Be Ignored', status: 'manual' }],
      sideQuestCatalogSyncState: {
        status: 'success',
        fetchedCount: 1,
        errorCount: 0
      }
    };

    const result = await transfer.importPayload(legacyV2Payload, 'replace');
    expect(result.importedItems).toBe(1);

    const restoredItems = (await storageService.read(STORAGE.keys.items)) as Array<{ id: string }>;
    expect(restoredItems[0]?.id).toBe('legacy-v2');
  });

  it('applies deterministic merge strategy where incoming ids overwrite existing', async () => {
    const transfer = createTransferService(storageService);

    await storageService.write(STORAGE.keys.items, [
      createItem({ id: 'shared', name: 'Old Name' }),
      createItem({ id: 'local-only', name: 'Local Only' })
    ]);
    await storageService.write(STORAGE.keys.sideQuestRewardProgress, {
      flowSeen: false,
      entries: [
        {
          questId: 'quest-shared',
          questName: 'Shared Local',
          notYetDone: true,
          rewardItemHistory: [],
          updatedAt: new Date().toISOString()
        },
        {
          questId: 'quest-local',
          questName: 'Local Quest',
          notYetDone: false,
          rewardItemHistory: ['Local Reward'],
          updatedAt: new Date().toISOString()
        }
      ]
    });

    const incomingPayload = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      items: [
        createItem({ id: 'shared', name: 'Incoming Name' }),
        createItem({ id: 'incoming-only', name: 'Incoming Only' })
      ],
      sideQuestRewardProgress: {
        flowSeen: true,
        entries: [
          {
            questId: 'quest-shared',
            questName: 'Shared Incoming',
            notYetDone: false,
            rewardItemHistory: ['Incoming Reward'],
            updatedAt: new Date().toISOString()
          },
          {
            questId: 'quest-incoming',
            questName: 'Incoming Quest',
            notYetDone: false,
            rewardItemHistory: ['Incoming Only'],
            updatedAt: new Date().toISOString()
          }
        ]
      }
    };

    const result = await transfer.importPayload(incomingPayload, 'merge');
    expect(result.importedItems).toBe(3);

    const mergedItems = (await storageService.read(STORAGE.keys.items)) as Array<{
      id: string;
      name: string;
    }>;

    expect(mergedItems).toHaveLength(3);
    expect(mergedItems.find((item) => item.id === 'shared')?.name).toBe('Incoming Name');
    expect(mergedItems.find((item) => item.id === 'local-only')).toBeTruthy();
    expect(mergedItems.find((item) => item.id === 'incoming-only')).toBeTruthy();

    const mergedProgress = (await storageService.read(STORAGE.keys.sideQuestRewardProgress)) as {
      flowSeen: boolean;
      entries: Array<{ questId: string; questName: string }>;
    };
    expect(mergedProgress.flowSeen).toBe(true);
    expect(mergedProgress.entries).toHaveLength(3);
    expect(mergedProgress.entries.find((entry) => entry.questId === 'quest-shared')?.questName).toBe(
      'Shared Incoming'
    );
  });

  it('round-trips payload through QR chunk encoding/decoding', async () => {
    const transfer = createTransferService(storageService);
    const payload = {
      schemaVersion: 4 as const,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      items: [
        createItem({ id: 'item-1', name: 'Traveler Rope' }),
        createItem({ id: 'item-2', name: 'Storm Flask' })
      ],
      sideQuestRewardProgress: {
        flowSeen: true,
        entries: []
      }
    };

    const chunks = transfer.encodePayloadToQrChunks(payload, 120);
    expect(chunks.length).toBeGreaterThan(1);

    const decoded = transfer.decodePayloadFromQrChunks(chunks.join('\n'));
    expect(decoded.items).toHaveLength(2);
    expect(decoded.items[0]?.name).toBe('Traveler Rope');
  });

  it('fails with explicit error when a QR chunk is missing', async () => {
    const transfer = createTransferService(storageService);
    const payload = {
      schemaVersion: 4 as const,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      items: [createItem({ id: 'item-1', name: 'Traveler Rope' })],
      sideQuestRewardProgress: {
        flowSeen: false,
        entries: []
      }
    };

    const chunks = transfer.encodePayloadToQrChunks(payload, 120);
    const missingLastChunk = chunks.slice(0, -1).join('\n');

    expect(() => transfer.decodePayloadFromQrChunks(missingLastChunk)).toThrow(PortableTransferError);
    expect(() => transfer.decodePayloadFromQrChunks(missingLastChunk)).toThrow(/Missing QR chunk/);
  });

  it('exports by repairing corrupt persisted items and keeping only valid entries', async () => {
    const transfer = createTransferService(storageService);

    await storageService.write(STORAGE.keys.items, [
      createItem({ id: 'attuned-1', name: 'Attuned One', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItem({ id: 'attuned-2', name: 'Attuned Two', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItem({ id: 'attuned-3', name: 'Attuned Three', magicDetails: { requiresAttunement: true, attuned: true } }),
      createItem({ id: 'attuned-4', name: 'Attuned Four', magicDetails: { requiresAttunement: true, attuned: true } }),
      { id: 'broken-entry' },
      'invalid'
    ] as never);

    const payload = await transfer.exportPayload();
    expect(payload.items).toHaveLength(4);
    expect(payload.items.filter((item) => item.magicDetails?.attuned)).toHaveLength(3);
    expect(payload.items.find((item) => item.id === 'attuned-4')?.magicDetails?.attuned).toBe(false);

    const persisted = await storageService.read<Array<{ id: string }>>(STORAGE.keys.items);
    expect(persisted).toHaveLength(4);
    expect(persisted?.some((item) => item.id === 'broken-entry')).toBe(false);
  });
});
