import { createItem, createSideQuestEntry } from '../test/factories';
import {
  DomainValidationError,
  ensureAttunementLimit,
  isMagicItemComplete,
  normalizeItem,
  normalizeSideQuestCatalogEntry,
  normalizeSideQuestRewardProgressState,
  parseMainSessionRef
} from './validators';

describe('parseMainSessionRef', () => {
  it('normalizes valid source refs', () => {
    expect(parseMainSessionRef(' 09.3 ')).toEqual({
      chapter: 9,
      session: 3,
      normalized: '9.3'
    });
  });

  it('rejects invalid chapter/session ranges', () => {
    expect(() => parseMainSessionRef('17.1')).toThrow(DomainValidationError);
    expect(() => parseMainSessionRef('10.7')).toThrow(DomainValidationError);
  });

  it('rejects invalid format', () => {
    expect(() => parseMainSessionRef('chapter 10 session 2')).toThrow(DomainValidationError);
  });
});

describe('normalizeItem', () => {
  it('normalizes source refs and defaults non-magic items to complete', () => {
    const item = normalizeItem({
      ...createItem(),
      isMagic: false,
      magicDetails: undefined,
      isComplete: true,
      sourceType: 'mainSession',
      sourceRef: '10.03'
    });

    expect(item.sourceRef).toBe('10.3');
    expect(item.isComplete).toBe(true);
  });

  it('marks magic item incomplete when details are missing', () => {
    const item = normalizeItem({
      id: 'a',
      name: 'Unknown Wand',
      isMagic: true,
      sourceType: 'other',
      tags: []
    });

    expect(item.isComplete).toBe(false);
  });

  it('computes magic completeness from meaningful detail fields', () => {
    expect(isMagicItemComplete(undefined)).toBe(false);
    expect(isMagicItemComplete({})).toBe(false);
    expect(isMagicItemComplete({ rarity: 'Rare' })).toBe(true);
    expect(isMagicItemComplete({ requiresAttunement: false })).toBe(false);
    expect(isMagicItemComplete({ requiresAttunement: true })).toBe(true);
    expect(isMagicItemComplete({ spells: [{ name: 'Shield' }] })).toBe(true);
    expect(isMagicItemComplete({ saveDc: 14 })).toBe(false);
    expect(isMagicItemComplete({ saveDc: 14, saveAbility: 'WIS' })).toBe(true);
  });

  it('rejects non-magic items with magic details', () => {
    expect(() =>
      normalizeItem({
        ...createItem(),
        isMagic: false
      })
    ).toThrow(DomainValidationError);
  });
});

describe('normalizeSideQuestCatalogEntry', () => {
  it('normalizes valid entries', () => {
    const entry = normalizeSideQuestCatalogEntry(createSideQuestEntry({ name: '  Hollow Barrel  ' }));

    expect(entry.name).toBe('Hollow Barrel');
    expect(entry.status).toBe('manual');
  });
});

describe('ensureAttunementLimit', () => {
  it('rejects collections with more than 3 attuned items', () => {
    expect(() =>
      ensureAttunementLimit([
        createItem({ id: '1', magicDetails: { requiresAttunement: true, attuned: true } }),
        createItem({ id: '2', magicDetails: { requiresAttunement: true, attuned: true } }),
        createItem({ id: '3', magicDetails: { requiresAttunement: true, attuned: true } }),
        createItem({ id: '4', magicDetails: { requiresAttunement: true, attuned: true } })
      ])
    ).toThrow(DomainValidationError);
  });
});

describe('normalizeSideQuestRewardProgressState', () => {
  it('defaults missing payload to empty state', () => {
    const state = normalizeSideQuestRewardProgressState(undefined);
    expect(state).toEqual({
      flowSeen: false,
      entries: []
    });
  });

  it('normalizes reward progress entries', () => {
    const state = normalizeSideQuestRewardProgressState({
      flowSeen: true,
      entries: [
        {
          questId: 'quest-1',
          questName: '  Beneath the Brewery ',
          notYetDone: false,
          rewardItemHistory: [' Clockwork Token ', ''],
          updatedAt: new Date().toISOString()
        }
      ]
    });

    expect(state.flowSeen).toBe(true);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.questName).toBe('Beneath the Brewery');
    expect(state.entries[0]?.rewardItemHistory).toEqual(['Clockwork Token']);
  });
});
