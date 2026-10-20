import { toValidationIssues, type ApiError, type ApiErrorResponse } from '@wgm/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { z } from 'zod';

/** Sends an error code (with its details), never translated text: the web client translates it. */
export function sendError(res: Response, status: number, error: ApiError): void {
  res.status(status).json({ error } satisfies ApiErrorResponse);
}

/** 400 with one code per invalid field, from a failed Zod parse of `input`. */
export function sendValidationError(res: Response, error: z.ZodError, input: unknown): void {
  sendError(res, 400, { code: 'VALIDATION_ERROR', issues: toValidationIssues(error, input) });
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, { code: 'NOT_FOUND' });
};

/** Last middleware: logs the error with its stack and returns a JSON error without details. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (isJsonParseError(err)) {
    sendError(res, 400, { code: 'INVALID_JSON' });
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  if (res.headersSent) {
    next(err);
    return;
  }
  sendError(res, 500, { code: 'INTERNAL_ERROR' });
};

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}
