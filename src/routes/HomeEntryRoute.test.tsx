import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { STORAGE } from '../config/constants';
import { storageService } from '../storage';
import { HomeEntryRoute } from './HomeEntryRoute';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('HomeEntryRoute', () => {
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

  it('redirects first-time users to side quest rewards flow', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          children: [
            { index: true, element: <HomeEntryRoute /> },
            { path: 'side-quest-rewards', element: <p>Side Quest Rewards Flow</p> }
          ]
        }
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Side Quest Rewards Flow')).toBeInTheDocument();
  });

  it('opens inventory after flow has been seen', async () => {
    await storageService.init();
    await storageService.write(STORAGE.keys.sideQuestRewardProgress, {
      flowSeen: true,
      entries: []
    });

    const router = createMemoryRouter(
      [
        {
          path: '/',
          children: [{ index: true, element: <HomeEntryRoute /> }]
        }
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('button', { name: /add item/i })).toBeInTheDocument();
  });
});
