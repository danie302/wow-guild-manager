import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';
import { UiProvider } from './UiProvider';

function renderShell(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppShell>
            <AppShell.Sidebar>
              <AppShell.Brand title="Ashen Vanguard" initials="AV" />
              <AppShell.Nav label="Main">
                <AppShell.NavItem to="/" icon="dashboard" end>
                  Dashboard
                </AppShell.NavItem>
                <AppShell.NavItem to="/roster" icon="roster">
                  Roster
                </AppShell.NavItem>
              </AppShell.Nav>
            </AppShell.Sidebar>
            <AppShell.Main>Content</AppShell.Main>
          </AppShell>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <UiProvider>
      <RouterProvider router={router} />
    </UiProvider>,
  );
}

describe('AppShell', () => {
  it('renders the brand, the navigation, and the main content', () => {
    renderShell('/');

    expect(screen.getByText('Ashen Vanguard')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Content');
  });

  it('marks the current page in the navigation', () => {
    renderShell('/roster/42');

    expect(screen.getByRole('link', { name: 'Roster' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('requires its parts to be inside <AppShell>', () => {
    expect(() => render(<AppShell.Main>Content</AppShell.Main>)).toThrow(
      '<AppShell.Main> must be used inside <AppShell>',
    );
  });
});
