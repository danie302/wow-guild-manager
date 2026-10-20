import type { ApiError, ApiErrorResponse } from '@wgm/shared';

/** The API answered with an error code. */
export class ApiRequestError extends Error {
  override name = 'ApiRequestError';

  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(`API answered ${status} ${error.code}`);
  }
}

/** The API couldn't be reached, or didn't answer with JSON. */
export class ApiUnavailableError extends Error {
  override name = 'ApiUnavailableError';

  constructor(readonly status?: number) {
    super(status ? `API answered with status ${status}` : 'API unreachable');
  }
}

/**
 * Calls the API with JSON and returns the parsed body. Throws ApiRequestError for an error
 * response and ApiUnavailableError when there's no usable answer.
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiUnavailableError();
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => undefined);
  if (response.ok && data !== undefined) {
    return data as T;
  }
  if (isApiErrorResponse(data)) {
    throw new ApiRequestError(response.status, data.error);
  }
  throw new ApiUnavailableError(response.status);
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ApiErrorResponse).error?.code === 'string'
  );
}
