import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockApi, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

describe('UserSettingsPage', () => {
  it('switches the whole app to Spanish and back without reloading', async () => {
    const fetchMock = mockApi({
      'PATCH /api/me': (init) =>
        Response.json({ ...testUser, ...(JSON.parse(init?.body as string) as object) }),
    });
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
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ locale: 'es' }) }),
    );

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('heading', { name: 'User settings' })).toBeInTheDocument();
  });
});
