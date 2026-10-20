import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockApi, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

/** A fake API whose PATCH /api/me merges the body into the user, like the server. */
function mockSettingsApi() {
  return mockApi({
    'PATCH /api/me': (init) =>
      Response.json({ ...testUser, ...(JSON.parse(init?.body as string) as object) }),
  });
}

function patchedWith(body: object): [string, RequestInit] {
  return [
    '/api/me',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify(body) }) as RequestInit,
  ];
}

describe('UserSettingsPage', () => {
  it('switches the whole app to Spanish and back without reloading', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute('/settings/user');

    expect(await screen.findByRole('heading', { name: 'User settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Events' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Español' }));

    expect(await screen.findByRole('heading', { name: 'Ajustes de usuario' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Eventos' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked();
    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem('wgm.locale')).toBe('es');
    expect(fetchMock).toHaveBeenCalledWith(...patchedWith({ locale: 'es' }));

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('heading', { name: 'User settings' })).toBeInTheDocument();
  });

  it('changes the time zone, shows the time there, and saves it', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute('/settings/user');

    const select = await screen.findByRole('combobox', { name: 'Time zone' });
    expect(select).toHaveValue('UTC');

    await user.selectOptions(select, 'Asia/Tokyo');

    expect(fetchMock).toHaveBeenCalledWith(...patchedWith({ timeZone: 'Asia/Tokyo' }));
    expect(await screen.findByRole('combobox', { name: 'Time zone' })).toHaveValue('Asia/Tokyo');
    expect(screen.getByRole('option', { name: 'Asia/Tokyo (UTC+09:00)' })).toBeInTheDocument();
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('switches the theme right away and saves it', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute('/settings/user');

    expect(await screen.findByRole('radio', { name: 'Dark' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(fetchMock).toHaveBeenCalledWith(...patchedWith({ theme: 'light' }));
  });
});
