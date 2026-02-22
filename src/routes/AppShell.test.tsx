import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { HealthRoute } from './HealthRoute';

describe('AppLayout', () => {
  const renderLayout = () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <AppLayout />,
          children: [
            { index: true, element: <p>Home</p> },
            { path: 'health', element: <HealthRoute /> }
          ]
        }
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);
  };

  it('renders mobile shell with title', () => {
    renderLayout();

    expect(screen.getByRole('heading', { name: /leyfarer inventory/i })).toBeInTheDocument();
  });

  it('opens health route after tapping title five times', async () => {
    const user = userEvent.setup();
    renderLayout();

    const titleButton = screen.getByRole('button', { name: /developer options/i });

    for (let i = 0; i < 5; i += 1) {
      await user.click(titleButton);
    }

    expect(await screen.findByRole('heading', { name: /health check/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to app/i })).toHaveAttribute('href', '/');
  });
});
