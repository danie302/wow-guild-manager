import type { SignUpChanges } from '../domain/sign-ups.js';
import { enqueueEventPosts } from './event-posts.js';
import type { JobEnqueuer } from './queue.js';

/**
 * Hands what a change did to other people's sign-ups to the worker: a direct message for each
 * promotion, move to the waitlist, replacement, and removal, one per member for rescheduled events (however
 * many of their events moved), and post updates for events whose sign-ups changed.
 */
export async function notifySignUpChanges(
  jobs: JobEnqueuer,
  changes: SignUpChanges,
): Promise<void> {
  await jobs.enqueueMany(
    'waitlist-promoted',
    changes.promoted.map((signUpId) => ({ signUpId })),
  );
  await jobs.enqueueMany(
    'moved-to-waitlist',
    changes.movedToWaitlist.map((signUpId) => ({ signUpId })),
  );
  await jobs.enqueueMany(
    'replaced-by-waitlist',
    changes.replaced.map((signUpId) => ({ signUpId })),
  );
  await jobs.enqueueMany('participant-removed', changes.removed);
  const byMember = new Map<string, string[]>();
  for (const { memberId, eventId } of changes.rescheduled) {
    byMember.set(memberId, [...(byMember.get(memberId) ?? []), eventId]);
  }
  await jobs.enqueueMany(
    'events-rescheduled',
    [...byMember].map(([memberId, eventIds]) => ({ memberId, eventIds })),
  );
  await enqueueEventPosts(jobs, changes.eventIds);
}
