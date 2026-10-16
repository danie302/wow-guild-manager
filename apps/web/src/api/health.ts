import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@wgm/shared';

/** The API couldn't be reached, or didn't answer with a health report. */
export class ApiUnavailableError extends Error {
  override name = 'ApiUnavailableError';

  constructor(readonly status?: number) {
    super(status ? `API answered with status ${status}` : 'API unreachable');
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiUnavailableError();
  }

  // 503 still carries a report: the API is up, but the database or Redis isn't.
  if (response.status === 200 || response.status === 503) {
    const body: unknown = await response.json().catch(() => null);
    if (isHealthResponse(body)) {
      return body;
    }
  }
  throw new ApiUnavailableError(response.status);
}

function isHealthResponse(body: unknown): body is HealthResponse {
  return typeof body === 'object' && body !== null && 'status' in body && 'checks' in body;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    retry: false,
  });
}
