import { Writable } from 'node:stream';

import { pino, type Logger } from 'pino';

/** A logger for tests that keeps every log line so tests can check what was logged. */
export function createTestLogger(): { logger: Logger; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    logger: pino({ level: 'info' }, stream),
    lines: () => chunks.map((chunk) => JSON.parse(chunk) as Record<string, unknown>),
  };
}
