import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORAGE } from '../config/constants';
import { createItemRepository } from '../repositories';
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
    window.history.replaceState({}, '', '/');
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

  it('supports search and source/filter combinations', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);
    await screen.findByRole('button', { name: /add item/i });

    const addItem = async (options: {
      name: string;
      consumable?: boolean;
      sourceType?: 'other' | 'mainSession' | 'sideQuest';
      sourceRef?: string;
    }) => {
      await user.click(screen.getByRole('button', { name: /add item/i }));
      await screen.findByRole('heading', { name: /quick add item/i });
      const form = screen.getByRole('button', { name: /save item/i }).closest('form');
      expect(form).not.toBeNull();
      const formQueries = within(form as HTMLElement);

      await user.type(formQueries.getByRole('textbox', { name: /^name$/i }), options.name);

      if (options.consumable) {
        await user.click(formQueries.getByRole('checkbox', { name: /^consumable$/i }));
      }

      if (options.sourceType || options.sourceRef) {
        await user.click(formQueries.getByRole('button', { name: /show optional fields/i }));
      }

      if (options.sourceType) {
        await user.selectOptions(formQueries.getByRole('combobox', { name: /source type/i }), options.sourceType);
      }

      if (options.sourceRef) {
        await user.type(formQueries.getByRole('textbox', { name: /source ref/i }), options.sourceRef);
      }

      await user.click(formQueries.getByRole('button', { name: /save item/i }));
    };

    await addItem({ name: 'Healing Potion', consumable: true });
    await addItem({ name: 'Moon Charm', sourceType: 'mainSession', sourceRef: '10.2' });
    await addItem({ name: 'Cask Key', sourceType: 'sideQuest', sourceRef: 'Beneath the Brewery' });

    await waitFor(() => expect(screen.getByText('Healing Potion')).toBeInTheDocument());
    expect(screen.getByText('Moon Charm')).toBeInTheDocument();
    expect(screen.getByText('Cask Key')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /consumables/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /other items/i })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'potion');
    await waitFor(() => expect(screen.getByText('Healing Potion')).toBeInTheDocument());
    expect(screen.queryByText('Moon Charm')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /consumables/i })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: /search/i }));
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /^quest type$/i }), 'sideQuest');
    await user.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.getByText('Cask Key')).toBeInTheDocument());
    expect(screen.queryByText('Moon Charm')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('checkbox', { name: /^consumables only$/i }));
    await user.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.queryByText('Cask Key')).not.toBeInTheDocument());
  });

  it('supports replace-or-cancel attunement flow at three slots', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);
    await screen.findByRole('button', { name: /add item/i });

    const addAttunable = async (name: string, attuned: boolean) => {
      await user.click(screen.getByRole('button', { name: /add item/i }));
      await user.type(screen.getByRole('textbox', { name: /^name$/i }), name);
      await user.click(screen.getByRole('checkbox', { name: /magic item/i }));
      await user.click(screen.getByRole('checkbox', { name: /requires attunement/i }));
      if (attuned) {
        await user.click(screen.getByRole('checkbox', { name: /currently attuned/i }));
      }
      await user.click(screen.getByRole('button', { name: /save item/i }));
      await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
    };

    await addAttunable('Attuned One', true);
    await addAttunable('Attuned Two', true);
    await addAttunable('Attuned Three', true);
    await addAttunable('Attuned Four', false);

    const fourthCard = screen.getByText('Attuned Four').closest('li');
    expect(fourthCard).not.toBeNull();
    await user.click(within(fourthCard as HTMLElement).getByRole('button', { name: /^attune$/i }));

    await screen.findByRole('dialog', { name: /attunement full/i });
    await user.click(screen.getByRole('radio', { name: /attuned two/i }));
    await user.click(screen.getByRole('button', { name: /replace selected/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /attunement full/i })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('checkbox', { name: /^attuned only$/i }));
    await user.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.getByText('Attuned Four')).toBeInTheDocument());
    expect(screen.queryByText('Attuned Two')).not.toBeInTheDocument();
  });

  it('supports manual catalog entry and side quest reward flow', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);

    await user.click(await screen.findByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /^catalog$/i }));
    await user.click(screen.getByRole('button', { name: /manual entry/i }));

    const editor = await screen.findByRole('heading', { name: /manual side quest entry/i });
    const form = editor.closest('form');
    expect(form).not.toBeNull();
    const formQueries = within(form as HTMLElement);

    await user.type(formQueries.getByRole('textbox', { name: /^name$/i }), 'Beneath the Brewery');
    await user.click(formQueries.getByRole('button', { name: /save manual entry/i }));

    await user.type(screen.getByRole('searchbox', { name: /search catalog/i }), 'beneath');
    await waitFor(() => expect(screen.getByText('Beneath the Brewery')).toBeInTheDocument());
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('No description available.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add rewards/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /side quest/i }), 'Beneath the Brewery');
    await user.type(
      screen.getByRole('textbox', { name: /reward item names/i }),
      'Clockwork Token\nMossy Key'
    );
    await user.click(screen.getByRole('button', { name: /save rewards/i }));

    await waitFor(() => expect(screen.getByText('Clockwork Token')).toBeInTheDocument());
    expect(screen.getByText('Mossy Key')).toBeInTheDocument();
  });

  it('supports removing an item from inventory', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);
    await user.click(await screen.findByRole('button', { name: /add item/i }));

    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Traveler Rope');
    await user.click(screen.getByRole('button', { name: /save item/i }));
    await waitFor(() => expect(screen.getByText('Traveler Rope')).toBeInTheDocument());

    const itemCard = screen.getByText('Traveler Rope').closest('li');
    expect(itemCard).not.toBeNull();
    await user.click(within(itemCard as HTMLElement).getByRole('button', { name: /^remove$/i }));

    await screen.findByRole('dialog', { name: /remove item/i });
    await user.click(screen.getByRole('button', { name: /^remove item$/i }));

    await waitFor(() => expect(screen.queryByText('Traveler Rope')).not.toBeInTheDocument());
  });

  it('loads catalog from local snapshot and still allows manual catalog updates', async () => {
    const user = userEvent.setup();
    render(<HomeRoute />);

    await user.click(await screen.findByRole('button', { name: /^add rewards$/i }));
    await screen.findByRole('heading', { name: /add side quest rewards/i });
    const rewardForm = screen.getByRole('button', { name: /^save rewards$/i }).closest('form');
    expect(rewardForm).not.toBeNull();
    const rewardQueries = within(rewardForm as HTMLElement);

    await user.click(rewardQueries.getByRole('button', { name: /^catalog$/i }));
    await user.click(screen.getByRole('button', { name: /refresh catalog/i }));

    await waitFor(() => expect(screen.getByText(/catalog loaded from local snapshot/i)).toBeInTheDocument());
    expect(screen.getByText(/status:/i)).toHaveTextContent(/success/i);

    await user.click(screen.getByRole('button', { name: /manual entry/i }));
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Offline Quest');
    await user.click(screen.getByRole('button', { name: /save manual entry/i }));

    await user.type(screen.getByRole('searchbox', { name: /search catalog/i }), 'offline');
    await waitFor(() => expect(screen.getByText('Offline Quest')).toBeInTheDocument());
  });

  it('supports QR export and import with replace confirmation guardrail', async () => {
    const user = userEvent.setup();
    await storageService.init();
    const repository = createItemRepository(storageService);
    await repository.create({
      name: 'Moon Key',
      isMagic: false,
      isComplete: true,
      sourceType: 'other',
      tags: []
    });

    window.history.replaceState({}, '', '/?openTransfer=1');
    render(<HomeRoute />);
    await waitFor(() => expect(screen.getByText('Moon Key')).toBeInTheDocument());

    await screen.findByRole('heading', { name: /backup and transfer/i });
    await user.click(screen.getByRole('button', { name: /show qr/i }));
    await screen.findByRole('img', { name: /qr chunk 1 of/i });

    const allQrChunks = (await screen.findByRole('textbox', {
      name: /all qr chunks/i
    })) as HTMLTextAreaElement;
    const qrText = allQrChunks.value;
    expect(qrText.length).toBeGreaterThan(0);

    const itemCard = screen.getByText('Moon Key').closest('li');
    expect(itemCard).not.toBeNull();
    await user.click(within(itemCard as HTMLElement).getByRole('button', { name: /^remove$/i }));
    await user.click(screen.getByRole('button', { name: /^remove item$/i }));
    await waitFor(() => expect(screen.queryByText('Moon Key')).not.toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: /scan qr chunks/i }), qrText);
    await user.click(
      screen.getByRole('checkbox', {
        name: /i understand this will replace local inventory data/i
      })
    );
    await user.click(screen.getByRole('button', { name: /^scan qr$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^scan qr$/i })).not.toBeDisabled()
    );
    expect(screen.getByText('Moon Key')).toBeInTheDocument();
  });

  it('shows fallback guidance when camera qr scanning is unavailable', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/?openTransfer=1');
    render(<HomeRoute />);

    await screen.findByRole('button', { name: /add item/i });
    await screen.findByRole('heading', { name: /backup and transfer/i });
    await user.click(screen.getByRole('button', { name: /start camera scan/i }));

    expect(
      screen.getByText(/this browser does not expose camera qr detection/i)
    ).toBeInTheDocument();
  });
});
