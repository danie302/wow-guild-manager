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

  it('finds a time zone by typing a city, and saves it', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute('/settings/user');

    const field = await screen.findByRole('combobox', { name: 'Time zone' });
    expect(field).toHaveValue('UTC');

    await user.clear(field);
    await user.type(field, 'sao paulo');
    await user.click(await screen.findByRole('option', { name: /^Sao Paulo/ }));

    expect(fetchMock).toHaveBeenCalledWith(...patchedWith({ timeZone: 'America/Sao_Paulo' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveValue('Sao Paulo · America');
  });

  it('says so when no time zone matches', async () => {
    mockSettingsApi();
    const user = userEvent.setup();
    renderRoute('/settings/user');

    const field = await screen.findByRole('combobox', { name: 'Time zone' });
    await user.clear(field);
    await user.type(field, 'atlantis');

    expect(await screen.findByText('No time zone matches.')).toBeInTheDocument();
  });

  it("offers this device's time zone when the saved one differs", async () => {
    const fetchMock = mockApi({
      '/api/me': () => Response.json({ ...testUser, timeZone: 'Pacific/Fiji' }),
      'PATCH /api/me': (init) =>
        Response.json({ ...testUser, ...(JSON.parse(init?.body as string) as object) }),
    });
    const user = userEvent.setup();
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    renderRoute('/settings/user');

    await user.click(
      await screen.findByRole('button', { name: `Use this device's time zone (${detected})` }),
    );

    expect(fetchMock).toHaveBeenCalledWith(...patchedWith({ timeZone: detected }));
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
