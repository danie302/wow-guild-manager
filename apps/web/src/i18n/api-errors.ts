import type { ApiError, ValidationIssue } from '@wgm/shared';
import type { TFunction } from 'i18next';

import { ApiRequestError } from '../api/client';

/** The message for an API error code. */
export function apiErrorMessage(t: TFunction, error: ApiError): string {
  return t(`errors.${error.code}`);
}

/** The message for one invalid field, with its parameters (e.g. the maximum length). */
export function validationIssueMessage(t: TFunction, issue: ValidationIssue): string {
  return t(`validation.${issue.code}`, issue.params);
}

/** The text for any request error: the API's code, each invalid field, or no connection. */
export function apiErrorText(t: TFunction, error: Error): string {
  if (!(error instanceof ApiRequestError)) return t('errors.API_UNAVAILABLE');
  if (error.error.code === 'VALIDATION_ERROR') {
    return error.error.issues.map((issue) => validationIssueMessage(t, issue)).join(' ');
  }
  return apiErrorMessage(t, error.error);
}
