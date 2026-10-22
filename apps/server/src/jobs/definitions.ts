/**
 * Every job the worker runs: its name and the payload it needs. Enqueuing a job with a name
 * or payload that isn't listed here is a type error.
 *
 * Payloads are stored as JSON in Redis, so use plain values (ISO strings, not Dates) and only
 * IDs, never whole records: a job re-reads the current data when it runs.
 */
export interface JobPayloads {
  /** Logs a message. Only used to check the queue end to end; real jobs come in later stories. */
  ping: { message: string };
  /** Hourly: creates the events of every running series two weeks ahead (domain/series.ts). */
  'extend-series': Record<string, never>;
  /** Tells someone by direct message that their request to join was approved or rejected. */
  'registration-reviewed': { registrationId: string };
  /**
   * Brings an event's Discord post up to date: posts it, edits it, or moves it to the guild's
   * events channel (jobs/handlers/event-posts.ts). Enqueued after every change to the event
   * or to the guild's Discord settings; runs for one event never overlap.
   */
  'event-post': { eventId: string };
  /** Tells a member by direct message that their waitlisted character got a slot. */
  'waitlist-promoted': { signUpId: string };
  /** Tells a member their character lost its slot because the role's slots went down. */
  'moved-to-waitlist': { signUpId: string };
  /** Tells a Tentative participant they were replaced and are now at the end of the waitlist. */
  'replaced-by-waitlist': { signUpId: string };
  /** Tells a member who removed them from an event. */
  'participant-removed': { memberId: string; eventId: string; byUserId: string };
  /** Tells a member the Guild Master pre-confirmed their character for a new raid. */
  'pre-confirmed': { signUpId: string };
  /** Tells a member the date or time of events they're signed up for changed, in one message. */
  'events-rescheduled': { memberId: string; eventIds: string[] };
  /** Deletes the post of an event that no longer exists (a stopped series' future events). */
  'event-post-delete': { channelId: string; messageId: string };
}

export type JobName = keyof JobPayloads;
