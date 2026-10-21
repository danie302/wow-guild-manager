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
}

export type JobName = keyof JobPayloads;
