import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { STORAGE } from '../config/constants';
import { storageService } from '../storage';
import { SideQuestRewardsRoute } from './SideQuestRewardsRoute';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('SideQuestRewardsRoute', () => {
  const resetStorage = async () => {
    await storageService.close();
    await deleteDb();
  };

  beforeEach(async () => {
    await resetStorage();
  });

  afterEach(async () => {
    await resetStorage();
  });

  it('marks the flow as seen, tracks not-yet-done, and saves rewards', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/side-quest-rewards']}>
        <Routes>
          <Route path="/side-quest-rewards" element={<SideQuestRewardsRoute />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /add rewards/i });
    await waitFor(async () => {
      const progress = await storageService.read<{ flowSeen: boolean }>(STORAGE.keys.sideQuestRewardProgress);
      expect(progress?.flowSeen).toBe(true);
    });

    const sideQuestList = await screen.findByRole('list', { name: /side quest rewards/i });
    const firstQuest = within(sideQuestList).getAllByRole('listitem')[0];
    expect(firstQuest).toBeDefined();
    await user.click(within(firstQuest as HTMLElement).getByRole('checkbox', { name: /not yet done/i }));
    await waitFor(() =>
      expect(within(firstQuest as HTMLElement).getByText('Not Yet Done')).toBeInTheDocument()
    );

    await user.click(within(firstQuest as HTMLElement).getByRole('checkbox', { name: /not yet done/i }));
    await user.type(within(firstQuest as HTMLElement).getByRole('textbox', { name: /reward item name/i }), 'Lantern Gem');
    await user.click(within(firstQuest as HTMLElement).getByRole('button', { name: /save reward/i }));

    await waitFor(() =>
      expect(within(firstQuest as HTMLElement).getByText(/recorded rewards: lantern gem/i)).toBeInTheDocument()
    );
    const items = await storageService.read<Array<{ name: string }>>(STORAGE.keys.items);
    expect(items?.some((item) => item.name === 'Lantern Gem')).toBe(true);
  });

  it('navigates back to inventory from skip and floating button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/side-quest-rewards']}>
        <Routes>
          <Route path="/" element={<p>Main Inventory</p>} />
          <Route path="/side-quest-rewards" element={<SideQuestRewardsRoute />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: /^skip$/i });
    await user.click(screen.getByRole('button', { name: /^skip$/i }));
    expect(await screen.findByText('Main Inventory')).toBeInTheDocument();
  });
});
