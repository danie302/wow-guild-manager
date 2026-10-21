export const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
/** A request to join a guild, made with /register. */
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
