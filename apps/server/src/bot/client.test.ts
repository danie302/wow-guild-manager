import { MessageFlags, type Interaction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';

import { createTestLogger } from '../test-logger.js';
import { describeLoginError, handleInteraction, registerCommands } from './client.js';
import { ping } from './commands/ping.js';
import type { SlashCommand } from './commands/types.js';

function fakeCommandInteraction(commandName: string) {
  return {
    commandName,
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    reply: vi.fn(() => Promise.resolve()),
  };
}

const asInteraction = (fake: object) => fake as unknown as Interaction;

describe('handleInteraction', () => {
  it('runs the command with the interaction name', async () => {
    const interaction = fakeCommandInteraction('ping');

    await handleInteraction(asInteraction(interaction), [ping], createTestLogger().logger);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Pong!',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('ignores interactions that are not slash commands', async () => {
    const execute = vi.fn();
    const command = { definition: ping.definition, execute } as SlashCommand;

    await handleInteraction(
      asInteraction({ isChatInputCommand: () => false }),
      [command],
      createTestLogger().logger,
    );

    expect(execute).not.toHaveBeenCalled();
  });

  it('replies privately and logs the error when a command fails', async () => {
    const { logger, lines } = createTestLogger();
    const failing: SlashCommand = {
      definition: ping.definition,
      execute: () => Promise.reject(new Error('boom')),
    };
    const interaction = fakeCommandInteraction('ping');

    await handleInteraction(asInteraction(interaction), [failing], logger);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(lines().find((line) => line.msg === 'Slash command failed')?.err).toMatchObject({
      message: 'boom',
    });
  });
});

describe('registerCommands', () => {
  it('replaces the server command list with every command', async () => {
    const set = vi.fn(() => Promise.resolve());

    await registerCommands(
      { id: '123', commands: { set } } as unknown as Parameters<typeof registerCommands>[0],
      [ping],
      createTestLogger().logger,
    );

    expect(set).toHaveBeenCalledWith([ping.definition]);
  });
});

describe('describeLoginError', () => {
  it('explains an invalid token', () => {
    expect(describeLoginError(new Error('An invalid token was provided.'))).toContain(
      'DISCORD_BOT_TOKEN',
    );
  });

  it('explains a missing Server Members intent', () => {
    expect(describeLoginError(new Error('Used disallowed intents'))).toContain(
      'Server Members Intent',
    );
  });
});
