/** Error codes the API returns. The web client translates them; the API never sends user-facing text. */
export type ApiErrorCode = 'NOT_FOUND' | 'INVALID_JSON' | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
  };
}

export type HealthStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
  };
}
