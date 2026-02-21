import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORAGE } from '../config/constants';
import { storageService } from '../storage';
import { HomeRoute } from './HomeRoute';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE.dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
    request.onblocked = () => reject(new Error('Deleting test database was blocked'));
  });

describe('HomeRoute', () => {
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

  it('shows magic fields only when magic item is enabled', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);

    await user.click(await screen.findByRole('button', { name: /add item/i }));
    await screen.findByRole('heading', { name: /quick add item/i });
    expect(screen.queryByRole('group', { name: /magic details/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /magic item/i }));
    expect(screen.getByRole('group', { name: /magic details/i })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /magic item/i }));
    expect(screen.queryByRole('group', { name: /magic details/i })).not.toBeInTheDocument();
  });

  it('filters to incomplete magic items with needs details toggle', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);
    await screen.findByRole('button', { name: /add item/i });

    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Traveler Rope');
    await user.click(screen.getByRole('button', { name: /save item/i }));
    await waitFor(() => expect(screen.getByText('Traveler Rope')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Unknown Relic');
    await user.click(screen.getByRole('checkbox', { name: /magic item/i }));
    await user.click(screen.getByRole('button', { name: /save item/i }));
    await waitFor(() => expect(screen.getByText('Unknown Relic')).toBeInTheDocument());

    expect(screen.getByText('Needs Details')).toBeInTheDocument();
    expect(screen.getByText('Traveler Rope')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /needs details only/i }));
    await waitFor(() => expect(screen.queryByText('Traveler Rope')).not.toBeInTheDocument());
    expect(screen.getByText('Unknown Relic')).toBeInTheDocument();
  });

  it('edits an existing item without dropping optional fields', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);
    await screen.findByRole('button', { name: /add item/i });

    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Moon Charm');
    await user.click(screen.getByRole('button', { name: /show optional fields/i }));
    await user.type(screen.getByRole('textbox', { name: /source ref/i }), '10.2');
    await user.type(screen.getByRole('textbox', { name: /^description$/i }), 'Old keepsake');
    await user.click(screen.getByRole('button', { name: /save item/i }));
    await waitFor(() => expect(screen.getByText('Moon Charm')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameInput = screen.getByRole('textbox', { name: /^name$/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'Moon Charm (Renamed)');
    await user.click(screen.getByRole('button', { name: /update item/i }));

    await waitFor(() => expect(screen.getByText('Moon Charm (Renamed)')).toBeInTheDocument());
    expect(screen.getByText('other - 10.2')).toBeInTheDocument();
    expect(screen.getByText('Old keepsake')).toBeInTheDocument();
  });
});
