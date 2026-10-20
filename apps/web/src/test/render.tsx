import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '../app/routes';
import { UiProvider } from '../components/ui';
import { i18n } from '../i18n';

/** Renders the app's routes at a URL, with the same providers as the real app. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <UiProvider>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </UiProvider>
    </I18nextProvider>,
  );
}
