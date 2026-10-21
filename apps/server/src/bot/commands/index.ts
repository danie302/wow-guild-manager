import type { JobEnqueuer } from '../../jobs/index.js';
import { ping } from './ping.js';
import { registerCommand } from './register.js';
import type { SlashCommand } from './types.js';

export type { SlashCommand } from './types.js';

export interface CommandDependencies {
  jobs: JobEnqueuer;
}

/** Every slash command the bot registers. */
export function createCommands({ jobs }: CommandDependencies): readonly SlashCommand[] {
  return [ping, registerCommand(jobs)];
}
