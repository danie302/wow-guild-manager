import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query';

import { ApiRequestError } from './client';

/**
 * The app's query client. A 403 means the user lost access to something, e.g. their Officer
 * role was removed in Discord, so their guild list is reloaded and the guild drops out of it.
 */
export function createQueryClient(defaultOptions?: DefaultOptions): QueryClient {
  const onError = (error: Error) => {
    if (error instanceof ApiRequestError && error.status === 403) {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    ...(defaultOptions && { defaultOptions }),
  });
  return queryClient;
}
