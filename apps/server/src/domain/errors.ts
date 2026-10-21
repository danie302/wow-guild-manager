import type { ApiError, ValidationIssue } from '@wgm/shared';

/** A rule was broken. The API turns the code into its HTTP status (see api/errors.ts). */
export class DomainError extends Error {
  override name = 'DomainError';

  constructor(readonly error: ApiError) {
    super(error.code);
  }
}

/** Input that passed its schema but breaks a rule that needs data, e.g. a role not in the server. */
export class DomainValidationError extends Error {
  override name = 'DomainValidationError';

  constructor(readonly issues: ValidationIssue[]) {
    super('VALIDATION_ERROR');
  }
}
