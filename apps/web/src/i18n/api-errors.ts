import type { ApiError, ValidationIssue } from '@wgm/shared';
import type { TFunction } from 'i18next';

/** The message for an API error code. */
export function apiErrorMessage(t: TFunction, error: ApiError): string {
  return t(`errors.${error.code}`);
}

/** The message for one invalid field, with its parameters (e.g. the maximum length). */
export function validationIssueMessage(t: TFunction, issue: ValidationIssue): string {
  return t(`validation.${issue.code}`, issue.params);
}
