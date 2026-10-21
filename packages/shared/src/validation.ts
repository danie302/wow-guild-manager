import type { z } from 'zod';

import { VALIDATION_ISSUE_CODES, type ValidationIssue, type ValidationIssueCode } from './api.js';

/**
 * Turns a Zod error into issue codes the API can return and the web client can translate.
 * `input` is the value that was parsed, used to tell a missing field from a wrong type.
 */
export function toValidationIssues(error: z.ZodError, input: unknown): ValidationIssue[] {
  return error.issues.map((issue) => {
    const field = issue.path.join('.');
    const { code, params } = issueCode(issue, valueAt(input, issue.path));
    return params ? { field, code, params } : { field, code };
  });
}

function issueCode(
  issue: z.core.$ZodIssue,
  value: unknown,
): { code: ValidationIssueCode; params?: ValidationIssue['params'] } {
  switch (issue.code) {
    case 'invalid_type':
      return { code: value === undefined || value === null ? 'REQUIRED' : 'INVALID_TYPE' };
    case 'too_small': {
      const count = Number(issue.minimum);
      if (issue.origin === 'string') {
        return value === '' || (typeof value === 'string' && value.trim() === '')
          ? { code: 'REQUIRED' }
          : { code: 'TOO_SHORT', params: { count } };
      }
      return issue.origin === 'array'
        ? { code: 'TOO_FEW', params: { count } }
        : { code: 'TOO_SMALL', params: { count } };
    }
    case 'too_big': {
      const count = Number(issue.maximum);
      if (issue.origin === 'string') return { code: 'TOO_LONG', params: { count } };
      return issue.origin === 'array'
        ? { code: 'TOO_MANY', params: { count } }
        : { code: 'TOO_BIG', params: { count } };
    }
    case 'invalid_format':
      return { code: 'INVALID_FORMAT' };
    case 'invalid_value':
      // A missing choice (e.g. no race picked) fails as an invalid enum value.
      return { code: value === undefined || value === null ? 'REQUIRED' : 'INVALID_VALUE' };
    case 'custom':
      // Rule checks in the shared schemas use their error code as the message.
      return isIssueCode(issue.message)
        ? {
            code: issue.message,
            ...(issue.params && { params: issue.params as ValidationIssue['params'] }),
          }
        : { code: 'INVALID_VALUE' };
    default:
      return { code: 'INVALID_VALUE' };
  }
}

function isIssueCode(value: string): value is ValidationIssueCode {
  return (VALIDATION_ISSUE_CODES as readonly string[]).includes(value);
}

function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let value = input;
  for (const key of path) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<PropertyKey, unknown>)[key];
  }
  return value;
}
