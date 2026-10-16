import type { HealthResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderRoute } from '../test/render';

function mockFetch(implementation: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(implementation));
}

function healthResponse(body: HealthResponse, status: number) {
  return () => Promise.resolve(Response.json(body, { status }));
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
    mockFetch(healthResponse({ status: 'ok', checks: { database: 'up', redis: 'up' } }, 200));

    renderRoute('/status');

    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(statusOf('API')).toHaveTextContent('Up');
    expect(statusOf('Database')).toHaveTextContent('Up');
    expect(statusOf('Redis')).toHaveTextContent('Up');
  });

  it('shows which service is down when the API answers 503', async () => {
    mockFetch(healthResponse({ status: 'error', checks: { database: 'down', redis: 'up' } }, 503));

    renderRoute('/status');

    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(statusOf('API')).toHaveTextContent('Up');
    expect(statusOf('Database')).toHaveTextContent('Down');
    expect(statusOf('Database')).toHaveAttribute('data-tone', 'bad');
    expect(statusOf('Redis')).toHaveTextContent('Up');
  });

  it('shows an error state when the API is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    renderRoute('/status');

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the API");
    expect(statusOf('API')).toHaveTextContent('Down');
  });

  it('shows an error state when the proxy answers without a health report', async () => {
    mockFetch(() => Promise.resolve(new Response('Bad gateway', { status: 502 })));

    renderRoute('/status');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
