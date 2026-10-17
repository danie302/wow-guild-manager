import { ping } from './ping.js';
import type { SlashCommand } from './types.js';

export type { SlashCommand } from './types.js';

/** Every slash command the bot registers. */
export const commands: readonly SlashCommand[] = [ping];
