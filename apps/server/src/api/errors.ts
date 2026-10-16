import type { ApiErrorCode, ApiErrorResponse } from '@wgm/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';

export function sendError(res: Response, status: number, code: ApiErrorCode): void {
  res.status(status).json({ error: { code } } satisfies ApiErrorResponse);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'NOT_FOUND');
};

/** Last middleware: logs the error with its stack and returns a JSON error without details. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (isJsonParseError(err)) {
    sendError(res, 400, 'INVALID_JSON');
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  if (res.headersSent) {
    next(err);
    return;
  }
  sendError(res, 500, 'INTERNAL_ERROR');
};

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}
