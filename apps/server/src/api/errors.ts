import { toValidationIssues, type ApiError, type ApiErrorResponse } from '@wgm/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { z } from 'zod';

import { DomainError, DomainValidationError } from '../domain/errors.js';
import { DiscordUnavailableError } from '../integrations/discord/directory.js';

/** The HTTP status for each error code that domain rules throw. */
const DOMAIN_ERROR_STATUS: Partial<Record<ApiError['code'], number>> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  ALREADY_LEADS_GUILD: 409,
  DISCORD_SERVER_TAKEN: 409,
  MEMBER_ALREADY_ON_ROSTER: 409,
  GUILD_MASTER_CANNOT_BE_REMOVED: 409,
  REGISTRATION_NOT_PENDING: 409,
  EVENT_STARTED: 409,
  EVENT_CANCELLED: 409,
  DISCORD_NOT_CONFIGURED: 503,
  DISCORD_UNAVAILABLE: 503,
};

/** Sends an error code (with its details), never translated text: the web client translates it. */
export function sendError(res: Response, status: number, error: ApiError): void {
  res.status(status).json({ error } satisfies ApiErrorResponse);
}

/** 400 with one code per invalid field, from a failed Zod parse of `input`. */
export function sendValidationError(res: Response, error: z.ZodError, input: unknown): void {
  sendError(res, 400, { code: 'VALIDATION_ERROR', issues: toValidationIssues(error, input) });
}

/** The parsed body, or undefined after answering 400 with its issues. */
export function parseBody<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
  res: Response,
): z.output<Schema> | undefined {
  const result = schema.safeParse(body);
  if (!result.success) {
    sendValidationError(res, result.error, body);
    return undefined;
  }
  return result.data;
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
  if (isTooLargeError(err)) {
    sendError(res, 413, { code: 'FILE_TOO_LARGE' });
    return;
  }
  if (err instanceof DomainError) {
    sendError(res, DOMAIN_ERROR_STATUS[err.error.code] ?? 400, err.error);
    return;
  }
  if (err instanceof DomainValidationError) {
    sendError(res, 400, { code: 'VALIDATION_ERROR', issues: err.issues });
    return;
  }
  if (err instanceof DiscordUnavailableError) {
    req.log.warn({ err }, 'Discord request failed');
    sendError(res, 503, { code: 'DISCORD_UNAVAILABLE' });
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  if (res.headersSent) {
    next(err);
    return;
  }
  sendError(res, 500, { code: 'INTERNAL_ERROR' });
};

function isTooLargeError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large'
  );
}

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}
