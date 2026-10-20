import type { HealthResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { mockApi, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

function mockHealth(handler: () => Response | Promise<Response>, me = testUser) {
  mockApi({ '/api/health': handler, '/api/me': () => Response.json(me) });
}

function healthResponse(body: HealthResponse, status: number) {
  return () => Response.json(body, { status });
}

function statusOf(service: string) {
  const term = screen.getByText(service, { selector: 'dt' });
  const row = term.parentElement;
  if (!row) throw new Error(`No row for ${service}`);
  return within(row).getByRole('definition');
}

describe('StatusPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the API, database, and Redis as up', async () => {
    mockHealth(healthResponse({ status: 'ok', checks: { database: 'up', redis: 'up' } }, 200));

    renderRoute('/status');

    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(statusOf('API')).toHaveTextContent('Up');
    expect(statusOf('Database')).toHaveTextContent('Up');
    expect(statusOf('Redis')).toHaveTextContent('Up');
  });

  it('shows which service is down when the API answers 503', async () => {
    mockHealth(healthResponse({ status: 'error', checks: { database: 'down', redis: 'up' } }, 503));

    renderRoute('/status');

    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(statusOf('API')).toHaveTextContent('Up');
    expect(statusOf('Database')).toHaveTextContent('Down');
    expect(statusOf('Database')).toHaveAttribute('data-tone', 'bad');
    expect(statusOf('Redis')).toHaveTextContent('Up');
  });

  it('shows an error state when the API is unreachable', async () => {
    mockHealth(() => Promise.reject(new TypeError('Failed to fetch')));

    renderRoute('/status');

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the API");
    expect(statusOf('API')).toHaveTextContent('Down');
  });

  it('shows an error state when the proxy answers without a health report', async () => {
    mockHealth(() => new Response('Bad gateway', { status: 502 }));

    renderRoute('/status');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('shows the page in Spanish, with the check time formatted for Spanish', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 21, 5, 9)));
    await i18n.changeLanguage('es');
    mockHealth(healthResponse({ status: 'ok', checks: { database: 'up', redis: 'down' } }, 503), {
      ...testUser,
      locale: 'es',
      timeZone: 'America/Bogota',
    });

    renderRoute('/status');

    expect(await screen.findByText('Base de datos')).toBeInTheDocument();
    expect(statusOf('Base de datos')).toHaveTextContent('Funciona');
    expect(statusOf('Redis')).toHaveTextContent('Caído');
    // 21:05:09 UTC is 16:05:09 in Bogotá, on Spanish's 24-hour clock (not 4:05:09 PM).
    expect(screen.getByText('Última comprobación: 16:05:09')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
