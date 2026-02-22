import { STORAGE } from '../config/constants';
import type { SideQuestRewardProgressState } from '../domain/types';
import { sanitizeStoredSideQuestRewardProgress } from '../domain/sanitizers';
import { normalizeSideQuestRewardProgressState } from '../domain/validators';
import type { StorageService } from '../storage';

const SIDE_QUEST_REWARD_PROGRESS_KEY = STORAGE.keys.sideQuestRewardProgress;

const normalizeHistory = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const normalizedKey = name.toLowerCase();
    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    result.push(name);
  }

  return result;
};

export class SideQuestRewardProgressRepository {
  constructor(private readonly storageService: StorageService) {}

  async getState(): Promise<SideQuestRewardProgressState> {
    const raw = await this.storageService.read(SIDE_QUEST_REWARD_PROGRESS_KEY);
    const sanitized = sanitizeStoredSideQuestRewardProgress(raw);

    if (sanitized.changed) {
      await this.writeState(sanitized.value);
    }

    return sanitized.value;
  }

  async setFlowSeen(flowSeen: boolean): Promise<SideQuestRewardProgressState> {
    const current = await this.getState();
    const next = normalizeSideQuestRewardProgressState({
      ...current,
      flowSeen
    });
    await this.writeState(next);
    return next;
  }

  async upsertQuestStatus(
    questId: string,
    questName: string,
    options: { notYetDone?: boolean; rewardItemNames?: string[] }
  ): Promise<SideQuestRewardProgressState> {
    const current = await this.getState();
    const now = new Date().toISOString();
    const index = current.entries.findIndex((entry) => entry.questId === questId);
    const existing = index >= 0 ? current.entries[index] : undefined;
    const mergedHistory = normalizeHistory([
      ...(existing?.rewardItemHistory ?? []),
      ...(options.rewardItemNames ?? [])
    ]);

    const nextEntry = {
      questId,
      questName: questName.trim() || existing?.questName || questId,
      notYetDone: options.notYetDone ?? existing?.notYetDone ?? false,
      rewardItemHistory: mergedHistory,
      updatedAt: now
    };

    const nextEntries =
      index >= 0
        ? current.entries.map((entry, entryIndex) => (entryIndex === index ? nextEntry : entry))
        : [...current.entries, nextEntry];

    const next = normalizeSideQuestRewardProgressState({
      ...current,
      entries: nextEntries
    });
    await this.writeState(next);
    return next;
  }

  private async writeState(state: SideQuestRewardProgressState): Promise<void> {
    await this.storageService.write(SIDE_QUEST_REWARD_PROGRESS_KEY, state);
  }
}

export const createSideQuestRewardProgressRepository = (
  storageService: StorageService
): SideQuestRewardProgressRepository => new SideQuestRewardProgressRepository(storageService);
