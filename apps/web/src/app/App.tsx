import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../api/queryClient';
import { UiProvider } from '../components/ui';
import { i18n } from '../i18n';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <I18nextProvider i18n={i18n}>
      <UiProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </UiProvider>
    </I18nextProvider>
  );
}
