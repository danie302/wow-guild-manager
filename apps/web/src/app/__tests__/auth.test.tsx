import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { i18n } from '../../i18n';
import { mockApi, notLoggedIn, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

describe('login and route guard', () => {
  it('sends a visitor who is not logged in to the login page', async () => {
    mockApi({ '/api/me': notLoggedIn });

    renderRoute('/events');

    const button = await screen.findByRole('link', { name: 'Log in with Discord' });
    expect(button).toHaveAttribute('href', '/api/auth/discord/login?locale=en');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it("passes the page's language to the login, for a new user", async () => {
    mockApi({ '/api/me': notLoggedIn });
    await i18n.changeLanguage('es');

    renderRoute('/login');

    expect(await screen.findByRole('link', { name: 'Iniciar sesión con Discord' })).toHaveAttribute(
      'href',
      '/api/auth/discord/login?locale=es',
    );
  });

  it.each([
    ['cancelled', 'Login cancelled on Discord. Try again when you’re ready.'],
    ['failed', 'The login with Discord didn’t work. Please try again.'],
  ])('explains a %s login', async (error, message) => {
    mockApi({ '/api/me': notLoggedIn });

    renderRoute(`/login?error=${error}`);

    expect(await screen.findByText(message.replace('’', "'"))).toBeInTheDocument();
  });

  it("shows the user's name and avatar once logged in", async () => {
    mockApi();

    renderRoute('/');

    expect(await screen.findByText('Thrall')).toBeInTheDocument();
    expect(document.querySelector(`img[src="${testUser.avatarUrl}"]`)).not.toBeNull();
  });

  it('sends a logged-in user away from the login page', async () => {
    mockApi();

    renderRoute('/login');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('switches to the language saved on the user, whatever this browser had', async () => {
    mockApi({ '/api/me': () => Response.json({ ...testUser, locale: 'es' }) });

    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument();
  });

  it('signs out and returns to the login page', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    renderRoute('/');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('link', { name: 'Log in with Discord' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
