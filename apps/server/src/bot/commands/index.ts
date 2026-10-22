import { attendance } from './attendance.js';
import { character } from './character.js';
import { main } from './main.js';
import { ping } from './ping.js';
import { register } from './register.js';
import type { SlashCommand } from './types.js';

export type { SlashCommand } from './types.js';

/** Every slash command the bot registers. */
export const commands: readonly SlashCommand[] = [ping, register, main, character, attendance];
